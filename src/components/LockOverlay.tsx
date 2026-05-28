"use client";

import { useState, useEffect, useCallback } from "react";
import { Fingerprint, KeyRound, Delete, LogOut } from "lucide-react";
import { authenticateBiometric, isBiometricEnabled } from "@/lib/services/biometrics";
import { verifyPinLocally } from "@/lib/services/pin-cache";
import { hapticButtonPress } from "@/lib/utils/haptics";

interface LockOverlayProps {
  userId: string;
  orgId: string;
  onUnlock: () => void;
  onSignOut: () => void;
}

const MAX_BIO_FAILURES = 3;

export function LockOverlay({ userId, orgId, onUnlock, onSignOut }: LockOverlayProps) {
  const biometricEnrolled = userId ? isBiometricEnabled(userId) : false;

  const [showPin, setShowPin] = useState(!biometricEnrolled);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioFailCount, setBioFailCount] = useState(0);

  // ─── Biometric auth ────────────────────────────────────────────────────────
  const handleBiometric = useCallback(async () => {
    if (!userId || !biometricEnrolled) return;
    setLoading(true);
    setError("");
    try {
      const ok = await authenticateBiometric(userId);
      if (ok) {
        onUnlock();
      } else {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        const next = bioFailCount + 1;
        setBioFailCount(next);
        if (next >= MAX_BIO_FAILURES) {
          setShowPin(true);
          setError("Biometric failed 3 times. Enter your PIN.");
        } else {
          setError(`Not recognised. ${MAX_BIO_FAILURES - next} attempt${MAX_BIO_FAILURES - next === 1 ? "" : "s"} left.`);
        }
      }
    } catch {
      setError("Biometric unavailable. Use your PIN.");
      setShowPin(true);
    } finally {
      setLoading(false);
    }
  }, [userId, biometricEnrolled, bioFailCount, onUnlock]);

  // Auto-trigger on mount if biometric is enrolled
  useEffect(() => {
    if (biometricEnrolled) {
      handleBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── PIN auth ──────────────────────────────────────────────────────────────
  const handlePinSubmit = useCallback(async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    setError("");
    try {
      const result = await verifyPinLocally(pin, orgId, userId);
      if (result) {
        onUnlock();
      } else {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        setError("Incorrect PIN");
        setPin("");
      }
    } catch {
      setError("Verification failed. Try again.");
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [pin, orgId, userId, onUnlock]);

  useEffect(() => {
    if (pin.length === 4) handlePinSubmit();
  }, [pin, handlePinSubmit]);

  const handleNumber = (n: string) => {
    if (pin.length < 4 && !loading) {
      hapticButtonPress();
      setPin(p => p + n);
      setError("");
    }
  };

  const showingBiometric = biometricEnrolled && !showPin && bioFailCount < MAX_BIO_FAILURES;

  return (
    <div className="fixed inset-0 z-50 bg-[#2d2d2d]/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Screen locked</h2>
          <p className="text-gray-400 text-sm">
            {showingBiometric ? "Use biometrics to continue" : "Enter your PIN to continue"}
          </p>
        </div>

        <div className="bg-[#3d3d3d] rounded-xl shadow-lg p-6 mb-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4">
              <p className="text-center text-red-400 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Biometric screen */}
          {showingBiometric && (
            <div className="flex flex-col items-center">
              <button
                onClick={handleBiometric}
                disabled={loading}
                className="w-28 h-28 rounded-full bg-[#4d4d4d] border-2 border-gray-600 hover:border-penkey-orange active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 mb-5"
              >
                {loading
                  ? <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-penkey-orange" />
                  : <Fingerprint className="w-14 h-14 text-penkey-orange" />}
              </button>

              {bioFailCount > 0 && (
                <p className="text-yellow-400 text-xs mb-3">
                  {MAX_BIO_FAILURES - bioFailCount} attempt{MAX_BIO_FAILURES - bioFailCount === 1 ? "" : "s"} remaining
                </p>
              )}

              <button
                onClick={() => { setShowPin(true); setError(""); }}
                disabled={loading}
                className="flex items-center gap-2 text-gray-400 text-sm hover:text-white transition-colors"
              >
                <KeyRound className="w-4 h-4" /> Enter PIN instead
              </button>
            </div>
          )}

          {/* PIN pad */}
          {!showingBiometric && (
            <>
              <div className="flex justify-center gap-3 mb-5">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center ${
                      pin.length > i
                        ? "border-penkey-orange bg-penkey-orange"
                        : "border-gray-600 bg-[#2d2d2d]"
                    }`}
                  >
                    {pin.length > i && <div className="w-3 h-3 rounded-full bg-white" />}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button
                    key={n}
                    onClick={() => handleNumber(n.toString())}
                    disabled={loading}
                    className="h-13 text-xl font-semibold rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 text-white disabled:opacity-50 py-3"
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => { hapticButtonPress(); setPin(""); setError(""); }}
                  disabled={loading}
                  className="h-13 rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 text-white disabled:opacity-50 flex items-center justify-center py-3"
                >
                  <Delete className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleNumber("0")}
                  disabled={loading}
                  className="h-13 text-xl font-semibold rounded-md bg-[#4d4d4d] border-2 border-gray-600 hover:bg-[#5d5d5d] active:scale-95 text-white disabled:opacity-50 py-3"
                >
                  0
                </button>
                <div />
              </div>

              {biometricEnrolled && bioFailCount >= MAX_BIO_FAILURES && (
                <button
                  onClick={() => { setBioFailCount(0); setShowPin(false); setError(""); }}
                  className="w-full mt-3 text-gray-400 text-xs hover:text-white transition-colors flex items-center justify-center gap-1"
                >
                  <Fingerprint className="w-3 h-3" /> Try biometrics again
                </button>
              )}
              {biometricEnrolled && showPin && bioFailCount < MAX_BIO_FAILURES && (
                <button
                  onClick={() => { setShowPin(false); setError(""); }}
                  className="w-full mt-3 text-gray-400 text-xs hover:text-white transition-colors flex items-center justify-center gap-1"
                >
                  <Fingerprint className="w-3 h-3" /> Use biometrics instead
                </button>
              )}
            </>
          )}
        </div>

        <button
          onClick={onSignOut}
          className="w-full h-11 rounded-lg bg-red-600/80 border border-red-700 hover:bg-red-700 active:scale-95 transition-all text-white flex items-center justify-center text-sm gap-2"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}
