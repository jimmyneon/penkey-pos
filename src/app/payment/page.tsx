"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { ArrowLeft, Banknote, CreditCard, ShoppingCart, X, Loader2, UserPlus, Edit3, QrCode } from "lucide-react";
import { useCartStore } from "@/lib/store/cart-store";
import { TicketModal } from "../sell/ticket-modal";
import { CashTenderedDialog } from "./cash-tendered-dialog";
import { ManualPaymentDialog } from "./manual-payment-dialog";
import { AssignTicketDialog } from "../sell/assign-ticket-dialog";
import { QRScanner } from "@/components/QRScanner";
import { PerksCustomerPanel } from "@/components/PerksCustomerPanel";
import { scanQRCode, recordVisit, redeemVoucher, BeanRules } from "@/lib/services/perks";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { OutboxSyncService } from "@/lib/services/outbox-sync";
import { CartSyncService } from "@/lib/services/cart-sync";
import { putMany } from "@/lib/idb/db";
import { getSumUpCredentials, hasSumUpCredentials, storeSumUpCredentials } from "@/lib/services/sumup-credentials";
import { playPaymentInitSound, playPaymentProcessingSound, playPaymentSuccessSound, playPaymentFailedSound, setSoundEnabledCheck } from "@/lib/utils/sounds";

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
  const [assignTicketOpen, setAssignTicketOpen] = useState(false);
  const [manualPaymentDialogOpen, setManualPaymentDialogOpen] = useState(false);
  const [availableTerminals, setAvailableTerminals] = useState<any[]>([]);
  const [cachedTerminals, setCachedTerminals] = useState<any[]>([]); // Cache from page mount
  const [selectedTerminal, setSelectedTerminal] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Processing...");
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [connectionLostDialog, setConnectionLostDialog] = useState(false);
  const [pendingCheckoutId, setPendingCheckoutId] = useState<string | null>(null);
  const [pendingReaderId, setPendingReaderId] = useState<string | null>(null);
  const activePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paymentCompletedRef = useRef(false);
  const [ticketAssignment, setTicketAssignment] = useState<{ type: 'customer' | 'table'; customer?: any; name: string } | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [perksCustomer, setPerksCustomer] = useState<any>(null);
  const [perksBeanRules, setPerksBeanRules] = useState<any>(null);
  const [scanningQR, setScanningQR] = useState(false);
  const { lines, addLine, updateQuantity, removeLine, getSubtotal, getTaxTotal, getTotal, clearCart, applyVoucher, removeVoucher } = useCartStore();
  
  // SumUp API key credential check
  const [sumUpConfigured, setSumUpConfigured] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [defaultDiningOption, setDefaultDiningOption] = useState<'eat-in' | 'takeaway'>('takeaway');
  const [storeInfo, setStoreInfo] = useState({
    name: "Penkey Delicaf & Gifts",
    address: "5 New Street, Lymington",
    phone: "WhatsApp Pre-orders: 01590 619472"
  });

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Load sound enabled setting, default dining option, and store info
    const loadSettings = async () => {
      try {
        const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const registerId = session.register?.id;
          const storeId = session.register?.store_id;
          
          if (registerId) {
            const { registerSettings } = await import("@/lib/services/register-settings");
            const settings = await registerSettings.get(registerId);
            setSoundEnabled(settings.sound_enabled);
            setSoundEnabledCheck(() => settings.sound_enabled);
            // Load default dining option
            if (settings.default_dining_option) {
              setDefaultDiningOption(settings.default_dining_option);
            }
          }
          
          // Load store info from database or localStorage cache
          if (storeId) {
            // Try localStorage cache first
            const cachedStore = localStorage.getItem(`store_info_${storeId}`);
            if (cachedStore) {
              const store = JSON.parse(cachedStore);
              setStoreInfo({
                name: store.name || "Penkey Delicaf & Gifts",
                address: store.address || "5 New Street, Lymington",
                phone: store.phone || "WhatsApp Pre-orders: 01590 619472"
              });
            }
            
            // Fetch fresh from database if online
            if (navigator.onLine) {
              try {
                const response = await fetch(`/api/stores/${storeId}`);
                if (response.ok) {
                  const store = await response.json();
                  const storeData = {
                    name: store.name || "Penkey Delicaf & Gifts",
                    address: store.address || "5 New Street, Lymington",
                    phone: store.phone || "WhatsApp Pre-orders: 01590 619472"
                  };
                  setStoreInfo(storeData);
                  // Cache for offline use
                  localStorage.setItem(`store_info_${storeId}`, JSON.stringify(store));
                }
              } catch (err) {
                console.warn('Failed to fetch store info, using cached/default:', err);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();

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

  // Load Perks bean rules
  useEffect(() => {
    const loadPerksBeanRules = async () => {
      try {
        const response = await fetch("/api/settings/perks");
        if (response.ok) {
          const data = await response.json();
          setPerksBeanRules(data.beanRules);
        }
      } catch (error) {
        console.error("Failed to load Perks bean rules:", error);
      }
    };
    loadPerksBeanRules();
  }, []);

  // Load ticket assignment from sessionStorage
  useEffect(() => {
    const savedAssignment = sessionStorage.getItem("ticket_assignment");
    if (savedAssignment) {
      setTicketAssignment(JSON.parse(savedAssignment));
    }
  }, []);

  const handleQRScan = async (qrData: string) => {
    console.log("[Payment QR Scan] Starting QR scan process");
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    if (!sessionData) {
      console.error("[Payment QR Scan] No session data");
      return;
    }
    
    const session = JSON.parse(sessionData);
    if (!session?.org_id) {
      console.error("[Payment QR Scan] No session org_id");
      return;
    }
    
    setScanningQR(true);
    
    try {
      const apiResponse = await scanQRCode(session.org_id, qrData);
      
      if (!apiResponse) {
        throw new Error("No customer data returned from API");
      }
      
      const customer = {
        id: apiResponse.customer?.id || '',
        name: apiResponse.customer?.name || '',
        email: apiResponse.customer?.email || '',
        phone: apiResponse.customer?.phone || '',
        beanBalance: apiResponse.bean_balance?.current_beans || 0,
        activeVouchers: apiResponse.vouchers || [],
        canAwardBeanToday: apiResponse.can_award_bean || false,
      };
      
      setPerksCustomer(customer);
      setQrScannerOpen(false);
      
      // Set ticket assignment for payment processing
      setTicketAssignment({
        type: 'customer',
        name: customer.name,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          beanBalance: customer.beanBalance,
        }
      });
      
      // Save to sessionStorage for persistence
      sessionStorage.setItem("ticket_assignment", JSON.stringify({
        type: 'customer',
        name: customer.name,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          beanBalance: customer.beanBalance,
        }
      }));
      
      showToast(`Customer ${customer.name} linked`, 'success');
    } catch (error: any) {
      console.error("[Payment QR Scan] Error:", error);
      showToast(error.message || "Failed to scan QR code", 'error');
    } finally {
      setScanningQR(false);
    }
  };

  const handleAwardBean = async (rules: BeanRules) => {
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    if (!sessionData) return { beansAwarded: 0, newBalance: perksCustomer?.beanBalance || 0 };
    
    const session = JSON.parse(sessionData);
    if (!session?.org_id || !perksCustomer) return { beansAwarded: 0, newBalance: perksCustomer?.beanBalance || 0 };

    try {
      const result = await recordVisit(session.org_id, {
        userId: perksCustomer.id,
        beanRules: rules,
        menuItems: lines.map(line => ({ name: line.item_name, price: line.unit_price })),
        staffId: session.employee.id,
        locationId: session.register.store_id,
      });

      if (result) {
        showToast(`Awarded ${result.beansAwarded} bean(s)! New balance: ${result.newBalance}`, "success");
        setPerksCustomer({
          ...perksCustomer,
          beanBalance: result.newBalance,
          canAwardBeanToday: false,
        });
        return result;
      }
      return { beansAwarded: 0, newBalance: perksCustomer?.beanBalance || 0 };
    } catch (error: any) {
      console.error("Award bean error:", error);
      showToast(error.message || "Failed to award beans", "error");
      return { beansAwarded: 0, newBalance: perksCustomer?.beanBalance || 0 };
    }
  };

  const handleRedeemVoucher = async (voucherId: string) => {
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    if (!sessionData) return;
    
    const session = JSON.parse(sessionData);
    if (!session?.org_id) return;

    try {
      const result = await redeemVoucher(session.org_id, {
        voucher_id: voucherId,
        staff_id: session.employee.id,
      });

      if (result) {
        showToast("Voucher redeemed successfully!", "success");
        setPerksCustomer({
          ...perksCustomer,
          activeVouchers: perksCustomer.activeVouchers.filter((v: any) => v.id !== voucherId),
        });
      }
    } catch (error: any) {
      console.error("Redeem voucher error:", error);
      showToast(error.message || "Failed to redeem voucher", "error");
    }
  };

  const handleApplyVoucherToCart = (voucher: any) => {
    if (lines.length === 0) {
      showToast("Cart is empty. Add items before applying voucher.", "error");
      return;
    }

    let targetLineId: string | null = null;

    if (voucher.discountType === 'free_modifier') {
      // Find items with matching modifiers
      targetLineId = lines.find(line => 
        line.modifiers.some(mod => 
          mod.name.toLowerCase().includes(voucher.itemType?.toLowerCase() || '')
        )
      )?.id || null;

      if (!targetLineId) {
        showToast(`No items with "${voucher.itemType}" modifier in cart`, "error");
        return;
      }
    } else if (voucher.discountType === 'free_item') {
      // Find items matching itemType/category
      targetLineId = lines.find(line => {
        const itemName = line.item_name.toLowerCase();
        const matchesItem = voucher.itemType && itemName.includes(voucher.itemType.toLowerCase());
        const matchesCategory = voucher.category && itemName.includes(voucher.category.toLowerCase());
        return matchesItem || matchesCategory;
      })?.id || null;

      if (!targetLineId) {
        showToast(`No matching "${voucher.itemType || voucher.category}" items in cart`, "error");
        return;
      }
    } else if (voucher.discountType === 'percentage' || voucher.discountType === 'fixed') {
      // Apply to first item or cart total - for now apply to first item
      targetLineId = lines[0]?.id || null;
      
      if (!targetLineId) {
        showToast("No items in cart to apply discount", "error");
        return;
      }
    }

    if (targetLineId) {
      applyVoucher(targetLineId, voucher);
      showToast(`Voucher "${voucher.name}" applied to cart`, "success");
    }
  };

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

  // Initialize terminal selection dialog with cached data from page mount
  useEffect(() => {
    if (!terminalDialogOpen) {
      return;
    }

    // Use cached data immediately
    if (cachedTerminals.length > 0 && availableTerminals.length === 0) {
      setAvailableTerminals(cachedTerminals);
      console.log('[Payment] Using cached terminal data from page mount:', cachedTerminals);
    }

    // Backup: Check status once as backup to ensure we have fresh data
    const checkTerminalStatus = async () => {
      try {
        const sourceTerminals = cachedTerminals.length > 0 ? cachedTerminals : availableTerminals;

        if (sourceTerminals.length === 0) {
          // If no cached data, fetch from API
          const terminalsRes = await fetch("/api/sumup/terminals");
          const terminalsData = await terminalsRes.json();
          const terminals: any[] = terminalsData.terminals || [];
          if (terminals.length > 0) {
            sourceTerminals.push(...terminals);
          }
        }

        const updatedTerminals = await Promise.all(
          sourceTerminals.map(async (terminal) => {
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

    checkTerminalStatus();
  }, [terminalDialogOpen, cachedTerminals, availableTerminals]);

  // Wake up terminals on page mount by polling their status
  useEffect(() => {
    if (!sumUpConfigured || !isOnline) {
      return;
    }

    const wakeUpTerminals = async () => {
      console.log('[Payment] Wake up terminals starting...');
      try {
        const terminalsRes = await fetch("/api/sumup/terminals");
        const terminalsData = await terminalsRes.json();
        const terminals: any[] = terminalsData.terminals || [];

        console.log('[Payment] Fetched', terminals.length, 'terminals from database:', terminals.map((t: any) => t.name));

        if (!terminals || terminals.length === 0) {
          console.log('[Payment] No terminals found, skipping wake-up');
          return;
        }

        // Check each terminal's status to wake them up and cache the data
        const updatedTerminals = await Promise.all(
          terminals.map(async (terminal) => {
            try {
              console.log('[Payment] Waking up terminal:', terminal.name, terminal.reader_id);
              const diagRes = await fetch(`/api/sumup/diagnose?reader_id=${terminal.reader_id}`);
              if (diagRes.ok) {
                const diag = await diagRes.json();
                console.log('[Payment] Terminal', terminal.name, 'status:', diag.reader_online, 'battery:', diag.battery_level);
                return {
                  ...terminal,
                  status: diag.reader_online === 'ONLINE' ? 'online' : 'offline',
                  battery_level: diag.battery_level,
                };
              }
              console.warn('[Payment] Terminal', terminal.name, 'diagnose failed:', diagRes.status);
              return terminal;
            } catch (error) {
              console.warn("[Payment] Failed to wake up terminal:", terminal.name, error);
              return terminal;
            }
          })
        );

        // Cache the terminal data for dialog use
        console.log('[Payment] Caching', updatedTerminals.length, 'terminals for dialog use:', updatedTerminals.map((t: any) => ({ name: t.name, status: t.status, battery: t.battery_level })));
        setCachedTerminals(updatedTerminals);
      } catch (error) {
        console.error("[Payment] Failed to fetch terminals for wake-up:", error);
      }
    };

    // Wake up terminals immediately on page mount
    wakeUpTerminals();
  }, [sumUpConfigured, isOnline]);

  const total = getTotal();

  const handleCashPayment = async (amount: number) => {
    if (!session) return;

    // Reset payment completion flag for new payment
    paymentCompletedRef.current = false;

    playPaymentInitSound();
    setProcessing(true);
    setCashDialogOpen(false);
    playPaymentProcessingSound();

    const change = amount - total;
    console.log("[Payment] Cash tendered:", amount);
    console.log("[Payment] Total:", total);
    console.log("[Payment] Change calculated:", change);

    // Guard: Prevent multiple calls for the same payment
    if (paymentCompletedRef.current) {
      console.log('[Payment] Payment already completed, skipping duplicate call');
      return;
    }
    paymentCompletedRef.current = true;

    // Generate stable temp/idempotency ID up-front so it can be used as
    // the idempotency key on the server and as the IndexedDB primary key.
    const tempReceiptId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const receiptData = {
      id: tempReceiptId, // ✅ Idempotency key — prevents duplicate receipts on outbox retry
      lines: lines,
      payment_method: "cash",
      cash_tendered: amount,
      employee_id: session.employee.id,
      register_id: session.register.id,
      store_id: session.register.store_id,
      org_id: session.org_id,
      created_at: new Date().toISOString(),
      // Customer data from ticket assignment
      customer_id: ticketAssignment?.customer?.id || null,
      customer_name: ticketAssignment?.type === 'customer' ? ticketAssignment.name : null,
      customer_email: ticketAssignment?.customer?.email || null,
      customer_phone: ticketAssignment?.customer?.phone || null,
      table_number: ticketAssignment?.type === 'table' ? ticketAssignment.name : null,
      // Use global default dining option setting (can be overridden by table assignment)
      dining_option: ticketAssignment?.type === 'table' ? 'eat-in' : defaultDiningOption,
    };
    
    console.log('[Payment] Creating receipt with customer data:', {
      customer_id: receiptData.customer_id,
      customer_name: receiptData.customer_name,
      customer_email: receiptData.customer_email,
      customer_phone: receiptData.customer_phone,
    });

    try {
      const changeAmount = change.toFixed(2);

      // Calculate subtotal and tax from lines
      const subtotal = lines.reduce((sum, line) => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        return sum + (line.unit_price + modifiersTotal) * line.quantity;
      }, 0);

      const taxTotal = lines.reduce((sum, line) => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        return sum + (line.unit_price + modifiersTotal) * line.quantity * (line.tax_rate || 0);
      }, 0);

      // Use store info from state (loaded from database)
      const storeName = storeInfo.name;
      const storeAddress = storeInfo.address;
      const storePhone = storeInfo.phone;
      
      // Add line_total to each line for printing
      const linesWithTotals = lines.map(line => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        const lineTotal = (line.unit_price + modifiersTotal) * line.quantity;
        return {
          ...line,
          line_total: lineTotal
        };
      });
      
      // OFFLINE-FIRST: Save locally immediately for instant response
      // Include ALL fields needed for printing
      // Note: receiptData already includes id (tempReceiptId) used as idempotency key.
      const receiptToSave = {
        ...receiptData,
        lines: linesWithTotals,
        created_at: new Date().toISOString(),
        total: total,
        subtotal: subtotal,
        tax_total: taxTotal,
        change: change,
        change_amount: change,
        cash_change: change,
        paid_amount: amount,
        offline: true,
        // Add formatted fields for printing
        store_name: storeName,
        store_address: storeAddress,
        store_phone: storePhone,
        employee_name: session.employee.name,
        register_name: session.register.name,
        date: new Date().toLocaleDateString("en-GB"),
        time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        receipt_number: 0, // Will be set by server
      };
      console.log('[Payment] Saving receipt to IndexedDB:', receiptToSave);
      console.log('[Payment] Receipt id field:', receiptToSave.id);

      await Promise.all([
        putMany("receipts", [receiptToSave]),
        OutboxSyncService.addToOutbox('receipt', receiptData, session.org_id, true) // Trigger immediate sync
      ]);
      
      console.log('[Payment] Receipt saved locally and queued for sync:', tempReceiptId);

      // Clear cart and ticket assignment immediately
      clearCart();
      CartSyncService.clearCart(); // Clear from database too
      sessionStorage.removeItem("pos_ticket_assignment");

      // Navigate immediately. Set a flag to prevent the empty-cart-redirect effect.
      setPaymentCompleted(true);
      console.log("[Payment] Navigating to success with change:", changeAmount);
      console.log("[Payment] Full URL:", `/payment/success?receipt_id=${tempReceiptId}&change=${changeAmount}&offline=true`);
      router.push(`/payment/success?receipt_id=${tempReceiptId}&change=${changeAmount}&offline=true`);

      // We don't setProcessing(false) here because the component will unmount upon navigation.
      // Note: Outbox service handles background sync automatically - no manual sync needed
    } catch (err: any) {
      console.error("[Payment] Failed to save receipt:", err);
      showToast(err.message || "Failed to complete sale", "error");
      playPaymentFailedSound();
      setProcessing(false);
    }
  };

  const handleManualPayment = async (method: "cash" | "card") => {
    if (!session) return;

    // Reset payment completion flag for new payment
    paymentCompletedRef.current = false;

    playPaymentInitSound();
    setProcessing(true);
    setManualPaymentDialogOpen(false);
    playPaymentProcessingSound();

    console.log("[Payment] Manual payment - method:", method);

    // Guard: Prevent multiple calls for the same payment
    if (paymentCompletedRef.current) {
      console.log('[Payment] Payment already completed, skipping duplicate call');
      return;
    }
    paymentCompletedRef.current = true;

    // Generate stable temp/idempotency ID up-front so it can be used as
    // the idempotency key on the server and as the IndexedDB primary key.
    const tempReceiptId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const receiptData = {
      id: tempReceiptId, // ✅ Idempotency key — prevents duplicate receipts on outbox retry
      lines: lines,
      payment_method: `manual_${method}`,
      cash_tendered: method === "cash" ? total : 0,
      employee_id: session.employee.id,
      register_id: session.register.id,
      store_id: session.register.store_id,
      org_id: session.org_id,
      created_at: new Date().toISOString(),
      customer_id: ticketAssignment?.customer?.id || null,
      customer_name: ticketAssignment?.type === 'customer' ? ticketAssignment.name : null,
      customer_email: ticketAssignment?.customer?.email || null,
      customer_phone: ticketAssignment?.customer?.phone || null,
      table_number: ticketAssignment?.type === 'table' ? ticketAssignment.name : null,
      dining_option: ticketAssignment?.type === 'table' ? 'eat-in' : defaultDiningOption,
    };
    
    console.log('[Payment] Creating manual receipt with method:', method);

    try {

      const subtotal = lines.reduce((sum, line) => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        return sum + (line.unit_price + modifiersTotal) * line.quantity;
      }, 0);

      const taxTotal = lines.reduce((sum, line) => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        return sum + (line.unit_price + modifiersTotal) * line.quantity * (line.tax_rate || 0);
      }, 0);

      const storeName = storeInfo.name;
      const storeAddress = storeInfo.address;
      const storePhone = storeInfo.phone;
      
      const linesWithTotals = lines.map(line => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        const lineTotal = (line.unit_price + modifiersTotal) * line.quantity;
        return {
          ...line,
          line_total: lineTotal
        };
      });
      
      // Note: receiptData already includes id (tempReceiptId) used as idempotency key.
      const receiptToSave = {
        ...receiptData,
        lines: linesWithTotals,
        created_at: new Date().toISOString(),
        total: total,
        subtotal: subtotal,
        tax_total: taxTotal,
        change: 0,
        change_amount: 0,
        cash_change: 0,
        paid_amount: total,
        offline: true,
        store_name: storeName,
        store_address: storeAddress,
        store_phone: storePhone,
        employee_name: session.employee.name,
        register_name: session.register.name,
        date: new Date().toLocaleDateString("en-GB"),
        time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        receipt_number: 0,
      };
      console.log('[Payment] Saving manual receipt to IndexedDB:', receiptToSave);

      await Promise.all([
        putMany("receipts", [receiptToSave]),
        OutboxSyncService.addToOutbox('receipt', receiptData, session.org_id, true)
      ]);
      
      console.log('[Payment] Manual receipt saved locally and queued for sync:', tempReceiptId);

      clearCart();
      CartSyncService.clearCart();
      sessionStorage.removeItem("pos_ticket_assignment");

      setPaymentCompleted(true);
      console.log("[Payment] Navigating to success (manual payment)");
      router.push(`/payment/success?receipt_id=${tempReceiptId}&change=0&offline=true`);

    } catch (err: any) {
      console.error("[Payment] Failed to save manual receipt:", err);
      showToast(err.message || "Failed to complete sale", "error");
      playPaymentFailedSound();
      setProcessing(false);
    }
  };

  const handleCardPayment = async () => {
    if (!session) return;

    // Reset payment completion flag for new payment
    paymentCompletedRef.current = false;

    playPaymentInitSound();

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

      // If multiple terminals, show selection dialog with cached data
      if (terminals.length > 1) {
        setAvailableTerminals(cachedTerminals.length > 0 ? cachedTerminals : terminals);
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

      // Create checkout on the reader with timeout and retry logic
      let checkoutRes: Response | null = null;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          checkoutRes = await fetch("/api/sumup/create-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: total,
              currency: "GBP",
              reader_id: onlineTerminal.reader_id,
              description: "Penkey POS Purchase",
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (checkoutRes.ok || retryCount === maxRetries) {
            break;
          }

          retryCount++;
          console.log(`[Payment] Checkout creation failed, retry ${retryCount}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log(`[Payment] Checkout creation timeout, retry ${retryCount + 1}/${maxRetries}`);
            retryCount++;
            if (retryCount <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          }
          throw error;
        }
      }

      if (!checkoutRes) {
        throw new Error("Failed to create checkout after retries");
      }

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
      }, 1000);
      activePollRef.current = poll;
    } catch (error) {
      console.error("Card payment error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error occurred";
      showToast(`Card payment failed: ${errorMsg}`, "error");
      playPaymentFailedSound();
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
        playPaymentSuccessSound();
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

      // Create checkout on the reader with timeout and retry logic
      let checkoutRes: Response | null = null;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          checkoutRes = await fetch("/api/sumup/create-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: total,
              currency: "GBP",
              reader_id: terminal.reader_id,
              description: "Penkey POS Purchase",
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (checkoutRes.ok || retryCount === maxRetries) {
            break;
          }

          retryCount++;
          console.log(`[Payment] Checkout creation failed, retry ${retryCount}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log(`[Payment] Checkout creation timeout, retry ${retryCount + 1}/${maxRetries}`);
            retryCount++;
            if (retryCount <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          }
          throw error;
        }
      }

      if (!checkoutRes) {
        throw new Error("Failed to create checkout after retries");
      }

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
            playPaymentSuccessSound();

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
      }, 1000);
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

    // Guard: Prevent multiple calls for the same payment
    if (paymentCompletedRef.current) {
      console.log('[Payment] Payment already completed, skipping duplicate call');
      return;
    }
    paymentCompletedRef.current = true;

    try {
      const tempReceiptId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate subtotal and tax from lines
      const subtotal = lines.reduce((sum, line) => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        return sum + (line.unit_price + modifiersTotal) * line.quantity;
      }, 0);

      const taxTotal = lines.reduce((sum, line) => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        return sum + (line.unit_price + modifiersTotal) * line.quantity * (line.tax_rate || 0);
      }, 0);

      // Use store info from state (loaded from database)
      const storeName = storeInfo.name;
      const storeAddress = storeInfo.address;
      const storePhone = storeInfo.phone;
      
      const receiptData = {
        id: tempReceiptId,
        lines,
        payment_method: "card",
        employee_id: session.employee.id,
        register_id: session.register.id,
        store_id: session.register.store_id,
        org_id: session.org_id,
        created_at: new Date().toISOString(),
        customer_id: ticketAssignment?.customer?.id || null,
        customer_name: ticketAssignment?.type === 'customer' ? ticketAssignment.name : null,
        customer_email: ticketAssignment?.customer?.email || null,
        customer_phone: ticketAssignment?.customer?.phone || null,
        table_number: ticketAssignment?.type === 'table' ? ticketAssignment.name : null,
        // Use global default dining option setting (can be overridden by table assignment)
        dining_option: ticketAssignment?.type === 'table' ? 'eat-in' : defaultDiningOption,
        payment_provider: "sumup",
        transaction_id: paymentResult.transactionId || paymentResult.checkoutId,
        checkout_id: paymentResult.checkoutId,
      };

      // Add line_total to each line for printing
      const linesWithTotals = lines.map(line => {
        const modifiersTotal = (line.modifiers || []).reduce((s: number, m: any) => s + (m.price_adjustment || 0), 0);
        const lineTotal = (line.unit_price + modifiersTotal) * line.quantity;
        return {
          ...line,
          line_total: lineTotal
        };
      });
      
      // Save locally first (offline-first) with ALL fields needed for printing
      await putMany("receipts", [{
        ...receiptData,
        lines: linesWithTotals,
        total,
        subtotal: subtotal,
        tax_total: taxTotal,
        created_at: new Date().toISOString(),
        offline: false,
        // Add formatted fields for printing
        store_name: storeName,
        store_address: storeAddress,
        store_phone: storePhone,
        employee_name: session.employee.name,
        register_name: session.register.name,
        date: new Date().toLocaleDateString("en-GB"),
        time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        receipt_number: 0, // Will be set by server
        paid_amount: total,
        change_amount: 0,
        cash_change: 0,
      }]);

      // Queue for sync via outbox and trigger immediate sync
      await OutboxSyncService.addToOutbox('receipt', receiptData, session.org_id, true);
      
      console.log('[Payment] Card receipt saved locally and queued for sync:', tempReceiptId);

      clearCart();
      CartSyncService.clearCart(); // Clear from database too
      sessionStorage.removeItem("pos_ticket_assignment");
      setPaymentCompleted(true);
      setProcessing(false);
      router.push(`/payment/success?receipt_id=${tempReceiptId}&change=0`);
    } catch (error) {
      console.error("Failed to complete card payment:", error);
      showToast("Payment succeeded but failed to save receipt. Please check receipts.", "error");
      playPaymentFailedSound();
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
          className="text-white hover:bg-white/10 p-2"
          title="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAssignTicketOpen(true)}
            className="text-white hover:bg-white/10 p-2"
            title="Assign"
          >
            <UserPlus className="h-5 w-5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setQrScannerOpen(true)}
            className="text-white hover:bg-white/10 p-2"
            title="Scan Customer"
          >
            <QrCode className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Total Display Bar */}
      <div className="bg-penkey-orange text-white px-4 py-4">
        <div className="flex items-center">
          <button
            onClick={() => setItemsDialogOpen(true)}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="text-xs uppercase tracking-wide opacity-90">Total Amount</div>
            <div className="text-3xl font-bold">{formatCurrency(total)}</div>
          </button>
          
          <div className="flex-1"></div>
          
          {/* Dining Option Toggle - aligned with Card button below */}
          {ticketAssignment?.type !== 'table' && (
            <button
              onClick={() => setDefaultDiningOption(defaultDiningOption === 'eat-in' ? 'takeaway' : 'eat-in')}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg font-semibold transition-all whitespace-nowrap mr-3"
            >
              {defaultDiningOption === 'eat-in' ? 'Eat In' : 'Takeaway'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Payment Methods */}
          <h2 className="text-xl font-bold text-white mb-4">Select Payment Method</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {/* Manual Payment Button */}
            <button
              onClick={() => setManualPaymentDialogOpen(true)}
              disabled={processing}
              className="bg-[#5d5d5d] hover:bg-[#6d6d6d] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg p-8 flex flex-col items-center justify-center gap-4 transition-colors min-h-[180px]"
            >
              <Edit3 className="h-16 w-16" />
              <span className="text-2xl font-bold">Manual</span>
              <span className="text-xs text-gray-400 text-center">Record only</span>
            </button>
          </div>

          {/* Cancel Button - spans full width */}
          <button
            onClick={() => router.push('/sell')}
            disabled={processing}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg py-4 px-8 text-xl font-bold transition-colors mt-3"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Cash Tendered Dialog */}
      <CashTenderedDialog
        open={cashDialogOpen}
        onClose={() => setCashDialogOpen(false)}
        onConfirm={handleCashPayment}
        totalDue={total}
      />

      {/* Manual Payment Dialog */}
      <ManualPaymentDialog
        open={manualPaymentDialogOpen}
        onClose={() => setManualPaymentDialogOpen(false)}
        onConfirm={handleManualPayment}
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
                {/* Battery level */}
                {terminal.battery_level !== undefined && (
                  <span className="text-sm text-gray-400">
                    Battery: {Math.round(terminal.battery_level)}%
                  </span>
                )}
                {/* Status dot */}
                <div className={`absolute top-3 right-3 w-3 h-3 rounded-full border-2 border-[#5d5d5d] ${
                  terminal.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                }`} />
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

      {/* Cart Modal */}
      <TicketModal
        open={itemsDialogOpen}
        onClose={() => setItemsDialogOpen(false)}
        lines={lines}
        updateQuantity={updateQuantity}
        removeLine={removeLine}
        getSubtotal={getSubtotal}
        getTaxTotal={getTaxTotal}
        getTotal={getTotal}
        onCheckout={() => {}}
        onSave={() => {}}
        onClearAll={() => {}}
        onPrint={() => {}}
        ticketAssignment={ticketAssignment}
        onCustomerClick={(customer) => {
          setPerksCustomer(customer);
        }}
      />

      {/* Assign Ticket Dialog */}
      <AssignTicketDialog
        open={assignTicketOpen}
        onClose={() => setAssignTicketOpen(false)}
        onAssign={(assignee) => {
          setTicketAssignment(assignee);
          sessionStorage.setItem("pos_ticket_assignment", JSON.stringify(assignee));
          setAssignTicketOpen(false);
          showToast(`Assigned to ${assignee.name}`, "success");
        }}
      />

      {/* QR Scanner */}
      {qrScannerOpen && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setQrScannerOpen(false)}
        />
      )}

      {/* Perks Customer Panel */}
      {perksCustomer && (
        <PerksCustomerPanel
          customer={perksCustomer}
          onClose={() => setPerksCustomer(null)}
          onAwardBean={handleAwardBean}
          onRedeemVoucher={handleRedeemVoucher}
          staffId={session?.employee?.id || ""}
          locationId={session?.register?.store_id || ""}
          currentCartItems={lines.map(line => ({ name: line.item_name, price: line.unit_price }))}
          beanRules={perksBeanRules}
          onApplyVoucherToCart={handleApplyVoucherToCart}
        />
      )}

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
