"use client";

import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { Receipt, CreditCard, Printer } from "lucide-react";
import { useSettingsData } from "@/lib/hooks/use-settings-data";
import { useToast } from "@/lib/hooks/use-toast";
import { SettingsSection, SettingRow, SettingsHeader, SettingsLoading } from "@/components/settings/settings-shared";
import { ToastContainer } from "@/components/toast-container";

export default function ReceiptsSettingsPage() {
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToast();
  const { settings, loading, updateSetting } = useSettingsData(showToast);

  if (loading) return <SettingsLoading />;

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <SettingsHeader title="Receipts & Printing" onBack={() => router.push("/settings")} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-24">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

            <SettingsSection title="Receipt Settings" icon={Receipt}>
              <SettingRow label="Print Behaviour" description="When to print receipts after payment">
                <div className="flex gap-2 flex-wrap">
                  {(["always", "ask", "never"] as const).map((val) => (
                    <Button
                      key={val}
                      size="sm"
                      variant={settings?.print_behaviour === val ? "default" : "outline"}
                      onClick={() => updateSetting("print_behaviour", val)}
                      className={`min-h-[44px] min-w-[140px] capitalize ${settings?.print_behaviour === val ? "bg-penkey-orange" : ""}`}
                    >
                      {val === "always" ? "Always Print" : val === "ask" ? "Always Ask" : "Never Print"}
                    </Button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label="Number of Copies" description="How many receipt copies to print">
                <select
                  value={settings?.receipt_copies}
                  onChange={(e) => updateSetting("receipt_copies", parseInt(e.target.value))}
                  className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                >
                  <option value="1">1 copy</option>
                  <option value="2">2 copies</option>
                  <option value="3">3 copies</option>
                </select>
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Ticket / Kitchen Printing" icon={Printer}>
              <SettingRow label="Ticket Print Behaviour" description="When to print tickets during ordering">
                <div className="flex gap-2 flex-wrap">
                  {(["always", "ask", "never"] as const).map((val) => (
                    <Button
                      key={val}
                      size="sm"
                      variant={settings?.ticket_print_behaviour === val ? "default" : "outline"}
                      onClick={() => updateSetting("ticket_print_behaviour", val)}
                      className={`min-h-[44px] min-w-[140px] capitalize ${settings?.ticket_print_behaviour === val ? "bg-penkey-orange" : ""}`}
                    >
                      {val === "always" ? "Always Print" : val === "ask" ? "Always Ask" : "Never Print"}
                    </Button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label="Ticket Copies" description="How many ticket copies to print">
                <select
                  value={settings?.ticket_copies}
                  onChange={(e) => updateSetting("ticket_copies", parseInt(e.target.value))}
                  className="bg-[#3d3d3d] text-white px-3 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none min-h-[44px] text-sm sm:text-base"
                >
                  <option value="1">1 copy</option>
                  <option value="2">2 copies</option>
                  <option value="3">3 copies</option>
                </select>
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Tip Presets" icon={CreditCard}>
              <SettingRow
                label="Tip Preset Amounts"
                description="Customise the tip amounts shown to customers on the payment screen (in £)"
              >
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex gap-2 flex-wrap">
                    {(settings?.additional_settings?.tip_presets ?? [2, 5, 10]).map((preset: number, idx: number) => (
                      <div key={idx} className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-penkey-orange font-bold text-sm">£</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={preset}
                          onChange={(e) => {
                            const presets: number[] = [...(settings?.additional_settings?.tip_presets ?? [2, 5, 10])];
                            presets[idx] = parseFloat(e.target.value) || 0;
                            updateSetting("additional_settings", { ...(settings?.additional_settings || {}), tip_presets: presets });
                          }}
                          className="bg-[#3d3d3d] text-white pl-5 pr-2 py-2 rounded border border-gray-600 focus:border-penkey-orange focus:outline-none w-20 min-h-[44px] text-sm font-bold"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">These amounts appear as quick-select buttons on the tip screen before payment.</p>
                </div>
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Receipt Templates" icon={Receipt}>
              <SettingRow label="Template Editor" description="Create and preview receipt templates">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/settings/receipt-templates")}
                  className="min-h-[44px] min-w-[140px] border-gray-600 text-black"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Edit Templates
                </Button>
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Printer Status" icon={Printer}>
              <SettingRow label="Manage Printers" description="Add, remove, or configure receipt printers">
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

          </div>
        </div>
      </div>
    </div>
  );
}
