"use client";

import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Moon, Sun, Type, Grid3x3, Bell, Vibrate } from "lucide-react";
import { useSettingsData } from "@/lib/hooks/use-settings-data";
import { useToast } from "@/lib/hooks/use-toast";
import { SettingsSection, SettingRow, ToggleSwitch, SettingsHeader, SettingsLoading } from "@/components/settings/settings-shared";
import { ToastContainer } from "@/components/toast-container";

export default function DisplaySettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const { settings, loading, updateSetting } = useSettingsData(showToast);

  if (loading) return <SettingsLoading />;

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <SettingsHeader title="Display & Feedback" onBack={() => router.push("/settings")} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-24">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

            <SettingsSection title="Display Preferences" icon={Grid3x3}>
              <SettingRow label="Theme" description="Choose your preferred color scheme">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={settings?.theme === "dark" ? "default" : "outline"}
                    onClick={() => updateSetting("theme", "dark")}
                    className={`min-h-[44px] min-w-[140px] ${settings?.theme === "dark" ? "bg-penkey-orange" : ""}`}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    size="sm"
                    variant={settings?.theme === "light" ? "default" : "outline"}
                    onClick={() => updateSetting("theme", "light")}
                    className={`min-h-[44px] min-w-[140px] ${settings?.theme === "light" ? "bg-penkey-orange" : ""}`}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                </div>
              </SettingRow>

              <SettingRow label="Item Button Text Size" description="Adjust text size in item buttons on sell page">
                <div className="flex gap-2 flex-wrap">
                  {(["very_small", "small", "medium", "large"].map((size) => (
                    <Button
                      key={size}
                      size="sm"
                      variant={settings?.font_size === size ? "default" : "outline"}
                      onClick={() => updateSetting("font_size", size as any)}
                      className={`min-h-[44px] min-w-[140px] ${settings?.font_size === size ? "bg-penkey-orange" : ""}`}
                    >
                      <Type className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">{size === "very_small" ? "XS" : (size?.charAt(0)?.toUpperCase() || "") + (size?.slice(1) || "")}</span>
                    </Button>
                  )))}
                </div>
              </SettingRow>

              <SettingRow label="Grid Size" description="Number of item columns in grid view">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={settings?.grid_size === 2 ? "default" : "outline"}
                    onClick={() => updateSetting("grid_size", 2)}
                    className={`min-h-[44px] min-w-[140px] md:hidden ${settings?.grid_size === 2 ? "bg-penkey-orange" : ""}`}
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    2 Columns
                  </Button>
                  <Button
                    size="sm"
                    variant={settings?.grid_size === 3 ? "default" : "outline"}
                    onClick={() => updateSetting("grid_size", 3)}
                    className={`min-h-[44px] min-w-[140px] ${settings?.grid_size === 3 ? "bg-penkey-orange" : ""}`}
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    3 Columns
                  </Button>
                  <Button
                    size="sm"
                    variant={settings?.grid_size === 4 ? "default" : "outline"}
                    onClick={() => updateSetting("grid_size", 4)}
                    className={`min-h-[44px] min-w-[140px] ${settings?.grid_size === 4 ? "bg-penkey-orange" : ""}`}
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    4 Columns
                  </Button>
                  <Button
                    size="sm"
                    variant={settings?.grid_size === 5 ? "default" : "outline"}
                    onClick={() => updateSetting("grid_size", 5)}
                    className={`min-h-[44px] min-w-[140px] hidden md:inline-flex ${settings?.grid_size === 5 ? "bg-penkey-orange" : ""}`}
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    5 Columns
                  </Button>
                  <Button
                    size="sm"
                    variant={settings?.grid_size === 6 ? "default" : "outline"}
                    onClick={() => updateSetting("grid_size", 6)}
                    className={`min-h-[44px] min-w-[140px] hidden lg:inline-flex ${settings?.grid_size === 6 ? "bg-penkey-orange" : ""}`}
                  >
                    <Grid3x3 className="h-4 w-4 mr-2" />
                    6 Columns
                  </Button>
                </div>
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Feedback" icon={Bell}>
              <SettingRow label="Sound Effects" description="Play sounds for actions">
                <ToggleSwitch
                  checked={settings?.sound_enabled}
                  onChange={(checked) => updateSetting("sound_enabled", checked)}
                />
              </SettingRow>

              <SettingRow label="Haptic Feedback" description="Vibrate on button presses (mobile only)">
                <ToggleSwitch
                  checked={settings?.haptic_enabled}
                  onChange={(checked) => updateSetting("haptic_enabled", checked)}
                />
              </SettingRow>
            </SettingsSection>

          </div>
        </div>
      </div>
    </div>
  );
}
