"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { CheckCircle, Printer, Home, StopCircle, Loader2, Star } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { QRCodeSVG } from 'qrcode.react';
import { useCartStore } from "@/lib/store/cart-store";
import { dataCache } from "@/lib/services/data-cache";
import { registerSettings } from "@/lib/services/register-settings";
import { playPaymentSuccessSound, setSoundEnabledCheck } from "@/lib/utils/sounds";
import { containsFoodItems } from "@/lib/utils/food-detection";

function PaymentSuccessContent() {
  console.log("[PaymentSuccessContent] Function body execution start");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, showToast, dismissToast} = useToast();
  const { clearCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [countdownActive, setCountdownActive] = useState(true);

  const receiptId = searchParams.get("receipt_id");
  const change = parseFloat(searchParams.get("change") || "0");
  const [printing, setPrinting] = useState(false);
  const [printQueued, setPrintQueued] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [voucherId, setVoucherId] = useState<string | null>(null);
  
  console.log(`[PaymentSuccessContent] Initial render values - receiptId: ${receiptId}, change: ${change}, countdown: ${countdown}, mounted: ${mounted}`);
  
  useEffect(() => {
    console.log("[PaymentSuccess] Mount effect: Component is now mounted.");
    setMounted(true);

    // Check if a voucher was created
    try {
      const vid = sessionStorage.getItem("created_voucher_id");
      if (vid) {
        setVoucherId(vid);
        sessionStorage.removeItem("created_voucher_id");
      }
    } catch (err) {
      console.error("[PaymentSuccess] Failed to load voucher ID:", err);
    }

    // Load sound enabled setting
    const loadSoundSetting = async () => {
      try {
        const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const registerId = session.register?.id;
          if (registerId) {
            const settings = await registerSettings.get(registerId);
            setSoundEnabledCheck(() => settings.sound_enabled);
            if (settings.sound_enabled) {
              playPaymentSuccessSound();
            }
          }
        }
      } catch (error) {
        console.error('Failed to load sound settings:', error);
      }
    };
    loadSoundSetting();
  }, []);
  
  useEffect(() => {
    console.log(`[PaymentSuccess] Props/State changed - receiptId: ${receiptId}, change: ${change}, countdown: ${countdown}, active: ${countdownActive}`);
  }, [receiptId, change, countdown, countdownActive]);

  useEffect(() => {
    if (clearCart) {
      console.log("[PaymentSuccess] Clearing cart.");
      clearCart();
    }
  }, [clearCart]);

  // Auto-print based on register settings
  useEffect(() => {
    if (!mounted || !receiptId) return;
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    if (!sessionData) return;
    try {
      const session = JSON.parse(sessionData);
      const regId = session.register?.id;
      if (!regId) return;
      registerSettings.get(regId).then(async (s) => {
        if (s.print_behaviour === "always") {
          handlePrintReceipt(true);
        }
        // Food order printing — check if receipt contains food items
        if (s.food_print_behaviour === "always" || s.food_print_behaviour === "ask") {
          await handlePrintFoodTicket(s.food_print_behaviour === "always", s.food_copies || 1);
        }
      }).catch(() => {});
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, receiptId]);

  // Load QR code URL on mount
  useEffect(() => {
    if (!mounted) return;
    
    const loadQRCode = async () => {
      try {
        const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
        if (!sessionData) return;
        
        const session = JSON.parse(sessionData);
        const orgId = session.org_id;
        
        // Fetch Google Review QR code for this org
        const response = await fetch(`/api/qr-codes?org_id=${orgId}`);
        const data = await response.json();
        
        if (data.qr_codes && data.qr_codes.length > 0) {
          // Find the first active Google Review QR code
          const googleReviewQR = data.qr_codes.find(
            (qr: any) => qr.code_type === 'google_review' && qr.is_active
          );
          
          if (googleReviewQR) {
            // Build tracking URL
            const baseUrl = window.location.origin;
            setQrCodeUrl(`${baseUrl}/qr/${googleReviewQR.unique_code}`);
          }
        }
      } catch (error) {
        console.error('Failed to load QR code:', error);
      }
    };
    
    loadQRCode();
  }, [mounted]);

  const redirect = useCallback(() => {
    console.log("[PaymentSuccess] REDIRECTING to /sell");
    router.push("/sell");
  }, [router]);

  useEffect(() => {
    console.log(`[PaymentSuccess] Countdown effect triggered - mounted: ${mounted}, active: ${countdownActive}`);
    if (!mounted || !countdownActive) {
      console.log("[PaymentSuccess] Countdown effect skipped (not mounted or not active).");
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        const newCount = prev - 1;
        console.log(`[PaymentSuccess] Countdown tick: ${newCount}`);
        if (newCount <= 0) {
          console.log("[PaymentSuccess] Countdown finished. Preparing to redirect.");
          // Schedule redirect outside of state updater to avoid React warning
          setTimeout(() => redirect(), 0);
        }
        return newCount;
      });
    }, 1000);

    return () => {
      console.log("[PaymentSuccess] Countdown effect cleanup: Clearing interval.");
      clearInterval(timer);
    };
  }, [mounted, countdownActive, redirect]);

  const handlePrintReceipt = useCallback(async (silent = false) => {
    if (!receiptId) return;
    if (printing) return;

    setPrinting(true);
    // Pause the auto-redirect countdown while printing
    setCountdownActive(false);

    try {
      // For temp receipts, fetch data from IndexedDB
      let receiptData = null;
      if (receiptId.startsWith('temp_')) {
        try {
          const { getDB } = await import('@/lib/idb/db');
          const db = await getDB();
          receiptData = await db.get('receipts', receiptId);
          console.log('[PaymentSuccess] Fetched receipt from IndexedDB:', receiptData ? 'found' : 'not found');
        } catch (err) {
          console.error('Failed to fetch temp receipt from IndexedDB:', err);
        }
      }

      // Read receipt_copies from register settings
      let copies = 1;
      try {
        const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const regId = session.register?.id;
          if (regId) {
            const s = await registerSettings.get(regId);
            console.log('[PaymentSuccess] Register settings:', {
              receipt_copies: s.receipt_copies,
              print_behaviour: s.print_behaviour,
            });
            copies = s.receipt_copies || 1;
          }
        }
      } catch (error) {
        console.error('[PaymentSuccess] Failed to get receipt_copies:', error);
      }

      console.log('[PaymentSuccess] Sending to print API:', {
        receipt_id: receiptId,
        has_receipt_data: !!receiptData,
        copies,
      });

      const response = await fetch("/api/receipts/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receiptId,
          receipt_data: receiptData,
          copies,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to print");
      }

      if (data.queued) {
        // Sent to print queue on the Raspberry Pi
        setPrintQueued(true);
        if (!silent) showToast("Receipt sent to printer", "success");
      } else if (data.receipt_text) {
        // Fallback: no printer configured — open browser print dialog
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Receipt #${receiptId.slice(0, 8)}</title>
                <style>
                  body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 20px auto; padding: 10px; }
                  pre { white-space: pre-wrap; word-wrap: break-word; }
                </style>
              </head>
              <body>
                <pre>${data.receipt_text}</pre>
                <script>window.onload = function() { window.print(); };<\/script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
        if (!silent) showToast("Receipt opened for printing", "info");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to print receipt", "error");
    } finally {
      setPrinting(false);
    }
  }, [receiptId, printing, showToast]);

  const handlePrintFoodTicket = useCallback(async (autoPrint: boolean, copies: number) => {
    if (!receiptId) return;
    try {
      // Fetch receipt data from IndexedDB
      let receiptData = null;
      if (receiptId.startsWith('temp_')) {
        try {
          const { getDB } = await import('@/lib/idb/db');
          const db = await getDB();
          receiptData = await db.get('receipts', receiptId);
        } catch (err) {
          console.error('[FoodTicket] Failed to fetch receipt from IndexedDB:', err);
        }
      }
      if (!receiptData || !receiptData.lines) return;

      // Check if any lines are food items
      const hasFood = containsFoodItems(
        receiptData.lines.map((l: any) => ({ item_name: l.item_name || l.name }))
      );
      if (!hasFood) return;

      // Build ticket data for kitchen ticket
      const now = new Date();
      const ticketData = {
        store_name: receiptData.store_name || '',
        store_address: receiptData.store_address,
        store_phone: receiptData.store_phone,
        ticket_name: receiptData.receipt_number || receiptId.slice(0, 8),
        ticket_comment: '',
        date: now.toLocaleDateString('en-GB'),
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        employee_name: receiptData.employee_name || 'Staff',
        register_name: receiptData.register_name || 'Main Till',
        lines: receiptData.lines.map((l: any) => ({
          quantity: l.quantity || 1,
          item_name: l.item_name || l.name,
          variant_name: l.variant_name || null,
          modifiers: l.modifiers || [],
          line_total: l.line_total || 0,
        })),
        subtotal: receiptData.subtotal || 0,
        tax: receiptData.tax || 0,
        total: receiptData.total || 0,
        is_paid: true,
        payment_method: receiptData.payment_method,
        dining_option: receiptData.dining_option,
        table_number: receiptData.table_number,
        customer_name: receiptData.customer_name,
        assignment: null,
      };

      const response = await fetch('/api/tickets/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_data: ticketData, copies }),
      });

      const data = await response.json();
      if (response.ok && data.queued && autoPrint) {
        console.log('[FoodTicket] Kitchen ticket sent to printer');
      }
    } catch (err) {
      console.error('[FoodTicket] Failed to print food ticket:', err);
    }
  }, [receiptId]);

  const handleNewSale = () => {
    console.log("[PaymentSuccess] 'New Sale' button clicked. Redirecting to /sell.");
    redirect();
  };

  const handlePrintVoucher = () => {
    if (!voucherId) return;
    window.open(`/api/vouchers/${voucherId}/print`, "_blank");
  };

  console.log(`[PaymentSuccessContent] Rendering JSX - countdown: ${countdown}`);
  return (
    <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center p-4">
      <div className="bg-[#3d3d3d] rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <CheckCircle className="h-24 w-24 text-green-500 mx-auto" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-heading font-bold text-white mb-2">
          Payment Complete!
        </h1>
        <p className="text-gray-400 mb-8">
          Receipt #{receiptId?.slice(0, 8)}
        </p>

        {/* Change Due */}
        {change > 0 && (
          <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-6 mb-8">
            <div className="text-sm text-green-400 mb-1">Change Due</div>
            <div className="text-4xl font-bold text-green-400">
              {formatCurrency(change)}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center items-center gap-3 mb-8 flex-wrap">
          <Button
            size="lg"
            className="flex flex-col items-center justify-center h-28 w-28 sm:h-32 sm:w-32 bg-penkey-orange hover:bg-orange-600 text-white p-2 aspect-square"
            onClick={handleNewSale}
          >
            <Home className="h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2" />
            <span className="text-xs sm:text-sm text-center leading-tight">New Sale</span>
          </Button>
          <Button
            size="lg"
            className={`flex flex-col items-center justify-center h-28 w-28 sm:h-32 sm:w-32 text-white border-0 p-2 aspect-square transition-colors ${
              printQueued
                ? "bg-green-600 hover:bg-green-700"
                : "bg-[#5d5d5d] hover:bg-[#6d6d6d]"
            }`}
            onClick={() => handlePrintReceipt(false)}
            disabled={printing}
          >
            {printing ? (
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2 animate-spin" />
            ) : (
              <Printer className="h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2" />
            )}
            <span className="text-xs sm:text-sm text-center leading-tight">
              {printing ? "Sending..." : printQueued ? "Sent ✓" : "Print Receipt"}
            </span>
          </Button>
          {voucherId && (
            <Button
              size="lg"
              className="flex flex-col items-center justify-center h-28 w-28 sm:h-32 sm:w-32 bg-[#4d4d4d] hover:bg-[#5d5d5d] text-white border-0 p-2 aspect-square transition-colors"
              onClick={handlePrintVoucher}
            >
              <Printer className="h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2" />
              <span className="text-xs sm:text-sm text-center leading-tight">Print Voucher</span>
            </Button>
          )}
        </div>

        {/* QR Code Section */}
        {qrCodeUrl && (
          <div className="bg-[#2d2d2d] border border-gray-600 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Star className="h-5 w-5 text-yellow-400" />
              <h3 className="text-lg font-bold text-white">Leave a Review</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4 text-center">
              We hope you had a lovely time at Penkey! If you wouldn't mind giving us a 5-star review, please scan this QR code. Alternatively, you can take a receipt slip and review us later at your convenience.
            </p>
            <div className="flex justify-center mb-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={receiptId ? `${qrCodeUrl}?receipt_id=${receiptId}` : qrCodeUrl}
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>
            <div className="text-center text-xs text-gray-400 space-y-1">
              <p>1. Open your phone's camera app</p>
              <p>2. Point at the QR code</p>
              <p>3. Tap the link that appears</p>
            </div>
          </div>
        )}

        {/* Auto-redirect countdown */}
        {countdownActive ? (
          <div className="flex items-center justify-center gap-3">
            <p className="text-sm text-gray-400">
              Returning to POS in {countdown} seconds...
            </p>
            <button
              onClick={() => {
                console.log("[PaymentSuccess] Countdown stopped by user.");
                setCountdownActive(false);
              }}
              className="text-penkey-orange hover:text-orange-600 transition-colors"
              title="Stop countdown"
            >
              <StopCircle className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Auto-redirect stopped
          </p>
        )}
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function PaymentSuccessPage() {
  console.log("[PaymentSuccessPage] Wrapper component rendering.");
  return <PaymentSuccessContent />;
}
