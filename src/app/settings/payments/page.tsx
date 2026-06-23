"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { CreditCard } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { SettingsSection, SettingRow, SettingsHeader, SettingsLoading } from "@/components/settings/settings-shared";
import { ToastContainer } from "@/components/toast-container";
import {
  storeSumUpCredentials,
  getSumUpCredentials,
  clearSumUpCredentials,
} from "@/lib/services/sumup-credentials";
import { hapticSuccess, hapticButtonPress } from "@/lib/utils/haptics";

export default function PaymentsSettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);

  const [sumUpConnected, setSumUpConnected] = useState(false);
  const [sumUpMerchantCode, setSumUpMerchantCode] = useState("");
  const [connectingSumUp, setConnectingSumUp] = useState(false);
  const [showSumUpForm, setShowSumUpForm] = useState(false);
  const [sumUpApiKey, setSumUpApiKey] = useState("");
  const [sumUpMerchantCodeInput, setSumUpMerchantCodeInput] = useState("");
  const [sumUpAffiliateKey, setSumUpAffiliateKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSumUpCredentials();
  }, []);

  const loadSumUpCredentials = async () => {
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) {
        router.push("/lock");
        return;
      }

      const credsRes = await fetch('/api/sumup/credentials');
      if (credsRes.ok) {
        const credsData = await credsRes.json();
        if (credsData?.configured) {
          setSumUpConnected(true);
          setSumUpMerchantCode(String(credsData.merchant_code || ''));
          setSumUpAffiliateKey(String(credsData.affiliate_key || ''));
        } else {
          setSumUpConnected(false);
        }
      }
    } catch (e) {
      const storedCreds = getSumUpCredentials();
      if (storedCreds?.apiKey && storedCreds?.merchantCode) {
        setSumUpConnected(true);
        setSumUpMerchantCode(String(storedCreds.merchantCode || ''));
      }
    } finally {
      setLoading(false);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const callbackSuccess = urlParams.get("sumup_callback");
    const callbackError = urlParams.get("sumup_error");

    if (callbackSuccess === "success") {
      await handleOAuthCallback();
    } else if (callbackError) {
      showToast(`SumUp connection failed: ${callbackError}`, "error");
      window.history.replaceState({}, "", "/settings/payments");
    }
  };

  const handleOAuthCallback = async () => {
    try {
      const callbackCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('sumup_oauth_callback='));

      if (!callbackCookie) {
        showToast("OAuth callback data not found", "error");
        return;
      }

      const callbackData = JSON.parse(
        decodeURIComponent(callbackCookie.split('=')[1])
      );

      const response = await fetch("/api/auth/sumup/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: callbackData.code, state: callbackData.state }),
      });

      if (response.ok) {
        const tokenData = await response.json();
        if (tokenData.success) {
          const { SumUpClient } = await import("@penkey/sumup");
          const sumUpClient = new SumUpClient({
            clientId: process.env.NEXT_PUBLIC_SUMUP_CLIENT_ID || "",
            clientSecret: "",
            redirectUri: `${window.location.origin}/api/auth/sumup/callback`,
            environment: "production",
          });
          sumUpClient.config.accessToken = tokenData.accessToken;
          sumUpClient.config.refreshToken = tokenData.refreshToken;
          sumUpClient.config.merchantCode = tokenData.merchantCode;
          sumUpClient.saveTokens();

          setSumUpConnected(true);
          setSumUpMerchantCode(tokenData.merchantCode || "");
          showToast("SumUp connected successfully!", "success");
        } else {
          showToast(`Failed to connect SumUp: ${tokenData.error}`, "error");
        }
      } else {
        showToast("Failed to exchange OAuth code", "error");
      }

      document.cookie = "sumup_oauth_callback=; Max-Age=0; path=/";
      window.history.replaceState({}, "", "/settings/payments");
    } catch (error) {
      showToast("Failed to complete OAuth connection", "error");
    }
  };

  const connectSumUp = async () => {
    setConnectingSumUp(true);
    hapticButtonPress();

    try {
      if (!sumUpApiKey.trim() || !sumUpMerchantCodeInput.trim()) {
        showToast("API Key and Merchant Code are required", "error");
        return;
      }

      const { OfflineSumUpClient } = await import("@penkey/sumup");
      const sumUpClient = new OfflineSumUpClient({
        clientId: "",
        clientSecret: "",
        redirectUri: "",
        environment: "production",
        apiKey: sumUpApiKey.trim(),
        merchantCode: sumUpMerchantCodeInput.trim(),
        affiliateKey: sumUpAffiliateKey.trim(),
        appId: "com.penkey.pos",
      });

      const isValid = await sumUpClient.validateCredentials();

      if (isValid) {
        const saveRes = await fetch('/api/sumup/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: sumUpApiKey.trim(),
            merchant_code: sumUpMerchantCodeInput.trim(),
            affiliate_key: sumUpAffiliateKey.trim(),
          }),
        });

        if (!saveRes.ok) {
          const saveErr = await saveRes.json();
          showToast(saveErr.error || 'Failed to save credentials to database', 'error');
          return;
        }

        storeSumUpCredentials({
          apiKey: sumUpApiKey.trim(),
          merchantCode: sumUpMerchantCodeInput.trim(),
          affiliateKey: sumUpAffiliateKey.trim(),
          appId: 'com.penkey.pos',
          environment: 'production',
        });

        setSumUpConnected(true);
        setSumUpMerchantCode(sumUpMerchantCodeInput.trim());
        setShowSumUpForm(false);
        showToast('SumUp connected successfully!', 'success');
        hapticSuccess();
      } else {
        showToast('Invalid SumUp API credentials. Please check your API key and merchant code.', 'error');
      }
    } catch (error) {
      showToast("Failed to validate SumUp credentials", "error");
    } finally {
      setConnectingSumUp(false);
    }
  };

  const disconnectSumUp = async () => {
    try {
      await fetch('/api/sumup/credentials', { method: 'DELETE' });
      clearSumUpCredentials();
      setSumUpConnected(false);
      setSumUpMerchantCode('');
      setSumUpApiKey('');
      setSumUpMerchantCodeInput('');
      setSumUpAffiliateKey('');
      showToast('SumUp disconnected', 'info');
    } catch (error) {
      showToast('Failed to disconnect SumUp', 'error');
    }
  };

  if (loading) return <SettingsLoading />;

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <SettingsHeader title="Payments" onBack={() => router.push("/settings")} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-24">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

            <SettingsSection title="SumUp Payments" icon={CreditCard}>
              {sumUpConnected ? (
                <>
                  <SettingRow label="Connected" description={`SumUp account connected (${sumUpMerchantCode})`}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-green-500 text-sm">Connected</span>
                    </div>
                  </SettingRow>

                  <SettingRow label="Merchant Code" description="Your SumUp merchant code">
                    <div className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 min-h-[44px] text-sm sm:text-base">
                      {sumUpMerchantCode}
                    </div>
                  </SettingRow>

                  <SettingRow label="Payment Terminals" description="Pair and manage SumUp Solo card readers">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push("/settings/payment-terminals")}
                      className="min-h-[44px] min-w-[140px] border-gray-600 text-black"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  </SettingRow>

                  <SettingRow label="Disconnect" description="Remove SumUp connection from this POS">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={disconnectSumUp}
                      className="min-h-[44px] min-w-[140px] border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    >
                      Disconnect
                    </Button>
                  </SettingRow>
                </>
              ) : (
                <>
                  <SettingRow label="Status" description="Not connected to SumUp">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      <span className="text-gray-500 text-sm">Not Connected</span>
                    </div>
                  </SettingRow>

                  {showSumUpForm ? (
                    <>
                      <SettingRow label="API Key" description="Your SumUp API key from developer portal">
                        <div className="flex gap-2">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={sumUpApiKey}
                            onChange={(e) => setSumUpApiKey(e.target.value)}
                            placeholder="sup_xxxxxxxxxx"
                            className="flex-1 bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="min-h-[44px] min-w-[80px] border-gray-600 text-black"
                          >
                            {showApiKey ? "Hide" : "Show"}
                          </Button>
                        </div>
                      </SettingRow>

                      <SettingRow label="Merchant Code" description="Your SumUp merchant code">
                        <input
                          type="text"
                          value={sumUpMerchantCodeInput}
                          onChange={(e) => setSumUpMerchantCodeInput(e.target.value)}
                          placeholder="MCXXXXXX"
                          className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                        />
                      </SettingRow>

                      <SettingRow label="Affiliate Key (Optional)" description="Your SumUp affiliate key if applicable">
                        <input
                          type="text"
                          value={sumUpAffiliateKey}
                          onChange={(e) => setSumUpAffiliateKey(e.target.value)}
                          placeholder="Optional"
                          className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                        />
                      </SettingRow>

                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={connectSumUp}
                          disabled={connectingSumUp}
                          className="flex-1 min-h-[44px] bg-penkey-orange hover:bg-orange-600"
                        >
                          {connectingSumUp ? (
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                          ) : (
                            "Connect SumUp"
                          )}
                        </Button>
                        <Button
                          onClick={() => setShowSumUpForm(false)}
                          variant="outline"
                          className="min-h-[44px] min-w-[140px] border-gray-600 text-black"
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <SettingRow label="Connect SumUp" description="Connect your SumUp account to accept card payments">
                      <Button
                        size="sm"
                        onClick={() => setShowSumUpForm(true)}
                        className="min-h-[44px] bg-penkey-orange hover:bg-orange-600"
                      >
                        Connect SumUp
                      </Button>
                    </SettingRow>
                  )}

                  <div className="mt-4 p-4 bg-[#2d2d2d] rounded-lg border border-gray-600">
                    <h4 className="font-semibold text-white mb-2">How to connect:</h4>
                    <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                      <li>Get your API key from <a href="https://developer.sumup.com" target="_blank" className="text-penkey-orange hover:underline">SumUp Developer Portal</a></li>
                      <li>Find your Merchant Code in your SumUp dashboard</li>
                      <li>Enter credentials above and click Connect</li>
                      <li>Start accepting card payments!</li>
                    </ol>
                  </div>
                </>
              )}
            </SettingsSection>

          </div>
        </div>
      </div>
    </div>
  );
}
