"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { 
  ArrowLeft, 
  Grid3x3, 
  List, 
  Moon, 
  Sun, 
  Type, 
  Zap, 
  Bell, 
  Vibrate, 
  Printer, 
  Receipt, 
  Utensils,
  User,
  Save,
  RotateCcw,
  LogOut,
  Lock,
  Key,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  WifiOff
} from "lucide-react";
import { registerSettings, RegisterSettings, DEFAULT_SETTINGS } from "@/lib/services/register-settings";
import { hapticSuccess, hapticButtonPress } from "@/lib/utils/haptics";
import { useToast } from "@/lib/hooks/use-toast";
import { ToastContainer } from "@/components/toast-container";
import {
  storeSumUpCredentials,
  getSumUpCredentials,
  clearSumUpCredentials,
  validateStoredCredentials,
} from "@/lib/services/sumup-credentials";

export default function SettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [settings, setSettings] = useState<RegisterSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registerId, setRegisterId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  
  // SumUp OAuth settings
  const [sumUpConnected, setSumUpConnected] = useState(false);
  const [sumUpMerchantCode, setSumUpMerchantCode] = useState("");
  const [connectingSumUp, setConnectingSumUp] = useState(false);

  // Printer status
  const [printerStatus, setPrinterStatus] = useState<"unknown" | "online" | "offline" | "checking">("unknown");
  const [printerCount, setPrinterCount] = useState(0);

  const checkPrinterStatus = async () => {
    setPrinterStatus("checking");
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const resp = await fetch("/api/printers", {
        headers: sessionData ? { "x-pos-session": sessionData } : {},
      });
      if (!resp.ok) throw new Error("Failed to fetch printers");
      const data = await resp.json();
      const printers: any[] = data.printers || [];
      setPrinterCount(printers.length);
      const anyOnline = printers.some((p: any) => p.status === "online");
      setPrinterStatus(printers.length === 0 ? "offline" : anyOnline ? "online" : "offline");
    } catch {
      setPrinterStatus("offline");
    }
  };
  const [showSumUpForm, setShowSumUpForm] = useState(false);
  const [sumUpApiKey, setSumUpApiKey] = useState("");
  const [sumUpMerchantCodeInput, setSumUpMerchantCodeInput] = useState("");
  const [sumUpAffiliateKey, setSumUpAffiliateKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Get register ID from session (try sessionStorage first, then localStorage)
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) {
        console.error("No session found");
        showToast("No session found. Please log in again.", "error");
        router.push("/lock");
        return;
      }

      const session = JSON.parse(sessionData);
      const regId = session.register?.id;
      
      if (!regId) {
        console.error("No register ID in session");
        showToast("No register ID found. Please log in again.", "error");
        router.push("/lock");
        return;
      }

      setRegisterId(regId);
      setUserEmail(session.employee?.email || session.employee?.name || "User");
      console.log("[Settings] Loading settings for register:", regId);

      // Load settings from database via API endpoint
      const sessionDataForApi = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const settingsRes = await fetch(`/api/register/settings?register_id=${regId}`, {
        headers: {
          ...(sessionDataForApi && { "x-pos-session": sessionDataForApi }),
        },
      });

      if (settingsRes.ok) {
        const loadedSettings = await settingsRes.json();
        console.log("[Settings] Loaded settings:", loadedSettings);
        setSettings(loadedSettings);
      } else {
        console.warn("[Settings] Failed to load settings from API, using defaults");
        setSettings(DEFAULT_SETTINGS);
      }

      // Load SumUp connection status from DB (persists across devices)
      try {
        const credsRes = await fetch('/api/sumup/credentials');
        if (credsRes.ok) {
          const credsData = await credsRes.json();
          if (credsData.configured) {
            setSumUpConnected(true);
            setSumUpMerchantCode(credsData.merchant_code || '');
            setSumUpAffiliateKey(credsData.affiliate_key || '');
          } else {
            setSumUpConnected(false);
          }
        }
      } catch (e) {
        // Non-fatal - fall back to localStorage mirror
        const storedCreds = getSumUpCredentials();
        if (storedCreds?.apiKey && storedCreds?.merchantCode) {
          setSumUpConnected(true);
          setSumUpMerchantCode(storedCreds.merchantCode);
        }
      }

      // Handle OAuth callback from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const callbackSuccess = urlParams.get("sumup_callback");
      const callbackError = urlParams.get("sumup_error");
      
      if (callbackSuccess === "success") {
        await handleOAuthCallback();
      } else if (callbackError) {
        showToast(`SumUp connection failed: ${callbackError}`, "error");
        // Clean up URL
        window.history.replaceState({}, "", "/settings");
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      showToast("Failed to load settings: " + (error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async () => {
  try {
    // Get callback data from cookie
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

    // Exchange code for token
    const response = await fetch("/api/auth/sumup/exchange", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: callbackData.code,
        state: callbackData.state,
      }),
    });

    if (response.ok) {
      const tokenData = await response.json();
      
      if (tokenData.success) {
        // Save tokens
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
    
    // Clean up cookie and URL
    document.cookie = "sumup_oauth_callback=; Max-Age=0; path=/";
    window.history.replaceState({}, "", "/settings");
  } catch (error) {
    console.error("OAuth callback error:", error);
    showToast("Failed to complete OAuth connection", "error");
  }
};

  const connectSumUp = async () => {
    setConnectingSumUp(true);
    hapticButtonPress();

    try {
      // Validate input
      if (!sumUpApiKey.trim() || !sumUpMerchantCodeInput.trim()) {
        showToast("API Key and Merchant Code are required", "error");
        return;
      }

      // Validate API key credentials
      const { OfflineSumUpClient } = await import("@penkey/sumup");
      const sumUpClient = new OfflineSumUpClient({
        // OAuth fields (required by type but empty for API key auth)
        clientId: "",
        clientSecret: "",
        redirectUri: "",
        environment: "production",
        // API key fields
        apiKey: sumUpApiKey.trim(),
        merchantCode: sumUpMerchantCodeInput.trim(),
        affiliateKey: sumUpAffiliateKey.trim(),
        appId: "com.penkey.pos",
      });

      const isValid = await sumUpClient.validateCredentials();

      if (isValid) {
        // Save to DB (persists across all devices for this org)
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

        // Also mirror to localStorage so client-side reads (payment page) are instant
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
      } else {
        showToast('Invalid SumUp API credentials. Please check your API key and merchant code.', 'error');
      }
    } catch (error) {
      console.error("Failed to validate SumUp credentials:", error);
      showToast("Failed to validate SumUp credentials", "error");
    } finally {
      setConnectingSumUp(false);
    }
  };

  const disconnectSumUp = async () => {
    try {
      // Remove from DB
      await fetch('/api/sumup/credentials', { method: 'DELETE' });
      // Clear localStorage mirror too
      clearSumUpCredentials();
      setSumUpConnected(false);
      setSumUpMerchantCode('');
      setSumUpApiKey('');
      setSumUpMerchantCodeInput('');
      setSumUpAffiliateKey('');
      showToast('SumUp disconnected', 'info');
    } catch (error) {
      console.error('Failed to disconnect SumUp:', error);
      showToast('Failed to disconnect SumUp', 'error');
    }
  };

  const handleSave = async () => {
    if (!registerId) {
      showToast("No register ID found. Please log in again.", "error");
      return;
    }

    setSaving(true);
    hapticButtonPress();

    try {
      console.log("[Settings] Saving settings for register:", registerId);
      console.log("[Settings] Settings to save:", settings);

      // Use API endpoint instead of RPC (more reliable)
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const response = await fetch("/api/register/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionData && { "x-pos-session": sessionData }),
        },
        body: JSON.stringify({
          register_id: registerId,
          settings,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }

      console.log("[Settings] Settings saved successfully");
      hapticSuccess();

      // Show success message
      showToast("Settings saved successfully!", "success");

      // Reload settings to confirm via API
      const sessionDataForReload = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      const reloadRes = await fetch(`/api/register/settings?register_id=${registerId}`, {
        headers: {
          ...(sessionDataForReload && { "x-pos-session": sessionDataForReload }),
        },
      });

      if (reloadRes.ok) {
        const reloadedSettings = await reloadRes.json();
        console.log("[Settings] Reloaded settings:", reloadedSettings);
        setSettings(reloadedSettings);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast("Failed to save settings: " + (error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    hapticButtonPress();
    setSettings(DEFAULT_SETTINGS);
    showToast("Settings reset to defaults. Click Save to apply.", "info");
  };

  const updateSetting = async <K extends keyof RegisterSettings>(
    key: K,
    value: RegisterSettings[K]
  ) => {
    hapticButtonPress();
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save to database immediately
    if (registerId) {
      try {
        const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
        const session = sessionData ? JSON.parse(sessionData) : null;
        const response = await fetch("/api/register/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionData && { "x-pos-session": sessionData }),
          },
          body: JSON.stringify({
            register_id: registerId,
            org_id: session?.org_id,
            settings: newSettings,
          }),
        });

        if (!response.ok) {
          console.error("Failed to save setting immediately:", await response.json());
          showToast("Failed to save setting", "error");
        }
      } catch (error) {
        console.error("Failed to save setting immediately:", error);
      }
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
      // Get current session data
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      
      if (!sessionData) {
        showToast("Not authenticated", "error");
        return;
      }

      const session = JSON.parse(sessionData);
      const employeeId = session.employee.id;

      console.log("[Passcode] Verifying current passcode for employee:", employeeId);

      // Step 1: Verify current PIN using the auth API
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

      console.log("[Passcode] Current PIN verified, updating to new PIN");

      // Step 2: Update PIN using the API endpoint
      const updateResponse = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          employeeId: employeeId,
          newPin: newPasscode 
        }),
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
      console.error("Failed to change passcode:", error);
      showToast("Failed to change passcode: " + (error as Error).message, "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-white text-lg">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-3 sm:px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0 z-10">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/sell")}
          className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px] p-2"
        >
          <ArrowLeft className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Back to POS</span>
        </Button>
        <h1 className="font-semibold text-base sm:text-lg">POS Settings</h1>
        <div className="w-[44px] sm:w-32"></div>
      </header>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-32 sm:pb-8">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          
          {/* Display Preferences */}
          <SettingsSection title="Display Preferences" icon={Grid3x3}>
            <SettingRow
              label="Theme"
              description="Choose your preferred color scheme"
            >
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={settings.theme === "dark" ? "default" : "outline"}
                  onClick={() => updateSetting("theme", "dark")}
                  className={`min-h-[44px] min-w-[140px] ${settings.theme === "dark" ? "bg-penkey-orange" : ""}`}
                >
                  <Moon className="h-4 w-4 mr-2" />
                  Dark
                </Button>
                <Button
                  size="sm"
                  variant={settings.theme === "light" ? "default" : "outline"}
                  onClick={() => updateSetting("theme", "light")}
                  className={`min-h-[44px] min-w-[140px] ${settings.theme === "light" ? "bg-penkey-orange" : ""}`}
                >
                  <Sun className="h-4 w-4 mr-2" />
                  Light
                </Button>
              </div>
            </SettingRow>

            <SettingRow
              label="Item Button Text Size"
              description="Adjust text size in item buttons on sell page"
            >
              <div className="flex gap-2 flex-wrap">
                {(["small", "medium", "large"].map((size) => (
                  <Button
                    key={size}
                    size="sm"
                    variant={settings.font_size === size ? "default" : "outline"}
                    onClick={() => updateSetting("font_size", size as any)}
                    className={`min-h-[44px] min-w-[140px] ${settings.font_size === size ? "bg-penkey-orange" : ""}`}
                  >
                    <Type className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="text-xs sm:text-sm">{size.charAt(0).toUpperCase() + size.slice(1)}</span>
                  </Button>
                )))}
              </div>
            </SettingRow>

            <SettingRow
              label="Grid Size"
              description="Number of item columns in grid view"
            >
              <div className="flex gap-2 flex-wrap">
                {/* 2 Columns - Mobile only */}
                <Button
                  size="sm"
                  variant={settings.grid_size === 2 ? "default" : "outline"}
                  onClick={() => updateSetting("grid_size", 2)}
                  className={`min-h-[44px] min-w-[140px] md:hidden ${settings.grid_size === 2 ? "bg-penkey-orange" : ""}`}
                >
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  2 Columns
                </Button>
                
                {/* 3 Columns - All devices */}
                <Button
                  size="sm"
                  variant={settings.grid_size === 3 ? "default" : "outline"}
                  onClick={() => updateSetting("grid_size", 3)}
                  className={`min-h-[44px] min-w-[140px] ${settings.grid_size === 3 ? "bg-penkey-orange" : ""}`}
                >
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  3 Columns
                </Button>
                
                {/* 4 Columns - All devices */}
                <Button
                  size="sm"
                  variant={settings.grid_size === 4 ? "default" : "outline"}
                  onClick={() => updateSetting("grid_size", 4)}
                  className={`min-h-[44px] min-w-[140px] ${settings.grid_size === 4 ? "bg-penkey-orange" : ""}`}
                >
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  4 Columns
                </Button>
                
                {/* 5 Columns - iPad and Desktop */}
                <Button
                  size="sm"
                  variant={settings.grid_size === 5 ? "default" : "outline"}
                  onClick={() => updateSetting("grid_size", 5)}
                  className={`min-h-[44px] min-w-[140px] hidden md:inline-flex ${settings.grid_size === 5 ? "bg-penkey-orange" : ""}`}
                >
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  5 Columns
                </Button>
                
                {/* 6 Columns - Desktop only */}
                <Button
                  size="sm"
                  variant={settings.grid_size === 6 ? "default" : "outline"}
                  onClick={() => updateSetting("grid_size", 6)}
                  className={`min-h-[44px] min-w-[140px] hidden lg:inline-flex ${settings.grid_size === 6 ? "bg-penkey-orange" : ""}`}
                >
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  6 Columns
                </Button>
              </div>
            </SettingRow>
          </SettingsSection>

          {/* Penkey Prompts */}
          <SettingsSection title="Penkey Prompts" icon={Zap}>
            <SettingRow
              label="Enable Prompts"
              description="Show intelligent upsell suggestions"
            >
              <ToggleSwitch
                checked={settings.penkey_prompts_enabled}
                onChange={(checked) => updateSetting("penkey_prompts_enabled", checked)}
              />
            </SettingRow>

            {settings.penkey_prompts_enabled && (
              <>
                <SettingRow
                  label="Auto-dismiss Time"
                  description="Seconds before prompts auto-dismiss (0 = manual)"
                >
                  <select
                    value={settings.penkey_auto_dismiss_seconds}
                    onChange={(e) => updateSetting("penkey_auto_dismiss_seconds", parseInt(e.target.value))}
                    className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                  >
                    <option value="0">Manual only</option>
                    <option value="2">2 seconds</option>
                    <option value="3">3 seconds</option>
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                  </select>
                </SettingRow>

                <SettingRow
                  label="Show Popular Items"
                  description="Display popular items category"
                >
                  <ToggleSwitch
                    checked={settings.penkey_show_popular}
                    onChange={(checked) => updateSetting("penkey_show_popular", checked)}
                  />
                </SettingRow>
              </>
            )}
          </SettingsSection>

          {/* Receipt Settings */}
          <SettingsSection title="Receipt Settings" icon={Receipt}>
            <SettingRow
              label="Print Behaviour"
              description="When to print receipts after payment"
            >
              <div className="flex gap-2 flex-wrap">
                {(["always", "ask", "never"] as const).map((val) => (
                  <Button
                    key={val}
                    size="sm"
                    variant={settings.print_behaviour === val ? "default" : "outline"}
                    onClick={() => updateSetting("print_behaviour", val)}
                    className={`min-h-[44px] min-w-[140px] capitalize ${settings.print_behaviour === val ? "bg-penkey-orange" : ""}`}
                  >
                    {val === "always" ? "Always Print" : val === "ask" ? "Always Ask" : "Never Print"}
                  </Button>
                ))}
              </div>
            </SettingRow>

            <SettingRow
              label="Number of Copies"
              description="How many receipt copies to print"
            >
              <select
                value={settings.receipt_copies}
                onChange={(e) => updateSetting("receipt_copies", parseInt(e.target.value))}
                className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
              >
                <option value="1">1 copy</option>
                <option value="2">2 copies</option>
                <option value="3">3 copies</option>
              </select>
            </SettingRow>
          </SettingsSection>

          {/* Printer Status */}
          <SettingsSection title="Printer Status" icon={Printer}>
            <SettingRow
              label="Print Server"
              description="Check if the Raspberry Pi print server is online and printers are ready"
            >
              <div className="flex items-center gap-3">
                {printerStatus === "unknown" && (
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-500 text-sm">Not checked</span>
                  </div>
                )}
                {printerStatus === "checking" && (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
                    <span className="text-gray-400 text-sm">Checking...</span>
                  </div>
                )}
                {printerStatus === "online" && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-500 text-sm">{printerCount} printer{printerCount !== 1 ? "s" : ""} online</span>
                  </div>
                )}
                {printerStatus === "offline" && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-red-400 text-sm">{printerCount === 0 ? "No printers configured" : "No printers online"}</span>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { hapticButtonPress(); checkPrinterStatus(); }}
                  disabled={printerStatus === "checking"}
                  className="min-h-[44px] min-w-[140px] border-gray-600 text-black"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${printerStatus === "checking" ? "animate-spin" : ""}`} />
                  Check
                </Button>
              </div>
            </SettingRow>

            <SettingRow
              label="Manage Printers"
              description="Add, remove, or configure receipt printers"
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/settings/printers")}
                className="min-h-[44px] min-w-[140px] border-gray-600 text-black"
              >
                <Printer className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </SettingRow>
          </SettingsSection>

          {/* SumUp Payment Settings */}
          <SettingsSection title="SumUp Payments" icon={CreditCard}>
            {sumUpConnected ? (
              <>
                <SettingRow
                  label="Connected"
                  description={`SumUp account connected (${sumUpMerchantCode})`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-green-500 text-sm">Connected</span>
                  </div>
                </SettingRow>

                <SettingRow
                  label="Merchant Code"
                  description="Your SumUp merchant code"
                >
                  <div className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 min-h-[44px] text-sm sm:text-base">
                    {sumUpMerchantCode}
                  </div>
                </SettingRow>

                <SettingRow
                  label="Payment Terminals"
                  description="Pair and manage SumUp Solo card readers"
                >
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

                <SettingRow
                  label="Disconnect"
                  description="Remove SumUp connection from this POS"
                >
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
                <SettingRow
                  label="Status"
                  description="Not connected to SumUp"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <span className="text-gray-500 text-sm">Not Connected</span>
                  </div>
                </SettingRow>

                {showSumUpForm ? (
                  <>
                    <SettingRow
                      label="API Key"
                      description="Your SumUp API key from developer portal"
                    >
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

                    <SettingRow
                      label="Merchant Code"
                      description="Your SumUp merchant code"
                    >
                      <input
                        type="text"
                        value={sumUpMerchantCodeInput}
                        onChange={(e) => setSumUpMerchantCodeInput(e.target.value)}
                        placeholder="MCXXXXXX"
                        className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                      />
                    </SettingRow>

                    <SettingRow
                      label="Affiliate Key (Optional)"
                      description="Your SumUp affiliate key if applicable"
                    >
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
                  <SettingRow
                    label="Connect SumUp"
                    description="Connect your SumUp account to accept card payments"
                  >
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

          {/* Operational Settings */}
          <SettingsSection title="Operational Settings" icon={Utensils}>
            <SettingRow
              label="Default Dining Option"
              description="Pre-select dining option for new orders"
            >
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={settings.default_dining_option === "eat-in" ? "default" : "outline"}
                  onClick={() => updateSetting("default_dining_option", "eat-in")}
                  className={`min-h-[44px] min-w-[140px] ${settings.default_dining_option === "eat-in" ? "bg-penkey-orange" : ""}`}
                >
                  Eat In
                </Button>
                <Button
                  size="sm"
                  variant={settings.default_dining_option === "takeaway" ? "default" : "outline"}
                  onClick={() => updateSetting("default_dining_option", "takeaway")}
                  className={`min-h-[44px] min-w-[140px] ${settings.default_dining_option === "takeaway" ? "bg-penkey-orange" : ""}`}
                >
                  Takeaway
                </Button>
              </div>
            </SettingRow>

            <SettingRow
              label="Require Customer Name"
              description="Always ask for customer name on orders"
            >
              <ToggleSwitch
                checked={settings.require_customer_name}
                onChange={(checked) => updateSetting("require_customer_name", checked)}
              />
            </SettingRow>
          </SettingsSection>

          {/* Shift Management */}
          <SettingsSection title="Shift Management" icon={Clock}>
            <SettingRow
              label="Enable Shift Management"
              description="Track shifts, cash in/out, and end-of-day reconciliation"
            >
              <ToggleSwitch
                checked={settings.shift_management_enabled}
                onChange={(checked) => updateSetting("shift_management_enabled", checked)}
              />
            </SettingRow>

            {settings.shift_management_enabled && (
              <>
                <SettingRow
                  label="Require Opening Cash"
                  description="Require cash amount when opening a shift"
                >
                  <ToggleSwitch
                    checked={settings.require_opening_cash}
                    onChange={(checked) => updateSetting("require_opening_cash", checked)}
                  />
                </SettingRow>

                <SettingRow
                  label="Auto-close Shift"
                  description="Automatically close shift at end of day"
                >
                  <ToggleSwitch
                    checked={settings.auto_close_shift}
                    onChange={(checked) => updateSetting("auto_close_shift", checked)}
                  />
                </SettingRow>

                {settings.auto_close_shift && (
                  <SettingRow
                    label="Auto-close Time"
                    description="Time to automatically close shift (24-hour format)"
                  >
                    <input
                      type="time"
                      value={settings.auto_close_time}
                      onChange={(e) => updateSetting("auto_close_time", e.target.value)}
                      className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                    />
                  </SettingRow>
                )}
              </>
            )}
          </SettingsSection>

          {/* Feedback Settings */}
          <SettingsSection title="Feedback" icon={Bell}>
            <SettingRow
              label="Sound Effects"
              description="Play sounds for actions"
            >
              <ToggleSwitch
                checked={settings.sound_enabled}
                onChange={(checked) => updateSetting("sound_enabled", checked)}
              />
            </SettingRow>

            <SettingRow
              label="Haptic Feedback"
              description="Vibrate on button presses (mobile only)"
            >
              <ToggleSwitch
                checked={settings.haptic_enabled}
                onChange={(checked) => updateSetting("haptic_enabled", checked)}
              />
            </SettingRow>
          </SettingsSection>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-700 sticky bottom-0 bg-[#2d2d2d] pb-3 sm:pb-0 sm:static">
            <button
              onClick={handleReset}
              className="border-2 border-gray-600 hover:bg-white/10 min-h-[48px] min-w-[180px] w-full sm:w-auto order-2 sm:order-1 flex items-center justify-center rounded-md bg-white text-black transition-all active:scale-95"
            >
              <RotateCcw className="h-4 w-4 mr-2 text-black" />
              <span className="text-sm sm:text-base text-black">Reset to Defaults</span>
            </button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-penkey-orange hover:bg-penkey-orange/90 text-white min-h-[48px] min-w-[180px] w-full sm:w-auto order-1 sm:order-2"
            >
              <Save className="h-4 w-4 mr-2" />
              <span className="text-sm sm:text-base">{saving ? "Saving..." : "Save Settings"}</span>
            </Button>
          </div>

          {/* Info Note */}
          <div className="bg-[#3d3d3d] rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-gray-400 border border-gray-700">
            <p className="mb-2 text-sm sm:text-base">ℹ️ <strong className="text-white">Note:</strong></p>
            <ul className="space-y-1 ml-4 leading-relaxed">
              <li>• These settings are saved per register</li>
              <li>• Changes sync across all devices using this register</li>
              <li className="hidden sm:list-item">• For business settings (payment methods, tax rates, etc.), contact your manager or use the Back Office</li>
              <li className="sm:hidden">• For business settings, use the Back Office</li>
            </ul>
          </div>

          {/* Security Section */}
          <SettingsSection title="Security" icon={Lock}>
            <SettingRow
              label="Lock Passcode"
              description="Change your 4-digit PIN for unlocking the POS"
            >
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
          </SettingsSection>

          {/* Sign Out Section */}
          <div className="bg-[#3d3d3d] rounded-lg p-4 sm:p-6 border border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base sm:text-lg mb-1">Account</h3>
                <p className="text-gray-400 text-sm">{userEmail}</p>
              </div>
              <Button
                onClick={() => {
                  hapticButtonPress();
                  sessionStorage.clear();
                  localStorage.clear();
                  showToast("Signed out successfully", "success");
                  setTimeout(() => router.push("/lock"), 500);
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

      {/* Change Passcode Dialog */}
      {showPasscodeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#3d3d3d] rounded-lg p-6 max-w-md w-full border border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="h-6 w-6 text-penkey-orange" />
              <h2 className="text-xl font-semibold text-white">Change Lock Passcode</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Current Passcode
                </label>
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
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  New Passcode (4 digits)
                </label>
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
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Confirm New Passcode
                </label>
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

// Helper Components
function SettingsSection({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode; 
}) {
  return (
    <div className="bg-[#3d3d3d] rounded-lg p-4 sm:p-6 border border-gray-700">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 pb-3 border-b border-gray-700">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-penkey-orange flex-shrink-0" />
        <h2 className="text-lg sm:text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-4 sm:space-y-4">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ 
  label, 
  description, 
  children 
}: { 
  label: string; 
  description: string; 
  children: React.ReactNode; 
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium text-sm sm:text-base">{label}</div>
        <div className="text-xs sm:text-sm text-gray-400 leading-relaxed">{description}</div>
      </div>
      <div className="flex-shrink-0 self-start sm:self-center">
        {children}
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 sm:h-5 sm:w-9 items-center rounded-full transition-colors ${
        checked ? "bg-penkey-orange" : "bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 sm:h-3 sm:w-3 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-2" : "-translate-x-2"
        }`}
      />
    </button>
  );
}
