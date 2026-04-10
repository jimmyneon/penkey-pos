"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@penkey/ui";
import { formatCurrency } from "@penkey/ui";
import { CheckCircle, Printer, Home, StopCircle, Loader2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import { useCartStore } from "@/lib/store/cart-store";
import { dataCache } from "@/lib/services/data-cache";
import { registerSettings } from "@/lib/services/register-settings";
import { playPaymentSuccessSound, setSoundEnabledCheck } from "@/lib/utils/sounds";

function PaymentSuccessContent() {
  console.log("[PaymentSuccessContent] Function body execution start");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, showToast, dismissToast} = useToast();
  const { clearCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [countdownActive, setCountdownActive] = useState(true);

  const receiptId = searchParams.get("receipt_id");
  const change = parseFloat(searchParams.get("change") || "0");
  const [printing, setPrinting] = useState(false);
  const [printQueued, setPrintQueued] = useState(false);
  
  console.log(`[PaymentSuccessContent] Initial render values - receiptId: ${receiptId}, change: ${change}, countdown: ${countdown}, mounted: ${mounted}`);
  
  useEffect(() => {
    console.log("[PaymentSuccess] Mount effect: Component is now mounted.");
    setMounted(true);

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
      registerSettings.get(regId).then((s) => {
        if (s.print_behaviour === "always") {
          handlePrintReceipt(true);
        }
        // "ask" = do nothing (button shown), "never" = do nothing
      }).catch(() => {});
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, receiptId]);

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
      const response = await fetch("/api/receipts/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_id: receiptId }),
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

  const handleNewSale = () => {
    console.log("[PaymentSuccess] 'New Sale' button clicked. Redirecting to /sell.");
    redirect();
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
        <div className="flex justify-center items-center gap-4 mb-8">
          <Button
            size="lg"
            className="flex flex-col items-center justify-center h-32 w-32 bg-penkey-orange hover:bg-orange-600 text-white p-2 aspect-square"
            onClick={handleNewSale}
          >
            <Home className="h-8 w-8 mb-2" />
            <span className="text-sm text-center">New Sale</span>
          </Button>
          <Button
            size="lg"
            className={`flex flex-col items-center justify-center h-32 w-32 text-white border-0 p-2 aspect-square transition-colors ${
              printQueued
                ? "bg-green-600 hover:bg-green-700"
                : "bg-[#5d5d5d] hover:bg-[#6d6d6d]"
            }`}
            onClick={() => handlePrintReceipt(false)}
            disabled={printing}
          >
            {printing ? (
              <Loader2 className="h-8 w-8 mb-2 animate-spin" />
            ) : (
              <Printer className="h-8 w-8 mb-2" />
            )}
            <span className="text-sm text-center">
              {printing ? "Sending..." : printQueued ? "Sent ✓" : "Print Receipt"}
            </span>
          </Button>
        </div>

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
