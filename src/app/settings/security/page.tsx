"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Lock, Key, LogOut } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { SettingsSection, SettingRow, ToggleSwitch, SettingsHeader, SettingsLoading } from "@/components/settings/settings-shared";
import { ToastContainer } from "@/components/toast-container";
import { hapticSuccess, hapticButtonPress } from "@/lib/utils/haptics";
import {
  checkPlatformAuthenticator,
  isBiometricEnabled,
  registerBiometric,
  disableBiometric,
  clearBiometricDismissed,
} from "@/lib/services/biometrics";

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);
  const [cachedEmployeeName, setCachedEmployeeName] = useState<string>("");

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) {
        router.push("/lock");
        return;
      }

      const session = JSON.parse(sessionData);
      setUserEmail(session.employee?.email || session.employee?.name || "User");
      setCachedUserId(session.user_id || null);
      setCachedEmployeeName(session.employee?.name || "Employee");

      const bioAvailable = await checkPlatformAuthenticator();
      setBiometricAvailable(bioAvailable);
      if (session.user_id) {
        setBiometricEnabled(isBiometricEnabled(session.user_id));
      }
    } catch (error) {
      console.error("Failed to load security data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasscode = async () => {
    if (!currentPasscode || !newPasscode || !confirmPasscode) {
      showToast("Please fill in all fields", "error");
      return;
    }

    if (newPasscode.length !== 4 || !/^\d+$/.test(newPasscode)) {
      showToast("New passcode must be 4 digits", "error");
      return;
    }

    if (newPasscode !== confirmPasscode) {
      showToast("New passcodes don't match", "error");
      return;
    }

    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) {
        showToast("Not authenticated", "error");
        return;
      }

      const session = JSON.parse(sessionData);
      const employeeId = session.employee.id;

      const verifyResponse = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: currentPasscode }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || verifyData.employee?.id !== employeeId) {
        showToast("Current passcode is incorrect", "error");
        return;
      }

      const updateResponse = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, newPin: newPasscode }),
      });

      const updateData = await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(updateData.error || 'Failed to update passcode');
      }

      showToast("Passcode changed successfully!", "success");
      setShowPasscodeDialog(false);
      setCurrentPasscode("");
      setNewPasscode("");
      setConfirmPasscode("");
      hapticSuccess();
    } catch (error) {
      showToast("Failed to change passcode: " + (error as Error).message, "error");
    }
  };

  if (loading) return <SettingsLoading />;

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <SettingsHeader title="Security & Account" onBack={() => router.push("/settings")} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-24">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

            <SettingsSection title="Security" icon={Lock}>
              <SettingRow label="Lock Passcode" description="Change your 4-digit PIN for unlocking the POS">
                <Button
                  onClick={() => {
                    hapticButtonPress();
                    setShowPasscodeDialog(true);
                  }}
                  variant="outline"
                  className="text-black border-gray-600 hover:bg-white/10 min-h-[48px] min-w-[180px]"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Change PIN
                </Button>
              </SettingRow>

              <SettingRow
                label="Biometric Unlock"
                description={
                  biometricAvailable
                    ? "Use Face ID or fingerprint to unlock the POS"
                    : "Biometrics not available on this device"
                }
              >
                {biometricAvailable ? (
                  <div className="flex items-center gap-3">
                    {biometricBusy && (
                      <div className="animate-spin w-4 h-4 border-2 border-penkey-orange border-t-transparent rounded-full" />
                    )}
                    <ToggleSwitch
                      checked={biometricEnabled}
                      onChange={async (checked) => {
                        if (!cachedUserId) {
                          showToast("User session not found", "error");
                          return;
                        }
                        if (checked) {
                          setBiometricBusy(true);
                          try {
                            const ok = await registerBiometric(cachedUserId, cachedEmployeeName);
                            if (ok) {
                              setBiometricEnabled(true);
                              clearBiometricDismissed(cachedUserId);
                              showToast("Biometric unlock enabled", "success");
                              hapticSuccess();
                            } else {
                              showToast("Failed to enable biometrics", "error");
                            }
                          } catch {
                            showToast("Biometric setup was cancelled", "error");
                          } finally {
                            setBiometricBusy(false);
                          }
                        } else {
                          disableBiometric(cachedUserId);
                          setBiometricEnabled(false);
                          showToast("Biometric unlock disabled", "info");
                          hapticButtonPress();
                        }
                      }}
                    />
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm">Unavailable</span>
                )}
              </SettingRow>
            </SettingsSection>

            <div className="bg-[#3d3d3d] rounded-lg p-4 sm:p-6 border border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-base sm:text-lg mb-1">Account</h3>
                  <p className="text-gray-400 text-sm">{userEmail}</p>
                </div>
                <Button
                  onClick={async () => {
                    hapticButtonPress();
                    try {
                      await fetch("/api/auth/logout", { method: "POST" });
                      sessionStorage.clear();
                      localStorage.clear();
                      showToast("Signed out successfully", "success");
                      setTimeout(() => router.push("/login"), 500);
                    } catch (error) {
                      showToast("Failed to sign out", "error");
                    }
                  }}
                  variant="outline"
                  className="text-red-400 border-red-400/50 hover:bg-red-400/10 min-h-[48px] min-w-[180px] w-full sm:w-auto flex items-center justify-center"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="text-sm sm:text-base">Sign Out</span>
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {showPasscodeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#3d3d3d] rounded-lg p-6 max-w-md w-full border border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="h-6 w-6 text-penkey-orange" />
              <h2 className="text-xl font-semibold text-white">Change Lock Passcode</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Current Passcode</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPasscode}
                  onChange={(e) => setCurrentPasscode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-[#2d2d2d] border-2 border-gray-600 rounded-md text-white text-center text-2xl tracking-widest focus:border-penkey-orange focus:outline-none"
                  placeholder="••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">New Passcode (4 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-[#2d2d2d] border-2 border-gray-600 rounded-md text-white text-center text-2xl tracking-widest focus:border-penkey-orange focus:outline-none"
                  placeholder="••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Confirm New Passcode</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-[#2d2d2d] border-2 border-gray-600 rounded-md text-white text-center text-2xl tracking-widest focus:border-penkey-orange focus:outline-none"
                  placeholder="••••"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  hapticButtonPress();
                  setShowPasscodeDialog(false);
                  setCurrentPasscode("");
                  setNewPasscode("");
                  setConfirmPasscode("");
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-600 rounded-md text-white hover:bg-white/10 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePasscode}
                className="flex-1 px-4 py-3 bg-penkey-orange rounded-md text-white hover:bg-penkey-orange/90 transition-all active:scale-95 font-semibold"
              >
                Change PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
