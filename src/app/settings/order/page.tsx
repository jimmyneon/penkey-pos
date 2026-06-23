"use client";

import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Utensils, Zap, Clock } from "lucide-react";
import { useSettingsData } from "@/lib/hooks/use-settings-data";
import { useToast } from "@/lib/hooks/use-toast";
import { SettingsSection, SettingRow, ToggleSwitch, SettingsHeader, SettingsLoading } from "@/components/settings/settings-shared";
import { ToastContainer } from "@/components/toast-container";

export default function OrderSettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const { settings, loading, updateSetting } = useSettingsData(showToast);

  if (loading) return <SettingsLoading />;

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <SettingsHeader title="Order & Operations" onBack={() => router.push("/settings")} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-24">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

            <SettingsSection title="Operational Settings" icon={Utensils}>
              <SettingRow label="Default Dining Option" description="Pre-select dining option for new orders">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={settings?.default_dining_option === "eat-in" ? "default" : "outline"}
                    onClick={() => updateSetting("default_dining_option", "eat-in")}
                    className={`min-h-[44px] min-w-[140px] ${settings?.default_dining_option === "eat-in" ? "bg-penkey-orange" : ""}`}
                  >
                    Eat In
                  </Button>
                  <Button
                    size="sm"
                    variant={settings?.default_dining_option === "takeaway" ? "default" : "outline"}
                    onClick={() => updateSetting("default_dining_option", "takeaway")}
                    className={`min-h-[44px] min-w-[140px] ${settings?.default_dining_option === "takeaway" ? "bg-penkey-orange" : ""}`}
                  >
                    Takeaway
                  </Button>
                </div>
              </SettingRow>

              <SettingRow label="Require Customer Name" description="Always ask for customer name on orders">
                <ToggleSwitch
                  checked={settings?.require_customer_name}
                  onChange={(checked) => updateSetting("require_customer_name", checked)}
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Penkey Prompts" icon={Zap}>
              <SettingRow label="Enable Prompts" description="Show intelligent upsell suggestions">
                <ToggleSwitch
                  checked={settings?.penkey_prompts_enabled}
                  onChange={(checked) => updateSetting("penkey_prompts_enabled", checked)}
                />
              </SettingRow>

              {settings?.penkey_prompts_enabled && (
                <>
                  <SettingRow label="Auto-dismiss Time" description="Seconds before prompts auto-dismiss (0 = manual)">
                    <select
                      value={settings?.penkey_auto_dismiss_seconds}
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

                  <SettingRow label="Show Popular Items" description="Display popular items category">
                    <ToggleSwitch
                      checked={settings?.penkey_show_popular}
                      onChange={(checked) => updateSetting("penkey_show_popular", checked)}
                    />
                  </SettingRow>
                </>
              )}
            </SettingsSection>

            <SettingsSection title="Shift Management" icon={Clock}>
              <SettingRow label="Enable Shift Management" description="Track shifts, cash in/out, and end-of-day reconciliation">
                <ToggleSwitch
                  checked={settings?.shift_management_enabled}
                  onChange={(checked) => updateSetting("shift_management_enabled", checked)}
                />
              </SettingRow>

              {settings?.shift_management_enabled && (
                <>
                  <SettingRow label="Require Opening Cash" description="Require cash amount when opening a shift">
                    <ToggleSwitch
                      checked={settings?.require_opening_cash}
                      onChange={(checked) => updateSetting("require_opening_cash", checked)}
                    />
                  </SettingRow>

                  <SettingRow label="Auto-close Shift" description="Automatically close shift at end of day">
                    <ToggleSwitch
                      checked={settings?.auto_close_shift}
                      onChange={(checked) => updateSetting("auto_close_shift", checked)}
                    />
                  </SettingRow>

                  {settings?.auto_close_shift && (
                    <SettingRow label="Auto-close Time" description="Time to automatically close shift (24-hour format)">
                      <input
                        type="time"
                        value={settings?.auto_close_time}
                        onChange={(e) => updateSetting("auto_close_time", e.target.value)}
                        className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                      />
                    </SettingRow>
                  )}
                </>
              )}
            </SettingsSection>

          </div>
        </div>
      </div>
    </div>
  );
}
