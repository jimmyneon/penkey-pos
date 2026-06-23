"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Star } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { SettingsSection, SettingRow, ToggleSwitch, SettingsHeader, SettingsLoading } from "@/components/settings/settings-shared";
import { ToastContainer } from "@/components/toast-container";
import { hapticSuccess, hapticButtonPress } from "@/lib/utils/haptics";

interface BeanRule {
  enabled: boolean;
  beans: number;
}

interface PerksBeanRules {
  baseBeans: number;
  reusableCup: BeanRule;
  foodDrinkCombo: BeanRule;
  penkeyCup: BeanRule;
  before9am: BeanRule;
  after230pm: BeanRule;
  monthlySpecial: BeanRule;
  broughtFriend: BeanRule;
}

export default function PerksSettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [perksDomain, setPerksDomain] = useState("");
  const [perksApiKey, setPerksApiKey] = useState("");
  const [savingPerks, setSavingPerks] = useState(false);
  const [showPerksApiKey, setShowPerksApiKey] = useState(false);

  const [perksBeanRules, setPerksBeanRules] = useState<PerksBeanRules>({
    baseBeans: 1,
    reusableCup: { enabled: false, beans: 1 },
    foodDrinkCombo: { enabled: false, beans: 1 },
    penkeyCup: { enabled: false, beans: 1 },
    before9am: { enabled: false, beans: 1 },
    after230pm: { enabled: false, beans: 1 },
    monthlySpecial: { enabled: false, beans: 1 },
    broughtFriend: { enabled: false, beans: 1 },
  });

  useEffect(() => {
    loadPerksSettings();
  }, []);

  const loadPerksSettings = async () => {
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (!sessionData) {
        router.push("/lock");
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch("/api/settings/perks", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        setPerksDomain(data.domain || "");
        setPerksApiKey(data.apiKey || "");
        if (data.beanRules) {
          setPerksBeanRules(data.beanRules);
        }
      }
    } catch (error) {
      console.error("Failed to load Perks settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePerksSettings = async () => {
    setSavingPerks(true);
    hapticButtonPress();
    try {
      const response = await fetch("/api/settings/perks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: perksDomain,
          apiKey: perksApiKey,
          beanRules: perksBeanRules,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save Perks settings");
      }

      showToast("Perks settings saved successfully!", "success");
      hapticSuccess();
    } catch (error) {
      showToast("Failed to save Perks settings: " + (error as Error).message, "error");
    } finally {
      setSavingPerks(false);
    }
  };

  if (loading) return <SettingsLoading />;

  return (
    <div className="h-dvh bg-[#2d2d2d] flex flex-col overflow-hidden">
      <SettingsHeader title="Perks Integration" onBack={() => router.push("/settings")} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-24">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

            <SettingsSection title="Perks App Integration" icon={Star}>
              <SettingRow label="Perks Domain" description="Base URL of the Perks app (e.g., https://perks.penkey.co.uk)">
                <input
                  type="text"
                  value={perksDomain}
                  onChange={(e) => setPerksDomain(e.target.value)}
                  placeholder="https://perks.penkey.co.uk"
                  className="w-full bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                />
              </SettingRow>

              <SettingRow label="Perks API Key" description="API key for Perks app authentication">
                <div className="flex gap-2">
                  <input
                    type={showPerksApiKey ? "text" : "password"}
                    value={perksApiKey}
                    onChange={(e) => setPerksApiKey(e.target.value)}
                    placeholder="Enter API key"
                    className="flex-1 bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPerksApiKey(!showPerksApiKey)}
                    className="min-h-[44px] min-w-[80px] border-gray-600 text-black"
                  >
                    {showPerksApiKey ? "Hide" : "Show"}
                  </Button>
                </div>
              </SettingRow>

              <div className="mt-6 space-y-4">
                <h4 className="text-white font-semibold">Bean Award Rules</h4>

                <SettingRow label="Base Beans" description="Number of beans awarded for every visit">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={perksBeanRules.baseBeans}
                    onChange={(e) => setPerksBeanRules({ ...perksBeanRules, baseBeans: parseInt(e.target.value) || 0 })}
                    className="w-20 bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base text-center"
                  />
                </SettingRow>

                <div className="space-y-3">
                  <h5 className="text-gray-300 text-sm font-medium">Additional Bean Bonuses</h5>

                  {[
                    { key: 'reusableCup' as const, label: 'Reusable Cup', desc: 'Customer brought their own cup' },
                    { key: 'foodDrinkCombo' as const, label: 'Food + Drink Combo', desc: 'Customer ordered food and drink' },
                    { key: 'penkeyCup' as const, label: 'Penkey Cup', desc: 'Customer using Penkey branded cup' },
                    { key: 'before9am' as const, label: 'Before 9am', desc: 'Early morning visit' },
                    { key: 'after230pm' as const, label: 'After 2:30pm', desc: 'Afternoon visit' },
                    { key: 'monthlySpecial' as const, label: 'Monthly Special', desc: 'Ordered monthly special item' },
                    { key: 'broughtFriend' as const, label: 'Brought a Friend', desc: 'Customer brought someone with them' },
                  ].map((rule) => {
                    const currentRule = perksBeanRules[rule.key];
                    return (
                      <div key={rule.key} className="bg-[#2d2d2d] rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-white font-medium text-sm">{rule.label}</span>
                            <p className="text-gray-400 text-xs">{rule.desc}</p>
                          </div>
                          <ToggleSwitch
                            checked={currentRule.enabled}
                            onChange={(checked) => {
                              setPerksBeanRules({
                                ...perksBeanRules,
                                [rule.key]: { ...currentRule, enabled: checked }
                              });
                            }}
                          />
                        </div>
                        {currentRule.enabled && (
                          <div className="flex items-center gap-2 pl-2">
                            <span className="text-gray-400 text-xs">Bonus beans:</span>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={currentRule.beans}
                              onChange={(e) => {
                                setPerksBeanRules({
                                  ...perksBeanRules,
                                  [rule.key]: { ...currentRule, beans: parseInt(e.target.value) || 1 }
                                });
                              }}
                              className="w-16 bg-[#3d3d3d] text-white px-2 py-1 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[36px] text-xs text-center"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  onClick={savePerksSettings}
                  disabled={savingPerks}
                  className="flex-1 min-h-[44px] bg-penkey-orange hover:bg-orange-600"
                >
                  {savingPerks ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    "Save Perks Settings"
                  )}
                </Button>
              </div>

              <div className="mt-4 p-4 bg-[#2d2d2d] rounded-lg border border-gray-600">
                <h4 className="font-semibold text-white mb-2">About Perks Integration:</h4>
                <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                  <li>Scan customer QR codes from the Perks app</li>
                  <li>View customer bean balance and active vouchers</li>
                  <li>Award beans based on customer behavior</li>
                  <li>Redeem customer vouchers</li>
                </ul>
              </div>
            </SettingsSection>

          </div>
        </div>
      </div>
    </div>
  );
}
