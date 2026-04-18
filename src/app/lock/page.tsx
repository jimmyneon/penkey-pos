"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Delete, LogOut } from "lucide-react";
import { dataCache } from "@/lib/services/data-cache";
import { registerSettings } from "@/lib/services/register-settings";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { prefetchOrgData } from "@/lib/offline/prefetch";
import { verifyPinLocally, cachePinHashes, getCachedRegister } from "@/lib/services/pin-cache";

export default function LockPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [authChecking, setAuthChecking] = useState(true);
  // Cached at page-load — avoids a round-trip inside handleSubmit
  const [cachedOrgId, setCachedOrgId] = useState<string | null>(null);

  useEffect(() => {
    // ✅ SECURITY: Check if user is authenticated via httpOnly cookie
    const checkAuth = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch("/api/auth/check", {
          method: "GET",
          credentials: "include", // Include httpOnly cookies
          signal: controller.signal,
        });
        
        if (!response.ok) {
          // Not authenticated, redirect to login
          router.push("/login");
          return;
        }
        
        // Authenticated — cache org_id now so submit needs no extra fetch
        const authData = await response.json();
        const orgId: string = authData.org_id;
        setCachedOrgId(orgId);
        setAuthChecking(false);

        // Clear any existing POS session
        sessionStorage.removeItem("pos_session");

        // ⚡ PERFORMANCE: Pre-warm PIN cache in background (non-blocking)
        // This runs after UI is shown, doesn't block keypad render
        if (orgId) {
          warmPinCacheInBackground(orgId);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.error("[Lock] Auth check timed out");
        } else {
          console.error("[Lock] Auth check failed:", error);
        }
        router.push("/login");
      } finally {
        clearTimeout(timeout);
      }
    };
    
    checkAuth();
  }, [router]);

  // ⚡ PERFORMANCE: Warm PIN cache in background without blocking UI
  const warmPinCacheInBackground = async (orgId: string) => {
    try {
      const { isPinCacheStale } = await import("@/lib/services/pin-cache");
      if (await isPinCacheStale(orgId)) {
        console.log("[Lock] Warming PIN cache in background...");
        // Also fetch + cache register info so submit is fully offline
        const regRes = await fetch(`/api/registers?org_id=${orgId}&active=true`, { credentials: "include" });
        const registers = regRes.ok ? await regRes.json() : [];
        await cachePinHashes(orgId, registers[0] || null);
        console.log("[Lock] PIN cache warmed in background");
      }
    } catch (e) {
      console.warn("[Lock] PIN pre-warm failed (will fall back to API on submit)", e);
    }
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      hapticButtonPress();
      setPin(pin + num);
      setError("");
    }
  };

  const handleClear = () => {
    hapticButtonPress();
    setPin("");
    setError("");
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError("Please enter a 4-digit PIN");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let data = null;

      // ⚡ Fast path: verify entirely in browser using cached bcrypt hashes
      if (cachedOrgId) {
        const localResult = await verifyPinLocally(pin, cachedOrgId);

        if (localResult) {
          console.log('[Lock] ⚡ PIN verified locally — zero network calls');
          // Use cached register to avoid another API round-trip
          const register = await getCachedRegister(cachedOrgId);
          data = {
            employee: {
              id: localResult.member_id,
              name: localResult.employee_name,
              role: localResult.role,
            },
            register: register || { id: 'default', name: 'POS' },
            org_id: localResult.org_id,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Fallback to full API (no cache, or wrong PIN that needs definitive answer)
      if (!data) {
        console.log('[Lock] Falling back to API PIN verification...');
        const response = await fetch("/api/auth/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pin }),
        });

        data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Invalid PIN");
        }
      }

      // Store session
      sessionStorage.setItem("pos_session", JSON.stringify(data));

      // Migrate localStorage settings to database
      if (data.register?.id) {
        try {
          await registerSettings.migrateFromLocalStorage(data.register.id);
          console.log("[Lock] Settings migrated successfully");
        } catch (migrationError) {
          console.error("[Lock] Settings migration failed:", migrationError);
          // Don't block login on migration failure
        }
      }

      // Pre-load and cache all data AFTER successful PIN entry (non-blocking)
      console.log("[Lock] Starting background data prefetch for org:", data.org_id);
      setLoadingMessage("Ready!");
      
      // Fire-and-forget: Start prefetch in background, don't wait for it
      // This allows instant redirect to sell page while data loads in background
      prefetchOrgData(data.org_id, data.register?.id)
        .then(() => {
          console.log("[Lock] ✅ Background prefetch complete - all data cached");
        })
        .catch((err) => {
          console.error("[Lock] Background prefetch failed:", err);
          // Data will load on-demand from API if prefetch fails
        });

      // Redirect to sell screen immediately (don't wait for prefetch)
      router.push("/sell");
    } catch (err: any) {
      // Long vibration for error
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
      }
      setError(err.message || "Invalid PIN");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center p-3 sm:p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-penkey-orange mx-auto mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white mb-2">
            Penkey POS
          </h1>
          <p className="text-sm sm:text-base text-gray-400">Enter your PIN to continue</p>
        </div>

        {/* PIN Display */}
        <div className="bg-[#3d3d3d] rounded-lg shadow-lg p-6 sm:p-8 mb-4 sm:mb-6">
          <div className="flex justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg border-2 flex items-center justify-center ${
                  pin.length > i
                    ? "border-penkey-orange bg-penkey-orange"
                    : "border-gray-600 bg-[#2d2d2d]"
                }`}
              >
                {pin.length > i && (
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white"></div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4">
              <p className="text-center text-red-400 text-sm font-medium">
                {error}
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center text-gray-400 text-sm mb-4">
              {loadingMessage || "Verifying..."}
            </div>
          )}

          {/* Number Pad - Same style as sell page */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={loading}
                className="h-14 sm:h-16 text-xl sm:text-2xl font-semibold rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 active:bg-[#5d5d5d] text-white disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={loading}
              className="h-14 sm:h-16 rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 active:bg-[#5d5d5d] text-white disabled:opacity-50 flex items-center justify-center"
            >
              <Delete className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            <button
              onClick={() => handleNumberClick("0")}
              disabled={loading}
              className="h-14 sm:h-16 text-xl sm:text-2xl font-semibold rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 active:bg-[#5d5d5d] text-white disabled:opacity-50"
            >
              0
            </button>
            <div></div>
          </div>
        </div>

        {/* Sign Out Button - Separated far from keypad to prevent accidental clicks */}
        <div className="px-6 sm:px-8 pb-4">
          <button
            onClick={() => {
              hapticButtonPress();
              localStorage.removeItem("pos_auth_token");
              localStorage.removeItem("pos_auth_expiry");
              localStorage.removeItem("pos_user");
              // Clear all cached data on logout
              dataCache.clearAll();
              router.push("/login");
            }}
            disabled={loading}
            className="w-full h-12 sm:h-14 rounded-md bg-red-600/80 border-2 border-red-700 hover:bg-red-700 active:scale-95 transition-all text-white disabled:opacity-50 flex items-center justify-center text-sm sm:text-base"
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Sign Out
          </button>
        </div>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-500">
            Need help? Contact your manager
          </p>
        </div>
      </div>
    </div>
  );
}
