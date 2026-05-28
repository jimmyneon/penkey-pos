"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Delete, LogOut, Fingerprint, KeyRound } from "lucide-react";
import { dataCache } from "@/lib/services/data-cache";
import { registerSettings } from "@/lib/services/register-settings";
import { userPreferences } from "@/lib/services/user-preferences";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { prefetchOrgData } from "@/lib/offline/prefetch";
import { verifyPinLocally, cachePinHashes, getCachedRegister } from "@/lib/services/pin-cache";
import {
  checkPlatformAuthenticator,
  isBiometricEnabled,
  registerBiometric,
  authenticateBiometric,
} from "@/lib/services/biometrics";

const BIOMETRIC_MAX_FAILURES = 3;

export default function LockPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [authChecking, setAuthChecking] = useState(true);
  // Cached at page-load — avoids a round-trip inside handleSubmit
  const [cachedOrgId, setCachedOrgId] = useState<string | null>(null);
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);
  const [cachedEmployeeName, setCachedEmployeeName] = useState<string | null>(null);
  // Biometric state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricFailCount, setBiometricFailCount] = useState(0);
  const [showPinMode, setShowPinMode] = useState(false);
  const [showEnableBiometricPrompt, setShowEnableBiometricPrompt] = useState(false);

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
        
        // Authenticated — cache org_id and user_id now so submit needs no extra fetch
        const authData = await response.json();
        const orgId: string = authData.org_id;
        const userId: string = authData.user_id;
        setCachedOrgId(orgId);
        setCachedUserId(userId);
        setAuthChecking(false);

        // Clear any existing POS session
        sessionStorage.removeItem("pos_session");

        // ⚡ PERFORMANCE: Pre-warm PIN cache in background (non-blocking)
        // This runs after UI is shown, doesn't block keypad render
        if (orgId) {
          warmPinCacheInBackground(orgId);
        }

        // Check biometric availability and auto-trigger if enrolled
        const available = await checkPlatformAuthenticator();
        setBiometricAvailable(available);
        if (available && userId) {
          const enabled = isBiometricEnabled(userId);
          setBiometricEnabled(enabled);
          // Don't auto-trigger here — let the useEffect below handle it
          // so state is settled first
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

  // Auto-trigger biometrics once auth check is done and biometric is enrolled
  useEffect(() => {
    if (!authChecking && biometricAvailable && biometricEnabled && cachedUserId) {
      handleBiometricAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecking, biometricAvailable, biometricEnabled, cachedUserId]);

  // ─── Shared: save session and navigate to /sell ────────────────────────────
  const proceedWithSession = useCallback(async (data: any) => {
    sessionStorage.setItem("pos_session", JSON.stringify(data));

    if (data.register?.id) {
      registerSettings.migrateFromLocalStorage(data.register.id)
        .catch((err: any) => console.error("[Lock] Settings migration failed:", err));
    }
    if (data.user_id && data.org_id) {
      userPreferences.migrateFromLocalStorage(data.user_id, data.org_id)
        .catch((err: any) => console.error("[Lock] User preferences migration failed:", err));
    }

    prefetchOrgData(data.org_id, data.register?.id)
      .catch((err: any) => console.error("[Lock] Background prefetch failed:", err));

    router.push("/sell");
  }, [router]);

  // ─── Biometric auth ────────────────────────────────────────────────────────
  const handleBiometricAuth = async () => {
    if (!cachedUserId || !cachedOrgId) return;
    setLoading(true);
    setError("");
    try {
      const success = await authenticateBiometric(cachedUserId);
      if (success) {
        setLoadingMessage("Unlocking...");
        // Build session from cached data
        const cachedPins = await import("@/lib/services/pin-cache");
        const register = await cachedPins.getCachedRegister(cachedOrgId);
        const allPins = await import("@/lib/idb/db").then(m => m.getAll("cached_pins")) as any[];
        const myPin = allPins.find((p: any) => p.user_id === cachedUserId && p.org_id === cachedOrgId);
        const data = {
          employee: {
            id: myPin?.member_id || cachedUserId,
            name: myPin?.employee_name || cachedEmployeeName || "Employee",
            role: myPin?.role || "staff",
          },
          register: register || { id: "default", name: "POS" },
          org_id: cachedOrgId,
          timestamp: new Date().toISOString(),
        };
        await proceedWithSession(data);
      } else {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        const newCount = biometricFailCount + 1;
        setBiometricFailCount(newCount);
        if (newCount >= BIOMETRIC_MAX_FAILURES) {
          setShowPinMode(true);
          setError("Biometric failed 3 times. Please enter your PIN.");
        } else {
          setError(`Biometric not recognised. ${BIOMETRIC_MAX_FAILURES - newCount} attempt${BIOMETRIC_MAX_FAILURES - newCount === 1 ? "" : "s"} left.`);
        }
      }
    } catch (err: any) {
      console.error("[Lock] Biometric error:", err);
      setError("Biometric unavailable. Please use your PIN.");
      setShowPinMode(true);
    } finally {
      setLoading(false);
    }
  };

  // ⚡ PERFORMANCE: Warm PIN cache in background without blocking UI
  const warmPinCacheInBackground = async (orgId: string) => {
    try {
      // Pre-load bcryptjs in background to avoid import delay during PIN verification
      await import('bcryptjs');

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
        const localResult = await verifyPinLocally(pin, cachedOrgId, cachedUserId || undefined);

        if (localResult) {
          console.log('[Lock] ⚡ PIN verified locally — zero network calls');
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
          setCachedEmployeeName(localResult.employee_name);
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
        setCachedEmployeeName(data.employee?.name || null);
      }

      setLoadingMessage("Ready!");

      // After a successful PIN — offer to enroll biometrics if available but not yet set up
      if (biometricAvailable && cachedUserId && !isBiometricEnabled(cachedUserId)) {
        setShowEnableBiometricPrompt(true);
        // Store data so we can proceed after the prompt
        sessionStorage.setItem("_pending_session", JSON.stringify(data));
        return;
      }

      await proceedWithSession(data);
    } catch (err: any) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
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

  const handleSignOut = async () => {
    hapticButtonPress();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      ["pos_auth_token", "pos_auth_expiry", "pos_user", "pos_register_settings",
       "pos-cart-storage", "pos_layout", "pos_upsell_preferences"].forEach(
        (k) => localStorage.removeItem(k)
      );
      sessionStorage.clear();
      dataCache.clearAll();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const showingBiometric = biometricEnabled && !showPinMode && biometricFailCount < BIOMETRIC_MAX_FAILURES;

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

  // ─── Enable biometrics prompt (shown after first successful PIN) ────────────
  if (showEnableBiometricPrompt) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#3d3d3d] rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-penkey-orange/20 flex items-center justify-center mx-auto mb-5">
            <Fingerprint className="w-10 h-10 text-penkey-orange" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Unlock faster</h2>
          <p className="text-gray-400 text-sm mb-8">
            Use Face ID or fingerprint instead of entering your PIN every time.
          </p>
          <button
            onClick={async () => {
              if (!cachedUserId) return;
              const displayName = cachedEmployeeName || "Employee";
              const ok = await registerBiometric(cachedUserId, displayName);
              const pending = sessionStorage.getItem("_pending_session");
              sessionStorage.removeItem("_pending_session");
              if (ok) setBiometricEnabled(true);
              if (pending) await proceedWithSession(JSON.parse(pending));
            }}
            className="w-full h-14 rounded-xl bg-penkey-orange text-white font-semibold text-lg mb-3 active:scale-95 transition-all"
          >
            Enable biometrics
          </button>
          <button
            onClick={async () => {
              const pending = sessionStorage.getItem("_pending_session");
              sessionStorage.removeItem("_pending_session");
              if (pending) await proceedWithSession(JSON.parse(pending));
            }}
            className="w-full h-12 rounded-xl text-gray-400 text-sm"
          >
            Not now
          </button>
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
          <p className="text-sm sm:text-base text-gray-400">
            {showingBiometric ? "Use biometrics to unlock" : "Enter your PIN to continue"}
          </p>
        </div>

        {/* ── Biometric primary screen ── */}
        {showingBiometric && (
          <div className="bg-[#3d3d3d] rounded-lg shadow-lg p-8 mb-4 flex flex-col items-center">
            {error && (
              <div className="w-full bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-6">
                <p className="text-center text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleBiometricAuth}
              disabled={loading}
              className="w-36 h-36 rounded-full bg-[#4d4d4d] border-2 border-gray-600 hover:border-penkey-orange active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 mb-6"
            >
              {loading
                ? <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-penkey-orange" />
                : <Fingerprint className="w-16 h-16 text-penkey-orange" />}
            </button>

            {loading && (
              <p className="text-gray-400 text-sm mb-4">{loadingMessage || "Verifying..."}</p>
            )}

            {biometricFailCount > 0 && biometricFailCount < BIOMETRIC_MAX_FAILURES && (
              <p className="text-yellow-400 text-xs mb-4">
                {BIOMETRIC_MAX_FAILURES - biometricFailCount} attempt{BIOMETRIC_MAX_FAILURES - biometricFailCount === 1 ? "" : "s"} remaining
              </p>
            )}

            <button
              onClick={() => { setShowPinMode(true); setError(""); }}
              disabled={loading}
              className="flex items-center gap-2 text-gray-400 text-sm hover:text-white transition-colors mt-2"
            >
              <KeyRound className="w-4 h-4" />
              Enter PIN instead
            </button>
          </div>
        )}

        {/* ── PIN pad (fallback or default when biometric not enrolled) ── */}
        {!showingBiometric && (
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
                <p className="text-center text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}

            {loading && (
              <div className="text-center text-gray-400 text-sm mb-4">
                {loadingMessage || "Verifying..."}
              </div>
            )}

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

            {/* Retry biometrics after 3 failures */}
            {biometricEnabled && biometricFailCount >= BIOMETRIC_MAX_FAILURES && (
              <button
                onClick={() => { setBiometricFailCount(0); setShowPinMode(false); setError(""); }}
                className="w-full mt-4 text-gray-400 text-xs hover:text-white transition-colors flex items-center justify-center gap-1"
              >
                <Fingerprint className="w-3 h-3" /> Try biometrics again
              </button>
            )}

            {/* Switch back to biometrics if user chose PIN voluntarily */}
            {biometricEnabled && showPinMode && biometricFailCount < BIOMETRIC_MAX_FAILURES && (
              <button
                onClick={() => { setShowPinMode(false); setError(""); }}
                className="w-full mt-4 text-gray-400 text-xs hover:text-white transition-colors flex items-center justify-center gap-1"
              >
                <Fingerprint className="w-3 h-3" /> Use biometrics instead
              </button>
            )}
          </div>
        )}

        {/* Sign Out Button */}
        <div className="px-6 sm:px-8 pb-4">
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full h-12 sm:h-14 rounded-md bg-red-600/80 border-2 border-red-700 hover:bg-red-700 active:scale-95 transition-all text-white disabled:opacity-50 flex items-center justify-center text-sm sm:text-base"
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            Sign Out
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-500">
            Need help? Contact your manager
          </p>
        </div>
      </div>
    </div>
  );
}
