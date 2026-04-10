"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { ArrowLeft, Banknote, CreditCard, ShoppingCart, X, Loader2 } from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { CashTenderedDialog } from "./cash-tendered-dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { OutboxSyncService } from "@/lib/services/outbox-sync";
import { putMany } from "@/lib/idb/db";
import { getSumUpCredentials, hasSumUpCredentials, storeSumUpCredentials } from "@/lib/services/sumup-credentials";

interface Session {
  employee: {
    id: string;
    name: string;
  };
  register: {
    id: string;
    name: string;
    store_id: string;
  };
  org_id: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [availableTerminals, setAvailableTerminals] = useState<any[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Processing...");
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [connectionLostDialog, setConnectionLostDialog] = useState(false);
  const [pendingCheckoutId, setPendingCheckoutId] = useState<string | null>(null);
  const [pendingReaderId, setPendingReaderId] = useState<string | null>(null);
  const activePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ticketAssignment, setTicketAssignment] = useState<{ type: 'customer' | 'table'; customer?: any; name: string } | null>(null);
  const { lines, getTotal, clearCart } = useCartStore();
  
  // SumUp API key credential check
  const [sumUpConfigured, setSumUpConfigured] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);

    // Check localStorage first (instant), then confirm from DB in background
    setSumUpConfigured(hasSumUpCredentials());
    if (navigator.onLine) {
      fetch("/api/sumup/credentials")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.configured) {
            // Mirror to localStorage so hasSumUpCredentials() stays true on next load
            storeSumUpCredentials({
              apiKey: "__db__", // sentinel — actual key lives server-side only
              merchantCode: data.merchant_code,
              affiliateKey: data.affiliate_key || "",
              appId: "com.penkey.pos",
              environment: "production",
            });
            setSumUpConfigured(true);
          } else if (data && !data.configured) {
            setSumUpConfigured(false);
          }
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }

    try {
      const parsed = JSON.parse(sessionData);
      setSession(parsed);
      
      // Load ticket assignment if available
      const assignmentData = sessionStorage.getItem("pos_ticket_assignment");
      console.log('[Payment] Ticket assignment data:', assignmentData);
      if (assignmentData) {
        try {
          const assignment = JSON.parse(assignmentData);
          console.log('[Payment] Parsed ticket assignment:', assignment);
          console.log('[Payment] Customer ID:', assignment?.customer?.id);
          setTicketAssignment(assignment);
        } catch (assignmentErr) {
          console.warn("Failed to parse ticket assignment:", assignmentErr);
        }
      }
    } catch (err) {
      router.push("/lock");
    }
  }, [router]);

  useEffect(() => {
    // If user arrives on payment page with an empty cart, redirect them back to Sell.
    // But do NOT redirect while we're processing a payment (to allow success page navigation).
    if (lines.length === 0 && !processing && !paymentCompleted) {
      router.push("/sell");
    }
  }, [lines, router, processing, paymentCompleted]);

  useEffect(() => {
    if (itemsDialogOpen) {
      return () => {
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      };
    } else {
      document.body.style.overflow = '';
      document.body.style.pointerEvents = '';
    }
  }, [itemsDialogOpen]);

  // Poll terminal status when selection dialog is open
  useEffect(() => {
    if (!terminalDialogOpen || availableTerminals.length === 0) {
      return;
    }

    const checkTerminalStatus = async () => {
      try {
        // Check each terminal's status
        const updatedTerminals = await Promise.all(
          availableTerminals.map(async (terminal) => {
            try {
              const res = await fetch(`/api/sumup/diagnose?reader_id=${terminal.reader_id}`);
              if (res.ok) {
                const data = await res.json();
                return {
                  ...terminal,
                  status: data.reader_online === 'ONLINE' ? 'online' : 'offline',
                  battery_level: data.battery_level,
                };
              }
              return terminal;
            } catch {
              return terminal;
            }
          })
        );
        setAvailableTerminals(updatedTerminals);
      } catch (error) {
        console.error("[Payment] Failed to check terminal status:", error);
      }
    };

    // Check immediately
    checkTerminalStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkTerminalStatus, 5000);

    return () => clearInterval(interval);
  }, [terminalDialogOpen, availableTerminals]);

  const total = getTotal();

  const handleCashPayment = async (amount: number) => {
    if (!session) return;

    setProcessing(true);
    setCashDialogOpen(false);

    const change = amount - total;
    console.log("[Payment] Cash tendered:", amount);
    console.log("[Payment] Total:", total);
    console.log("[Payment] Change calculated:", change);
    
    const receiptData = {
      lines: lines,
      payment_method: "cash",
      cash_tendered: amount,
      employee_id: session.employee.id,
      register_id: session.register.id,
      store_id: session.register.store_id,
      org_id: session.org_id,
      // Customer data from ticket assignment
      customer_id: ticketAssignment?.customer?.id || null,
      customer_name: ticketAssignment?.name || null,
      customer_email: ticketAssignment?.customer?.email || null,
      customer_phone: ticketAssignment?.customer?.phone || null,
      table_number: ticketAssignment?.type === 'table' ? ticketAssignment.name : null,
    };
    
    console.log('[Payment] Creating receipt with customer data:', {
      customer_id: receiptData.customer_id,
      customer_name: receiptData.customer_name,
      customer_email: receiptData.customer_email,
      customer_phone: receiptData.customer_phone,
    });

    try {
      // Generate receipt ID
      const tempReceiptId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const changeAmount = change.toFixed(2);

      // OFFLINE-FIRST: Save locally immediately for instant response
      // Parallel writes instead of sequential (50-100ms faster)
      await Promise.all([
        putMany("receipts", [{
          id: tempReceiptId,
          ...receiptData,
          created_at: new Date().toISOString(),
          total: total,
          change: change,
          offline: true,
        }]),
        OutboxSyncService.addToOutbox('receipt', receiptData, session.org_id, false)
      ]);

      // Clear cart and ticket assignment immediately
      clearCart();
      sessionStorage.removeItem("pos_ticket_assignment");

      // Navigate immediately. Set a flag to prevent the empty-cart-redirect effect.
      setPaymentCompleted(true);
      console.log("[Payment] Navigating to success with change:", changeAmount);
      console.log("[Payment] Full URL:", `/payment/success?receipt_id=${tempReceiptId}&change=${changeAmount}&offline=true`);
      router.push(`/payment/success?receipt_id=${tempReceiptId}&change=${changeAmount}&offline=true`);

      // We don't setProcessing(false) here because the component will unmount upon navigation.

      // Background sync attempt (non-blocking)
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        // Get CSRF token from cookie
        const getCsrfToken = () => {
          const cookies = document.cookie.split(';').map(c => c.trim());
          for (const cookie of cookies) {
            if (cookie.startsWith('csrf_token=')) {
              return cookie.substring('csrf_token='.length);
            }
          }
          return null;
        };
        
        const csrfToken = getCsrfToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        
        // Add CSRF token if available
        if (csrfToken) {
          headers["x-csrf-token"] = csrfToken;
        }
        
        fetch("/api/receipts/create", {
          method: "POST",
          headers,
          body: JSON.stringify(receiptData),
        })
          .then(async (response) => {
            if (response.ok) {
              const data = await response.json();
              console.log("[Payment] Background sync successful:", data.receipt_id);
              // Update local receipt with real ID
              await putMany("receipts", [{
                id: data.receipt_id,
                ...receiptData,
                created_at: new Date().toISOString(),
                total: total,
                change: change,
                offline: false,
              }]);
            } else {
              console.log("[Payment] Background sync failed with status:", response.status);
            }
          })
          .catch((err) => {
            console.log("[Payment] Background sync failed, will retry later:", err);
          });
      }
    } catch (err: any) {
      console.error("[Payment] Failed to save receipt:", err);
      showToast(err.message || "Failed to complete sale", "error");
      setProcessing(false);
    }
  };

  const handleCardPayment = async () => {
    if (!session) return;

    const creds = getSumUpCredentials();
    if (!creds?.apiKey || !creds?.merchantCode) {
      showToast("SumUp not configured. Go to Settings → SumUp Payments and connect first.", "error");
      return;
    }

    if (!navigator.onLine) {
      showToast("Cannot process card payments while offline.", "error");
      return;
    }

    // Store these at function scope so error handlers can access them
    let checkoutId: string | null = null;
    let readerId: string | null = null;

    try {
      // Fetch paired terminals from database
      const terminalsRes = await fetch("/api/sumup/terminals");
      const terminalsData = await terminalsRes.json();
      const terminals: any[] = terminalsData.terminals || [];

      if (!terminals || terminals.length === 0) {
        showToast("No card readers paired. Go to Settings → Payment Terminals to pair a reader.", "error");
        return;
      }

      // If multiple terminals, show selection dialog
      if (terminals.length > 1) {
        setAvailableTerminals(terminals);
        setSelectedTerminal(null);
        setTerminalDialogOpen(true);
        return;
      }

      // Single terminal - proceed with payment
      setProcessing(true);
      setProcessingMessage("Checking card reader...");

      const onlineTerminal = terminals.find((t: any) => t.status === "online") || terminals[0];
      readerId = onlineTerminal.reader_id;
      console.log('[Payment] Using reader:', readerId, onlineTerminal.name);
      
      // Diagnose reader before payment - auto-fix stuck states
      try {
        setProcessingMessage("Checking reader...");
        const diagRes = await fetch(`/api/sumup/diagnose?reader_id=${onlineTerminal.reader_id}&fix=true`);
        if (diagRes.ok) {
          const diag = await diagRes.json();
          console.log('[Payment] Reader diagnosis:', diag);
          
          if (diag.reader_online === 'OFFLINE') {
            showToast("Card reader is offline. Please check it's powered on and connected to Wi-Fi.", "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
            return;
          }
          
          if (diag.reader_state === 'UPDATING_FIRMWARE') {
            showToast("Card reader is updating firmware. Please wait.", "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
            return;
          }
          
          // If we had to terminate a stuck checkout, wait a moment
          if (diag.terminate_result?.ok) {
            console.log('[Payment] Terminated stuck checkout, waiting for reader to reset...');
            setProcessingMessage("Clearing previous payment...");
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
          // Check battery level
          if (diag.battery_level !== undefined && diag.battery_level < 20) {
            showToast(`Reader battery low (${Math.round(diag.battery_level)}%). Please charge soon.`, "info");
          }
          
          // Show recommendations
          if (diag.recommendations?.length > 0) {
            console.warn('[Payment] Recommendations:', diag.recommendations);
          }
        }
      } catch (err) {
        console.warn('[Payment] Diagnosis failed, proceeding anyway:', err);
      }

      setProcessingMessage(`Sending to ${onlineTerminal.name}...`);

      // Create checkout on the reader (server reads credentials from DB)
      const checkoutRes = await fetch("/api/sumup/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          currency: "GBP",
          reader_id: onlineTerminal.reader_id,
          description: "Penkey POS Purchase",
        }),
      });

      const checkoutData = await checkoutRes.json();
      console.log('[Payment] Checkout response:', checkoutData);
      
      if (!checkoutData.success) {
        const errorMsg = typeof checkoutData.error === 'string' 
          ? checkoutData.error 
          : checkoutData.error?.message || checkoutData.message || "Failed to start card payment";
        console.error('[Payment] Checkout creation failed:', errorMsg);
        
        // If server terminated a pending checkout, retry automatically
        if (checkoutData.retry) {
          console.log('[Payment] Retrying after terminating pending checkout...');
          showToast("Clearing previous checkout, please wait...", "info");
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          // Retry by calling handleCardPayment again
          setProcessing(false);
          setTimeout(() => handleCardPayment(), 500);
          return;
        }
        
        showToast(errorMsg, "error");
        setProcessing(false);
        setProcessingMessage("Processing...");
        return;
      }

      checkoutId = checkoutData.checkout_id;
      console.log('[Payment] Checkout created:', checkoutId);
      
      if (!checkoutId) {
        console.error('[Payment] No checkout ID in response:', checkoutData);
        showToast("Failed to get checkout ID from payment system", "error");
        setProcessing(false);
        setProcessingMessage("Processing...");
        return;
      }
      
      // Save to state immediately
      setPendingCheckoutId(checkoutId);
      setPendingReaderId(readerId);
      console.log('[Payment] Saved to state - checkoutId:', checkoutId, 'readerId:', readerId);
      setProcessingMessage("Waiting for card...");

      // Poll reader status + transaction status (up to 3 minutes)
      // SumUp Cloud API flow: poll reader state, then check transaction when IDLE
      const maxAttempts = 90; // 3 minutes at 2 second intervals
      let attempts = 0;
      let consecutiveErrors = 0;
      let lastReaderState = "";
      let idleCount = 0; // Track how many times we see IDLE to confirm payment finished
      
      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`/api/sumup/checkout-status?checkoutId=${checkoutId}&reader_id=${readerId}`);
          
          if (!statusRes.ok) {
            throw new Error(`Status check failed: ${statusRes.status}`);
          }
          
          const statusData = await statusRes.json();
          const status = statusData.status;
          const readerState = statusData.reader_state;
          const readerData = statusData.reader_data;
          const transaction = statusData.transaction;

          console.log(`[Payment] Poll ${attempts}/${maxAttempts} - status: ${status}, reader: ${readerState}, readerData:`, readerData);

          // Reset consecutive errors on successful response
          consecutiveErrors = 0;

          // Update spinner based on reader state
          if (readerState && readerState !== lastReaderState) {
            lastReaderState = readerState;

            // Check if reader_data has a message field to display
            const readerMessage = readerData?.message || readerData?.display_message || readerData?.customer_message;

            if (readerMessage) {
              setProcessingMessage(readerMessage);
            } else {
              // Fall back to state-based messages
              switch (readerState) {
                case "WAITING_FOR_CARD":
                  setProcessingMessage("Present card to reader...");
                  break;
                case "WAITING_FOR_PIN":
                  setProcessingMessage("Enter PIN on reader...");
                  break;
                case "SELECTING_TIP":
                  setProcessingMessage("Select tip amount...");
                  break;
                case "WAITING_FOR_SIGNATURE":
                  setProcessingMessage("Sign on reader...");
                  break;
                case "PROCESSING":
                  setProcessingMessage("Processing payment...");
                  break;
                case "IDLE":
                  // Don't update message yet - we need to check transaction
                  break;
              }
            }
          }

          // Payment completed successfully
          if (status === "SUCCESSFUL") {
            clearInterval(poll);
            setProcessingMessage("Payment successful!");
            
            const transactionId = transaction?.id || transaction?.transaction_code || checkoutId;
            console.log('[Payment] Payment verified - Transaction ID:', transactionId);
            setProcessingMessage("Saving receipt...");
            
            await completeCardPayment({ 
              checkoutId, 
              transactionId,
              status,
              amount: transaction?.amount || total,
              transaction 
            });
            return;
          }
          
          // Payment failed
          if (status === "FAILED" || status === "CANCELLED") {
            clearInterval(poll);
            const errorMsg = status === "CANCELLED" ? "Payment cancelled" : "Payment failed";
            setProcessingMessage(errorMsg);
            setTimeout(() => {
              setProcessing(false);
              setProcessingMessage("Processing...");
            }, 2000);
            return;
          }

          // Reader is IDLE - payment may have completed but transaction not yet recorded
          if (status === "IDLE") {
            idleCount++;
            if (idleCount <= 5) {
              setProcessingMessage("Verifying payment...");
            } else if (idleCount <= 10) {
              setProcessingMessage("Waiting for confirmation...");
            } else {
              setProcessingMessage("Still checking...");
            }
            
            // Give SumUp up to 30 seconds to record the transaction
            if (idleCount >= 15) {
              clearInterval(poll);
              activePollRef.current = null;
              console.log('[Payment] Reader IDLE but no transaction found after', idleCount, 'checks');
              setProcessingMessage("Payment not confirmed. Please check the reader screen.");
              setTimeout(() => {
                setProcessing(false);
                setProcessingMessage("Processing...");
              }, 3000);
              return;
            }
          } else {
            // Reader is active, reset idle counter
            idleCount = 0;
          }

          // Timeout
          if (attempts >= maxAttempts) {
            clearInterval(poll);
            console.log('[Payment] Timeout - checkoutId:', checkoutId, 'readerId:', readerId);
            setProcessingMessage("Payment timed out. Please check the reader.");
            if (checkoutId && readerId) {
              setPendingCheckoutId(checkoutId);
              setPendingReaderId(readerId);
            }
            setConnectionLostDialog(true);
          }
        } catch (err) {
          console.error("[Payment] Status poll error:", err);
          consecutiveErrors++;
          
          if (consecutiveErrors === 3) {
            setProcessingMessage("Connection issue - retrying...");
          }
          
          if (consecutiveErrors >= 10) {
            clearInterval(poll);
            console.error('[Payment] Connection lost - checkoutId:', checkoutId, 'readerId:', readerId);
            setProcessing(false);
            setProcessingMessage("Processing...");
            if (checkoutId && readerId) {
              setPendingCheckoutId(checkoutId);
              setPendingReaderId(readerId);
            }
            setConnectionLostDialog(true);
          }
        }
      }, 2000);
      activePollRef.current = poll;
    } catch (error) {
      console.error("Card payment error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error occurred";
      showToast(`Card payment failed: ${errorMsg}`, "error");
      setProcessing(false);
      setProcessingMessage("Processing...");
    }
  };

  const handleCancelPayment = async () => {
    console.log('[Payment] Cancel button clicked - pendingReaderId:', pendingReaderId, 'pendingCheckoutId:', pendingCheckoutId);

    // Stop polling
    if (activePollRef.current) {
      clearInterval(activePollRef.current);
      activePollRef.current = null;
    }

    // Try to terminate checkout on reader
    if (pendingReaderId) {
      try {
        setProcessingMessage("Cancelling payment...");
        const terminateRes = await fetch(`/api/sumup/terminate-checkout?reader_id=${pendingReaderId}`);
        console.log('[Payment] Terminate response status:', terminateRes.status);

        if (!terminateRes.ok) {
          const errorData = await terminateRes.json().catch(() => ({}));
          console.error('[Payment] Terminate failed:', errorData);
        } else {
          console.log('[Payment] Checkout terminated successfully');
        }
      } catch (err) {
        console.error('[Payment] Failed to terminate checkout on reader:', err);
      }
    }

    setProcessing(false);
    setProcessingMessage("Processing...");
    setPendingCheckoutId(null);
    setPendingReaderId(null);
  };

  const handleRetryPaymentCheck = async () => {
    console.log('[Payment] Retry button clicked');
    console.log('[Payment] Current state - checkoutId:', pendingCheckoutId, 'readerId:', pendingReaderId);
    
    if (!pendingCheckoutId || !pendingReaderId) {
      console.error('[Payment] Missing checkout or reader ID for retry');
      console.error('[Payment] State dump:', { pendingCheckoutId, pendingReaderId });
      showToast("Unable to check status - missing payment information", "error");
      return;
    }
    
    console.log('[Payment] Retrying status check for checkout:', pendingCheckoutId, 'reader:', pendingReaderId);
    setConnectionLostDialog(false);
    setProcessing(true);
    setProcessingMessage("Checking payment status...");

    try {
      const url = `/api/sumup/checkout-status?checkoutId=${pendingCheckoutId}&reader_id=${pendingReaderId}`;
      console.log('[Payment] Fetching:', url);
      const statusRes = await fetch(url);
      
      if (!statusRes.ok) {
        throw new Error('Failed to check payment status');
      }
      
      const statusData = await statusRes.json();
      const status = statusData.status || statusData.checkout?.status;
      const checkout = statusData.checkout;

      console.log('[Payment] Retry check - Status:', status);

      if (status === "PAID" || status === "SUCCESSFUL") {
        setProcessingMessage("Payment successful!");
        showToast("Payment was successful!", "success");
        
        const transactions = checkout?.transactions || [];
        if (transactions.length > 0) {
          const transaction = transactions[0];
          const transactionId = transaction?.id || checkout?.transaction_id || pendingCheckoutId;
          
          setProcessingMessage("Saving receipt...");
          await completeCardPayment({ 
            checkoutId: pendingCheckoutId, 
            transactionId,
            status,
            amount: checkout?.amount || total,
            checkout,
            transaction 
          });
        } else {
          showToast("Payment status unclear. Please check receipts.", "error");
          setProcessing(false);
          setProcessingMessage("Processing...");
        }
      } else if (status === "FAILED" || status === "CANCELLED" || status === "DECLINED" || status === "EXPIRED") {
        const errorMsg = status === "CANCELLED" 
          ? "Payment was cancelled" 
          : status === "DECLINED"
          ? "Card was declined"
          : "Payment failed";
        showToast(errorMsg, "error");
        setProcessing(false);
        setProcessingMessage("Processing...");
      } else if (status === "PENDING") {
        showToast("Payment is still processing on the reader. Please complete it there.", "info");
        setProcessing(false);
        setProcessingMessage("Processing...");
        // Re-open dialog to allow another check
        setTimeout(() => setConnectionLostDialog(true), 1000);
      } else {
        showToast("Payment status unknown. Please check the reader.", "error");
        setProcessing(false);
        setProcessingMessage("Processing...");
      }
    } catch (error) {
      console.error('[Payment] Retry check failed:', error);
      showToast("Unable to check payment status. Please verify on the reader.", "error");
      setProcessing(false);
      setProcessingMessage("Processing...");
      setConnectionLostDialog(true);
    }
  };

  const handleCancelPendingPayment = () => {
    setConnectionLostDialog(false);
    setPendingCheckoutId(null);
    setPendingReaderId(null);
  };

  const handleTerminalSelect = async (terminal: any) => {
    setSelectedTerminal(terminal);
    setTerminalDialogOpen(false);
    setProcessing(true);
    setProcessingMessage("Checking card reader...");

    let checkoutId: string | null = null;
    let readerId = terminal.reader_id;

    try {
      // Diagnose reader before payment - auto-fix stuck states
      try {
        const diagRes = await fetch(`/api/sumup/diagnose?reader_id=${terminal.reader_id}&fix=true`);
        if (diagRes.ok) {
          const diag = await diagRes.json();
          console.log('[Payment] Reader diagnosis:', diag);

          if (diag.reader_online === 'OFFLINE') {
            showToast("Card reader is offline. Please check it's powered on and connected to Wi-Fi.", "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
            return;
          }

          if (diag.reader_state === 'UPDATING_FIRMWARE') {
            showToast("Card reader is updating firmware. Please wait.", "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
            return;
          }

          // If we had to terminate a stuck checkout, wait a moment
          if (diag.terminate_result?.ok) {
            console.log('[Payment] Terminated stuck checkout, waiting for reader to reset...');
            setProcessingMessage("Clearing previous payment...");
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // Check battery level
          if (diag.battery_level !== undefined && diag.battery_level < 20) {
            showToast(`Reader battery low (${Math.round(diag.battery_level)}%). Please charge soon.`, "info");
          }
        }
      } catch (err) {
        console.warn('[Payment] Diagnosis failed, proceeding anyway:', err);
      }

      setProcessingMessage(`Sending to ${terminal.name}...`);

      // Create checkout on the reader
      const checkoutRes = await fetch("/api/sumup/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          currency: "GBP",
          reader_id: terminal.reader_id,
          description: "Penkey POS Purchase",
        }),
      });

      const checkoutData = await checkoutRes.json();
      console.log('[Payment] Checkout response:', checkoutData);

      if (!checkoutData.success) {
        const errorMsg = typeof checkoutData.error === 'string'
          ? checkoutData.error
          : checkoutData.error?.message || checkoutData.message || "Failed to start card payment";
        console.error('[Payment] Checkout creation failed:', errorMsg);

        // If server terminated a pending checkout, retry automatically
        if (checkoutData.retry) {
          console.log('[Payment] Retrying after terminating pending checkout...');
          setProcessingMessage("Clearing previous checkout, please wait...");
          await new Promise(resolve => setTimeout(resolve, 2000));
          handleCardPayment();
          return;
        }

        setProcessingMessage(errorMsg);
        setTimeout(() => {
          setProcessing(false);
          setProcessingMessage("Processing...");
        }, 3000);
        return;
      }

      checkoutId = checkoutData.checkout_id;
      console.log('[Payment] Checkout created:', checkoutId);

      if (!checkoutId) {
        console.error('[Payment] No checkout ID in response:', checkoutData);
        setProcessingMessage("Failed to get checkout ID from payment system");
        setTimeout(() => {
          setProcessing(false);
          setProcessingMessage("Processing...");
        }, 3000);
        return;
      }

      // Save to state immediately
      setPendingCheckoutId(checkoutId);
      setPendingReaderId(readerId);
      console.log('[Payment] Saved to state - checkoutId:', checkoutId, 'readerId:', readerId);
      setProcessingMessage("Waiting for card...");

      // Poll reader status + transaction status (up to 3 minutes)
      const maxAttempts = 90;
      let attempts = 0;
      let consecutiveErrors = 0;
      let lastReaderState = "";
      let idleCount = 0;

      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`/api/sumup/checkout-status?checkoutId=${checkoutId}&reader_id=${readerId}`);

          if (!statusRes.ok) {
            throw new Error(`Status check failed: ${statusRes.status}`);
          }

          const statusData = await statusRes.json();
          const status = statusData.status;
          const readerState = statusData.reader_state;
          const readerData = statusData.reader_data;
          const transaction = statusData.transaction;

          console.log(`[Payment] Poll ${attempts}/${maxAttempts} - status: ${status}, reader: ${readerState}, readerData:`, readerData);

          consecutiveErrors = 0;

          if (readerState && readerState !== lastReaderState) {
            lastReaderState = readerState;

            const readerMessage = readerData?.message || readerData?.display_message || readerData?.customer_message;

            if (readerMessage) {
              setProcessingMessage(readerMessage);
            } else {
              switch (readerState) {
                case "WAITING_FOR_CARD":
                  setProcessingMessage("Present card to reader...");
                  break;
                case "WAITING_FOR_PIN":
                  setProcessingMessage("Enter PIN on reader...");
                  break;
                case "SELECTING_TIP":
                  setProcessingMessage("Select tip amount...");
                  break;
                case "WAITING_FOR_SIGNATURE":
                  setProcessingMessage("Sign on reader...");
                  break;
                case "PROCESSING":
                  setProcessingMessage("Processing payment...");
                  break;
                case "IDLE":
                  break;
              }
            }
          }

          if (status === "SUCCESSFUL") {
            clearInterval(poll);
            setProcessingMessage("Payment successful!");

            const transactionId = transaction?.id || transaction?.transaction_code || checkoutId;
            console.log('[Payment] Payment verified - Transaction ID:', transactionId);
            setProcessingMessage("Saving receipt...");

            await completeCardPayment({
              checkoutId,
              transactionId,
              status,
              amount: transaction?.amount || total,
              transaction
            });
            return;
          }

          if (status === "FAILED" || status === "CANCELLED") {
            clearInterval(poll);
            const errorMsg = status === "CANCELLED" ? "Payment cancelled" : "Payment failed";
            setProcessingMessage(errorMsg);
            setTimeout(() => {
              setProcessing(false);
              setProcessingMessage("Processing...");
            }, 2000);
            return;
          }

          if (status === "IDLE") {
            idleCount++;
            if (idleCount <= 5) {
              setProcessingMessage("Verifying payment...");
            } else if (idleCount <= 10) {
              setProcessingMessage("Waiting for confirmation...");
            } else {
              setProcessingMessage("Still checking...");
            }

            if (idleCount >= 15) {
              clearInterval(poll);
              activePollRef.current = null;
              console.log('[Payment] Reader IDLE but no transaction found after', idleCount, 'checks');
              setProcessingMessage("Payment not confirmed. Please check the reader screen.");
              setTimeout(() => {
                setProcessing(false);
                setProcessingMessage("Processing...");
              }, 3000);
              return;
            }
          } else {
            idleCount = 0;
          }

          if (attempts >= maxAttempts) {
            clearInterval(poll);
            console.log('[Payment] Timeout - checkoutId:', checkoutId, 'readerId:', readerId);
            setProcessingMessage("Payment timed out. Please check the reader.");
            if (checkoutId && readerId) {
              setPendingCheckoutId(checkoutId);
              setPendingReaderId(readerId);
            }
            setConnectionLostDialog(true);
          }
        } catch (err) {
          console.error("[Payment] Status poll error:", err);
          consecutiveErrors++;

          if (consecutiveErrors === 3) {
            setProcessingMessage("Connection issue - retrying...");
          }

          if (consecutiveErrors >= 10) {
            clearInterval(poll);
            console.error('[Payment] Connection lost - checkoutId:', checkoutId, 'readerId:', readerId);
            setProcessing(false);
            setProcessingMessage("Processing...");
            if (checkoutId && readerId) {
              setPendingCheckoutId(checkoutId);
              setPendingReaderId(readerId);
            }
            setConnectionLostDialog(true);
          }
        }
      }, 2000);
      activePollRef.current = poll;
    } catch (error) {
      console.error("Card payment error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error occurred";
      setProcessingMessage(errorMsg);
      setTimeout(() => {
        setProcessing(false);
        setProcessingMessage("Processing...");
      }, 3000);
    }
  };

  const completeCardPayment = async (paymentResult: any) => {
    if (!session) return;

    try {
      const tempReceiptId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const receiptData = {
        id: tempReceiptId,
        lines,
        payment_method: "card",
        employee_id: session.employee.id,
        register_id: session.register.id,
        store_id: session.register.store_id,
        org_id: session.org_id,
        customer_id: ticketAssignment?.customer?.id || null,
        customer_name: ticketAssignment?.name || null,
        customer_email: ticketAssignment?.customer?.email || null,
        customer_phone: ticketAssignment?.customer?.phone || null,
        table_number: ticketAssignment?.type === 'table' ? ticketAssignment.name : null,
        payment_provider: "sumup",
        transaction_id: paymentResult.transactionId || paymentResult.checkoutId,
        checkout_id: paymentResult.checkoutId,
      };

      // Save locally first (offline-first)
      await putMany("receipts", [{
        ...receiptData,
        total,
        created_at: new Date().toISOString(),
        offline: false,
      }]);

      // Queue for sync via outbox (same as cash)
      await OutboxSyncService.addToOutbox('receipt', receiptData, session.org_id, false);

      clearCart();
      sessionStorage.removeItem("pos_ticket_assignment");
      setPaymentCompleted(true);
      setProcessing(false);
      router.push(`/payment/success?receipt_id=${tempReceiptId}&change=0`);
    } catch (error) {
      console.error("Failed to complete card payment:", error);
      showToast("Payment succeeded but failed to save receipt. Please check receipts.", "error");
      setProcessing(false);
    }
  };


  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col">
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/sell")}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <h1 className="font-semibold text-lg">Payment</h1>
        <div className="w-20"></div>
      </header>

      {/* Total Display Bar */}
      <div className="bg-penkey-orange text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-90">Total Amount</div>
            <div className="text-3xl font-bold">{formatCurrency(total)}</div>
          </div>
          <button 
            onClick={() => setItemsDialogOpen(true)}
            className="text-right hover:opacity-80 transition-opacity"
          >
            <div className="text-sm opacity-90 underline">{lines.length} items</div>
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Payment Methods */}
          <h2 className="text-xl font-bold text-white mb-4">Select Payment Method</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cash Payment Button */}
            <button
              onClick={() => setCashDialogOpen(true)}
              disabled={processing}
              className="bg-[#5d5d5d] hover:bg-[#6d6d6d] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg p-8 flex flex-col items-center justify-center gap-4 transition-colors min-h-[180px]"
            >
              <Banknote className="h-16 w-16" />
              <span className="text-2xl font-bold">Cash</span>
            </button>

            {/* Card Payment Button */}
            <button
              onClick={handleCardPayment}
              disabled={processing || !sumUpConfigured || !isOnline}
              className="relative bg-[#5d5d5d] hover:bg-[#6d6d6d] disabled:bg-[#4d4d4d] disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg p-8 flex flex-col items-center justify-center gap-4 transition-colors min-h-[180px]"
            >
              <CreditCard className="h-16 w-16" />
              <span className="text-2xl font-bold">Card</span>
              {/* Status dot - absolute positioned inside button */}
              {sumUpConfigured && (
                <div className={`absolute top-3 right-3 w-3 h-3 rounded-full border-2 border-[#5d5d5d] ${
                  isOnline ? 'bg-green-500' : 'bg-red-500'
                }`} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cash Tendered Dialog */}
      <CashTenderedDialog
        open={cashDialogOpen}
        onClose={() => setCashDialogOpen(false)}
        onConfirm={handleCashPayment}
        totalDue={total}
      />

      {/* Terminal Selection Dialog */}
      <Dialog open={terminalDialogOpen} onOpenChange={setTerminalDialogOpen}>
        <DialogContent className="max-w-2xl bg-[#3d3d3d] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              Select Card Reader
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-6">
            {availableTerminals.map((terminal) => (
              <button
                key={terminal.reader_id}
                onClick={() => handleTerminalSelect(terminal)}
                className={`relative bg-[#5d5d5d] hover:bg-[#6d6d6d] disabled:bg-[#4d4d4d] disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg p-8 flex flex-col items-center justify-center gap-4 transition-colors min-h-[180px] ${
                  terminal.status !== 'online' ? 'opacity-50' : ''
                }`}
              >
                <CreditCard className="h-16 w-16" />
                <span className="text-xl font-bold text-center">{terminal.name}</span>
                <span className="text-sm text-gray-400 text-center">{terminal.serial_number || terminal.reader_id}</span>
                {/* Status dot */}
                <div className={`absolute top-3 right-3 w-3 h-3 rounded-full border-2 border-[#5d5d5d] ${
                  terminal.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                {terminal.status !== 'online' && (
                  <span className="text-sm text-red-400">Offline</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setTerminalDialogOpen(false)}
              className="border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connection Lost Dialog */}
      <Dialog open={connectionLostDialog} onOpenChange={setConnectionLostDialog}>
        <DialogContent className="max-w-md bg-[#3d3d3d] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Connection Lost
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-gray-300">
              Lost connection to the payment system while processing your payment.
            </p>
            
            <div className="bg-yellow-900/20 border border-yellow-600/50 rounded-lg p-4">
              <p className="text-yellow-200 text-sm font-semibold mb-2">
                ⚠️ Important
              </p>
              <p className="text-yellow-100 text-sm">
                The payment may have been sent to the card reader. Please check the reader display before retrying.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-400">What would you like to do?</p>
              <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                <li><strong>Check Status:</strong> Verify if payment was completed</li>
                <li><strong>Cancel:</strong> Return to payment screen (check reader first)</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              onClick={handleCancelPendingPayment}
              variant="outline"
              className="flex-1 bg-transparent border-gray-600 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRetryPaymentCheck}
              className="flex-1 bg-penkey-orange hover:bg-penkey-orange/90 text-white"
            >
              Check Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Items Dialog */}
      <Dialog open={itemsDialogOpen} onOpenChange={setItemsDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-[#3d3d3d] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart Items ({lines.length})
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2">
            {lines.map((line) => (
              <div 
                key={line.id} 
                className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-3"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <div className="font-semibold text-white">{line.item_name}</div>
                    {line.variant_name && (
                      <div className="text-xs text-gray-400">{line.variant_name}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-penkey-orange">
                      {formatCurrency(line.unit_price * line.quantity)}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm text-gray-400">
                  <div>Qty: {line.quantity}</div>
                  <div>{formatCurrency(line.unit_price)} each</div>
                </div>

                {line.modifiers && line.modifiers.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Modifiers:</div>
                    {line.modifiers.map((mod, idx) => (
                      <div key={idx} className="text-xs text-gray-300 flex justify-between">
                        <span>+ {mod.name}</span>
                        <span>{formatCurrency(mod.price_adjustment)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {line.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="text-xs text-gray-400">Note:</div>
                    <div className="text-xs text-gray-300">{line.notes}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 bg-[#3d3d3d] pt-4 border-t border-gray-600 mt-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-lg font-bold text-white">Total</span>
              <span className="text-2xl font-bold text-penkey-orange">
                {formatCurrency(total)}
              </span>
            </div>
            <Button
              size="lg"
              className="w-full bg-gray-600 hover:bg-gray-700 text-white"
              onClick={() => setItemsDialogOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Processing Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#3d3d3d] rounded-lg p-8 text-center max-w-sm">
            <Loader2 className="h-16 w-16 text-penkey-orange animate-spin mx-auto mb-4" />
            <p className="text-xl font-bold text-white mb-2">{processingMessage}</p>
            <p className="text-sm text-gray-400 mb-6">Please do not close this window</p>
            <Button 
              variant="outline" 
              onClick={handleCancelPayment}
              className="border-gray-500 text-gray-300 hover:bg-gray-600 hover:text-white"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Payment
            </Button>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
