"use client";

import { useState } from "react";
import { X, Coffee, Gift, CheckCircle, AlertCircle } from "lucide-react";
import { PerksCustomer, PerksVoucher, BeanRules } from "@/lib/services/perks";

interface PerksCustomerPanelProps {
  customer: PerksCustomer;
  onClose: () => void;
  onAwardBean: (rules: BeanRules) => Promise<void>;
  onRedeemVoucher: (voucherId: string) => Promise<void>;
  staffId: string;
  locationId: string;
  currentCartItems: Array<{ name: string; price: number }>;
}

export function PerksCustomerPanel({
  customer,
  onClose,
  onAwardBean,
  onRedeemVoucher,
  staffId,
  locationId,
  currentCartItems,
}: PerksCustomerPanelProps) {
  const [awardingBean, setAwardingBean] = useState(false);
  const [redeemingVoucher, setRedeemingVoucher] = useState<string | null>(null);
  const [beanRules, setBeanRules] = useState<BeanRules>({
    reusableCup: false,
    foodDrinkCombo: false,
    penkeyCup: false,
    before9am: false,
    after230pm: false,
    monthlySpecial: false,
    broughtFriend: false,
  });
  const [showBeanForm, setShowBeanForm] = useState(false);

  const handleAwardBean = async () => {
    setAwardingBean(true);
    try {
      await onAwardBean(beanRules);
      setShowBeanForm(false);
      setBeanRules({
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

  const calculateBeanCount = () => {
    let count = 0;
    if (beanRules.reusableCup) count += 1;
    if (beanRules.foodDrinkCombo) count += 1;
    if (beanRules.penkeyCup) count += 1;
    if (beanRules.before9am) count += 1;
    if (beanRules.after230pm) count += 1;
    if (beanRules.monthlySpecial) count += 2;
    if (beanRules.broughtFriend) count += 2;
    return count;
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
              onClick={() => setShowBeanForm(!showBeanForm)}
              className="w-full bg-penkey-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition flex items-center justify-center gap-2"
            >
              <Gift size={20} />
              Award Bean
            </button>
          )}

          {/* Bean Award Form */}
          {showBeanForm && (
            <div className="bg-[#3d3d3d] rounded-lg p-4 space-y-3">
              <h4 className="text-white font-semibold">Bean Rules</h4>
              <p className="text-gray-400 text-sm">Select applicable rules:</p>
              
              {[
                { key: 'reusableCup', label: 'Reusable cup', beans: 1 },
                { key: 'foodDrinkCombo', label: 'Food + drink combo', beans: 1 },
                { key: 'penkeyCup', label: 'Penkey cup', beans: 1 },
                { key: 'before9am', label: 'Before 9am', beans: 1 },
                { key: 'after230pm', label: 'After 2:30pm', beans: 1 },
                { key: 'monthlySpecial', label: 'Monthly special', beans: 2 },
                { key: 'broughtFriend', label: 'Brought friend', beans: 2 },
              ].map((rule) => (
                <label key={rule.key} className="flex items-center justify-between text-white">
                  <span className="text-sm">{rule.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-penkey-orange text-sm">+{rule.beans}</span>
                    <input
                      type="checkbox"
                      checked={beanRules[rule.key as keyof BeanRules]}
                      onChange={(e) =>
                        setBeanRules({ ...beanRules, [rule.key]: e.target.checked })
                      }
                      className="w-5 h-5 rounded"
                    />
                  </div>
                </label>
              ))}

              <div className="pt-2 border-t border-gray-600">
                <p className="text-white font-semibold">
                  Total beans: {calculateBeanCount()}
                </p>
              </div>

              <button
                onClick={handleAwardBean}
                disabled={awardingBean || calculateBeanCount() === 0}
                className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {awardingBean ? "Awarding..." : "Award Beans"}
              </button>
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
                    <div>
                      <h5 className="text-white font-semibold">{voucher.name}</h5>
                      <p className="text-gray-400 text-sm">{voucher.description}</p>
                    </div>
                    <Gift className="text-penkey-orange" size={20} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-400 font-semibold">
                      {voucher.discountType === 'percentage'
                        ? `${voucher.discountValue}% off`
                        : voucher.discountType === 'fixed'
                        ? `£${voucher.discountValue.toFixed(2)} off`
                        : 'Free item'}
                    </span>
                    <button
                      onClick={() => handleRedeemVoucher(voucher.id)}
                      disabled={redeemingVoucher === voucher.id}
                      className="bg-penkey-orange text-white px-4 py-1 rounded text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                    >
                      {redeemingVoucher === voucher.id ? "Redeeming..." : "Redeem"}
                    </button>
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
    </div>
  );
}
