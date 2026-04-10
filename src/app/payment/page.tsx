"use client";

import { useState, useEffect } from "react";
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
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Processing...");
  const [paymentCompleted, setPaymentCompleted] = useState(false);
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
    window.addEventListener("offline", handleOffline);

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

    setProcessing(true);
    setProcessingMessage("Checking card reader...");

    try {
      // Fetch paired terminals from database
      const terminalsRes = await fetch("/api/sumup/terminals");
      const terminalsData = await terminalsRes.json();
      const terminals: any[] = terminalsData.terminals || [];
      
      if (!terminals || terminals.length === 0) {
        showToast("No card readers paired. Go to Settings → Payment Terminals to pair a reader.", "error");
        setProcessing(false);
        setProcessingMessage("Processing...");
        return;
      }

      // Prefer online terminal, fallback to first available
      const onlineTerminal = terminals.find((t: any) => t.status === "online") || terminals[0];
      
      // Check reader status before attempting payment
      try {
        setProcessingMessage("Checking reader status...");
        const readerStatusRes = await fetch(`/api/sumup/reader-status?reader_id=${onlineTerminal.reader_id}`);
        if (readerStatusRes.ok) {
          const readerStatus = await readerStatusRes.json();
          console.log('[Payment] Reader status:', readerStatus);
          
          if (readerStatus.device_status === 'OFFLINE') {
            showToast("Card reader is offline. Please ensure it's powered on and connected.", "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
            return;
          }
          
          if (readerStatus.state === 'UPDATING_FIRMWARE') {
            showToast("Card reader is updating. Please wait and try again.", "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
            return;
          }
        }
      } catch (err) {
        console.warn('[Payment] Could not check reader status, proceeding anyway:', err);
        // Continue - reader status check is optional
      }

      setProcessingMessage(`Sending to ${onlineTerminal.name}...`);
      showToast(`Sending payment request to ${onlineTerminal.name}...`, "info");

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
      if (!checkoutData.success) {
        const errorMsg = typeof checkoutData.error === 'string' 
          ? checkoutData.error 
          : checkoutData.error?.message || checkoutData.message || "Failed to start card payment";
        showToast(errorMsg, "error");
        setProcessing(false);
        setProcessingMessage("Processing...");
        return;
      }

      const checkoutId = checkoutData.checkout_id;
      setProcessingMessage("Waiting for card...");
      showToast("Waiting for card at reader...", "info");

      // Poll for payment completion (up to 90 seconds)
      const maxAttempts = 45;
      let attempts = 0;
      let lastStatus = "";
      
      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`/api/sumup/checkout-status?checkoutId=${checkoutId}&reader_id=${onlineTerminal.reader_id}`);
          
          if (!statusRes.ok) {
            if (statusRes.status === 404 && attempts < 3) {
              // Checkout might not be ready yet, wait a bit
              return;
            }
            throw new Error(`Status check failed: ${statusRes.status}`);
          }
          
          const statusData = await statusRes.json();
          const status = statusData.status || statusData.checkout?.status;
          const checkout = statusData.checkout;

          console.log('[Payment] Checkout status:', status, 'Attempt:', attempts);

          // Update user with status changes based on reader state
          if (status !== lastStatus && status) {
            lastStatus = status;
            
            // Update spinner message based on checkout status
            switch (status) {
              case "PENDING":
                setProcessingMessage("Processing card...");
                break;
              case "WAITING_FOR_CARD":
                setProcessingMessage("Waiting for card...");
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
            }
          }
          
          // Also check reader state from checkout data
          const readerState = checkout?.reader_state || checkout?.state;
          if (readerState && readerState !== lastStatus) {
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
            }
          }

          // Handle all possible SumUp status values
          if (status === "PAID" || status === "SUCCESSFUL") {
            clearInterval(poll);
            setProcessingMessage("Payment successful!");
            showToast("Payment successful!", "success");
            
            // Verify payment was actually processed
            const transactions = checkout?.transactions || [];
            if (transactions.length === 0) {
              console.error('[Payment] No transaction found in successful checkout');
              showToast("Payment status unclear. Please verify on the reader.", "error");
              setProcessing(false);
              setProcessingMessage("Processing...");
              return;
            }
            
            const transaction = transactions[0];
            const transactionId = transaction?.id || checkout?.transaction_id || checkoutId;
            const transactionStatus = transaction?.status;
            
            // Double-check transaction status
            if (transactionStatus && transactionStatus !== 'SUCCESSFUL' && transactionStatus !== 'PAID') {
              console.error('[Payment] Transaction status mismatch:', transactionStatus);
              showToast("Payment verification failed. Please check receipts.", "error");
              setProcessing(false);
              setProcessingMessage("Processing...");
              return;
            }
            
            console.log('[Payment] Payment verified - Transaction ID:', transactionId);
            setProcessingMessage("Saving receipt...");
            
            await completeCardPayment({ 
              checkoutId, 
              transactionId,
              status,
              amount: checkout?.amount || total,
              checkout,
              transaction 
            });
          } else if (status === "FAILED" || status === "CANCELLED" || status === "DECLINED" || status === "EXPIRED") {
            clearInterval(poll);
            const errorMsg = status === "CANCELLED" 
              ? "Payment cancelled by user" 
              : status === "DECLINED"
              ? "Card declined"
              : "Payment failed";
            showToast(errorMsg, "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            showToast("Payment timeout. Please check the reader and try again.", "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
          }
        } catch (err) {
          console.error("[Payment] Status poll error:", err);
          // Only fail after multiple consecutive errors
          if (attempts >= 5) {
            clearInterval(poll);
            showToast("Lost connection to payment system. Please check the reader and verify payment status.", "error");
            setProcessing(false);
            setProcessingMessage("Processing...");
          }
        }
      }, 2000);
    } catch (error) {
      console.error("Card payment error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error occurred";
      showToast(`Card payment failed: ${errorMsg}`, "error");
      setProcessing(false);
      setProcessingMessage("Processing...");
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
        payment_provider: "sumup",
        transaction_id: paymentResult.transactionId || paymentResult.checkoutId,
        checkout_id: paymentResult.checkoutId,
        employee_id: session.employee.id,
        register_id: session.register.id,
        store_id: session.register.store_id,
        org_id: session.org_id,
        customer_id: ticketAssignment?.customer?.id || null,
        customer_name: ticketAssignment?.name || null,
        customer_email: ticketAssignment?.customer?.email || null,
        customer_phone: ticketAssignment?.customer?.phone || null,
        table_number: ticketAssignment?.type === 'table' ? ticketAssignment.name : null,
        total,
        created_at: new Date().toISOString(),
        offline: false,
      };

      // Save locally first (offline-first)
      await putMany("receipts", [receiptData]);

      // Queue for server sync
      await OutboxSyncService.addToOutbox('receipt', receiptData, session.org_id, true);

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
              className={`${
                sumUpConfigured && isOnline
                  ? "bg-[#5d5d5d] hover:bg-[#6d6d6d]"
                  : "bg-[#4d4d4d] text-gray-500 cursor-not-allowed"
              } text-white rounded-lg p-8 flex flex-col items-center justify-center gap-4 transition-colors min-h-[180px]`}
            >
              <CreditCard className="h-16 w-16" />
              <span className="text-2xl font-bold">Card</span>
              {!sumUpConfigured && (
                <span className="text-sm opacity-75">Connect SumUp in Settings</span>
              )}
              {sumUpConfigured && !isOnline && (
                <span className="text-sm opacity-75">Offline</span>
              )}
              {sumUpConfigured && isOnline && (
                <span className="text-sm opacity-75">Ready</span>
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
            <p className="text-sm text-gray-400">Please do not close this window</p>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
