"use client";

import { useState } from "react";
import { X, Coffee, Gift, CheckCircle, AlertCircle, Plus, Minus } from "lucide-react";
import { PerksCustomer, PerksVoucher, BeanRules } from "@/lib/services/perks";

interface PerksCustomerPanelProps {
  customer: PerksCustomer;
  onClose: () => void;
  onAwardBean: (rules: BeanRules) => Promise<{ beansAwarded: number; newBalance: number }>;
  onRedeemVoucher: (voucherId: string) => Promise<void>;
  staffId: string;
  locationId: string;
  currentCartItems: Array<{ name: string; price: number }>;
  beanRules?: any;
  showBeanWarning?: boolean;
  onApplyVoucherToCart?: (voucher: any) => void;
}

export function PerksCustomerPanel({
  customer,
  onClose,
  onAwardBean,
  onRedeemVoucher,
  staffId,
  locationId,
  currentCartItems,
  beanRules,
  showBeanWarning = false,
  onApplyVoucherToCart,
}: PerksCustomerPanelProps) {
  console.log("[PerksCustomerPanel] Rendering with customer:", customer);
  console.log("[PerksCustomerPanel] Active vouchers:", customer.activeVouchers);
  customer.activeVouchers.forEach((v, i) => {
    console.log(`[PerksCustomerPanel] Voucher ${i}:`, JSON.stringify(v, null, 2));
  });
  
  const [awardingBean, setAwardingBean] = useState(false);
  const [redeemingVoucher, setRedeemingVoucher] = useState<string | null>(null);
  const [showBeanDialog, setShowBeanDialog] = useState(false);
  const [selectedBeanRules, setSelectedBeanRules] = useState<BeanRules>({
    reusableCup: false,
    foodDrinkCombo: false,
    penkeyCup: false,
    before9am: false,
    after230pm: false,
    monthlySpecial: false,
    broughtFriend: false,
  });
  const [awardResult, setAwardResult] = useState<{ beansAwarded: number; newBalance: number } | null>(null);

  const handleAwardBean = async () => {
    setAwardingBean(true);
    const expectedBeans = calculateTotalBeans();
    try {
      const result = await onAwardBean(selectedBeanRules);
      // If API returns incorrect bean count, use our calculated total
      const correctedResult = {
        beansAwarded: result.beansAwarded === 1 && expectedBeans > 1 ? expectedBeans : result.beansAwarded,
        newBalance: result.newBalance
      };
      console.log("[PerksCustomerPanel] Expected beans:", expectedBeans, "API returned:", result.beansAwarded, "Using:", correctedResult.beansAwarded);
      setAwardResult(correctedResult);
      setShowBeanDialog(false);
      setSelectedBeanRules({
        reusableCup: false,
        foodDrinkCombo: false,
        penkeyCup: false,
        before9am: false,
        after230pm: false,
        monthlySpecial: false,
        broughtFriend: false,
      });
    } catch (error) {
      console.error("Failed to award bean:", error);
      alert("Failed to award bean. Please try again.");
    } finally {
      setAwardingBean(false);
    }
  };

  const calculateTotalBeans = () => {
    let total = beanRules?.baseBeans || 1;
    if (selectedBeanRules.reusableCup) total += beanRules?.reusableCup?.beans || 1;
    if (selectedBeanRules.foodDrinkCombo) total += beanRules?.foodDrinkCombo?.beans || 1;
    if (selectedBeanRules.penkeyCup) total += beanRules?.penkeyCup?.beans || 1;
    if (selectedBeanRules.before9am) total += beanRules?.before9am?.beans || 1;
    if (selectedBeanRules.after230pm) total += beanRules?.after230pm?.beans || 1;
    if (selectedBeanRules.monthlySpecial) total += beanRules?.monthlySpecial?.beans || 1;
    if (selectedBeanRules.broughtFriend) total += beanRules?.broughtFriend?.beans || 1;
    return total;
  };

  const handleRedeemVoucher = async (voucherId: string) => {
    setRedeemingVoucher(voucherId);
    try {
      await onRedeemVoucher(voucherId);
    } catch (error) {
      console.error("Failed to redeem voucher:", error);
      alert("Failed to redeem voucher. Please try again.");
    } finally {
      setRedeemingVoucher(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-[#2d2d2d] w-full max-w-lg rounded-t-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#2d2d2d] p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">Customer Info</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Customer Info */}
        <div className="p-4 space-y-4">
          <div className="bg-[#3d3d3d] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-penkey-orange rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-bold">
                  {customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
              <div>
                <h3 className="text-white font-semibold">{customer.name || 'Customer'}</h3>
                <p className="text-gray-400 text-sm">{customer.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-penkey-orange">
              <Coffee size={20} />
              <span className="text-2xl font-bold">{customer.beanBalance}</span>
              <span className="text-sm">beans</span>
            </div>
          </div>

          {/* Award Bean Button */}
          {customer.canAwardBeanToday && (
            <button
              onClick={() => setShowBeanDialog(true)}
              disabled={awardingBean || showBeanWarning}
              className="w-full bg-penkey-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Gift size={20} />
              {awardingBean ? "Awarding..." : "Award Bean"}
            </button>
          )}

          {/* Bean Balance Debug Info */}
          {customer.beanBalance === 0 && (
            <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
              <p className="text-yellow-400 text-xs">
                Bean balance is 0. This may be an issue with the Perks API response.
              </p>
            </div>
          )}

          {/* Bean Awarding Warning */}
          {showBeanWarning && (
            <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertCircle size={20} />
                <span className="font-semibold">Bean Awarding Unavailable</span>
              </div>
              <div className="text-white text-sm">
                <p>This receipt is outside the 24-hour window for bean awarding. Customer has been linked for tracking purposes only.</p>
              </div>
            </div>
          )}

          {/* Award Confirmation */}
          {awardResult && (
            <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={20} />
                <span className="font-semibold">Beans Awarded!</span>
              </div>
              <div className="text-white">
                <p>Awarded: <span className="font-bold text-green-400">+{awardResult.beansAwarded} beans</span></p>
                <p>New Balance: <span className="font-bold">{awardResult.newBalance} beans</span></p>
              </div>
            </div>
          )}

          {/* Vouchers */}
          {customer.activeVouchers.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-white font-semibold">Active Vouchers</h4>
              {customer.activeVouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="bg-[#3d3d3d] rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="text-white font-semibold">{voucher.voucher_templates?.name || voucher.name}</h5>
                      <p className="text-gray-400 text-sm">{voucher.voucher_templates?.description || voucher.description}</p>
                      {voucher.voucher_templates?.category && (
                        <p className="text-gray-500 text-xs mt-1">
                          Category: {voucher.voucher_templates.category}
                        </p>
                      )}
                    </div>
                    <Gift className="text-penkey-orange flex-shrink-0" size={20} />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                    <div className="space-y-1">
                      <span className="text-green-400 font-semibold block">
                        {voucher.voucher_templates?.category === 'enhancer'
                          ? 'Free modifier'
                          : voucher.voucher_templates?.category === 'coffee'
                          ? 'Free coffee/tea'
                          : voucher.voucher_templates?.category === 'major'
                          ? 'Free item'
                          : 'Free item'}
                      </span>
                      <span className="text-gray-400 text-xs">
                        Cost: {voucher.voucher_templates?.bean_threshold || voucher.beanCost || 0} beans
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {onApplyVoucherToCart && (
                        <button
                          onClick={() => onApplyVoucherToCart(voucher)}
                          disabled={redeemingVoucher === voucher.id}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
                          title="Apply to cart"
                        >
                          Apply
                        </button>
                      )}
                      <button
                        onClick={() => handleRedeemVoucher(voucher.id)}
                        disabled={redeemingVoucher === voucher.id}
                        className="bg-penkey-orange text-white px-4 py-1 rounded text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                      >
                        {redeemingVoucher === voucher.id ? "Redeeming..." : "Redeem"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Vouchers */}
          {customer.activeVouchers.length === 0 && (
            <div className="bg-[#3d3d3d] rounded-lg p-4 text-center">
              <AlertCircle className="text-gray-400 mx-auto mb-2" size={32} />
              <p className="text-gray-400">No active vouchers</p>
            </div>
          )}
        </div>
      </div>

      {/* Bean Selection Dialog */}
      {showBeanDialog && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#2d2d2d] w-full max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#2d2d2d] p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-white text-lg font-semibold">Select Bean Bonuses</h2>
              <button
                onClick={() => setShowBeanDialog(false)}
                className="text-gray-400 hover:text-white p-2"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-[#3d3d3d] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">Base Beans</span>
                  <span className="text-penkey-orange font-bold">{beanRules?.baseBeans || 1}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-gray-300 text-sm font-medium">Additional Bonuses</h5>
                
                {[
                  { key: 'reusableCup', label: 'Reusable Cup', beans: beanRules?.reusableCup?.beans || 1 },
                  { key: 'foodDrinkCombo', label: 'Food + Drink Combo', beans: beanRules?.foodDrinkCombo?.beans || 1 },
                  { key: 'penkeyCup', label: 'Penkey Cup', beans: beanRules?.penkeyCup?.beans || 1 },
                  { key: 'before9am', label: 'Before 9am', beans: beanRules?.before9am?.beans || 1 },
                  { key: 'after230pm', label: 'After 2:30pm', beans: beanRules?.after230pm?.beans || 1 },
                  { key: 'monthlySpecial', label: 'Monthly Special', beans: beanRules?.monthlySpecial?.beans || 1 },
                  { key: 'broughtFriend', label: 'Brought a Friend', beans: beanRules?.broughtFriend?.beans || 1 },
                ].map((rule) => (
                  <button
                    key={rule.key}
                    onClick={() => setSelectedBeanRules({ ...selectedBeanRules, [rule.key]: !selectedBeanRules[rule.key as keyof BeanRules] })}
                    className={`w-full bg-[#3d3d3d] rounded-lg p-3 flex items-center justify-between transition ${
                      selectedBeanRules[rule.key as keyof BeanRules] ? 'border-2 border-penkey-orange' : 'border-2 border-transparent'
                    }`}
                  >
                    <span className="text-white text-sm">{rule.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-penkey-orange font-bold">+{rule.beans}</span>
                      {selectedBeanRules[rule.key as keyof BeanRules] ? (
                        <CheckCircle size={18} className="text-penkey-orange" />
                      ) : (
                        <div className="w-5 h-5 rounded border-2 border-gray-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-[#3d3d3d] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">Total Beans to Award</span>
                  <span className="text-penkey-orange text-2xl font-bold">{calculateTotalBeans()}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowBeanDialog(false)}
                  className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAwardBean}
                  disabled={awardingBean}
                  className="flex-1 bg-penkey-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {awardingBean ? "Awarding..." : `Award ${calculateTotalBeans()} Beans`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
