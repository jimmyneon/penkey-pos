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
  console.log("[PerksCustomerPanel] Rendering with customer:", customer);
  
  const [awardingBean, setAwardingBean] = useState(false);
  const [redeemingVoucher, setRedeemingVoucher] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>("visit");
  const [showReasonSelector, setShowReasonSelector] = useState(false);

  const beanReasons = [
    { id: "visit", label: "Visit", beans: 1 },
    { id: "reusable_cup", label: "Reusable Cup", beans: 2 },
    { id: "social_media", label: "Social Media Share", beans: 2 },
    { id: "brought_friend", label: "Brought Friend", beans: 2 },
    { id: "food_combo", label: "Food + Drink Combo", beans: 1 },
    { id: "morning_visit", label: "Before 9am", beans: 1 },
  ];

  const selectedReasonData = beanReasons.find(r => r.id === selectedReason) || beanReasons[0];

  const handleAwardBean = async () => {
    setAwardingBean(true);
    try {
      // Map reason to bean rules
      const rules: BeanRules = {
        reusableCup: selectedReason === "reusable_cup",
        foodDrinkCombo: selectedReason === "food_combo",
        penkeyCup: false,
        before9am: selectedReason === "morning_visit",
        after230pm: false,
        monthlySpecial: false,
        broughtFriend: selectedReason === "brought_friend",
      };
      await onAwardBean(rules);
      setShowReasonSelector(false);
      setSelectedReason("visit");
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
            <>
              {!showReasonSelector ? (
                <button
                  onClick={() => setShowReasonSelector(true)}
                  className="w-full bg-penkey-orange text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition flex items-center justify-center gap-2"
                >
                  <Gift size={20} />
                  Award Bean
                </button>
              ) : (
                <div className="bg-[#3d3d3d] rounded-lg p-4 space-y-3">
                  <h4 className="text-white font-semibold">Select Reason</h4>
                  <div className="space-y-2">
                    {beanReasons.map((reason) => (
                      <button
                        key={reason.id}
                        onClick={() => setSelectedReason(reason.id)}
                        className={`w-full p-3 rounded-lg text-left flex items-center justify-between transition ${
                          selectedReason === reason.id
                            ? "bg-penkey-orange text-white"
                            : "bg-[#2d2d2d] text-gray-300 hover:bg-[#404040]"
                        }`}
                      >
                        <span className="font-medium">{reason.label}</span>
                        <span className="text-sm font-bold">+{reason.beans}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowReasonSelector(false);
                        setSelectedReason("visit");
                      }}
                      className="flex-1 bg-gray-600 text-white py-2 rounded-lg font-semibold hover:bg-gray-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAwardBean}
                      disabled={awardingBean}
                      className="flex-1 bg-penkey-orange text-white py-2 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                    >
                      {awardingBean ? "Awarding..." : `Award +${selectedReasonData.beans}`}
                    </button>
                  </div>
                </div>
              )}
            </>
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
