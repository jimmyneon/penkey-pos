"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import {
  ArrowLeft,
  Grid3x3,
  Utensils,
  Receipt,
  CreditCard,
  Star,
  QrCode,
  Lock,
  Printer,
} from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";
import { SettingsLoading } from "@/components/settings/settings-shared";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }
    setLoading(false);
  }, []);

  if (loading) return <SettingsLoading />;

  const settingsCards = [
    {
      title: "Display & Feedback",
      description: "Theme, text size, grid layout, sound & haptics",
      icon: Grid3x3,
      href: "/settings/display",
      color: "bg-blue-500",
    },
    {
      title: "Order & Operations",
      description: "Dining options, upsell prompts, shift management",
      icon: Utensils,
      href: "/settings/order",
      color: "bg-purple-500",
    },
    {
      title: "Receipts & Printing",
      description: "Print behaviour, copies, tip presets, templates",
      icon: Receipt,
      href: "/settings/receipts",
      color: "bg-orange-500",
    },
    {
      title: "Payments",
      description: "SumUp card payments, terminals",
      icon: CreditCard,
      href: "/settings/payments",
      color: "bg-green-500",
    },
    {
      title: "Perks Integration",
      description: "Loyalty app, API key, bean reward rules",
      icon: Star,
      href: "/settings/perks",
      color: "bg-yellow-500",
    },
    {
      title: "QR Codes",
      description: "Google review QR, tracking, scan stats",
      icon: QrCode,
      href: "/settings/qr-codes",
      color: "bg-cyan-500",
    },
    {
      title: "Printers",
      description: "Manage receipt printers",
      icon: Printer,
      href: "/settings/printers",
      color: "bg-slate-500",
    },
    {
      title: "Security & Account",
      description: "PIN, biometric unlock, sign out",
      icon: Lock,
      href: "/settings/security",
      color: "bg-red-500",
    },
  ];

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
        <h1 className="font-semibold text-base sm:text-lg">Settings</h1>
        <div className="w-[44px] sm:w-32"></div>
      </header>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 sm:p-4 md:p-8 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

              {settingsCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.href}
                    onClick={() => {
                      hapticButtonPress();
                      router.push(card.href);
                    }}
                    className="bg-[#3d3d3d] rounded-lg p-4 sm:p-5 border border-gray-700 hover:border-penkey-orange transition-all active:scale-95 text-left flex flex-col gap-3 min-h-[120px]"
                  >
                    <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-white font-semibold text-sm sm:text-base mb-1">{card.title}</h2>
                      <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{card.description}</p>
                    </div>
                  </button>
                );
              })}

            </div>

            {/* Info Note */}
            <div className="mt-6 bg-[#3d3d3d] rounded-lg p-3 sm:p-4 text-xs sm:text-sm text-gray-400 border border-gray-700">
              <p className="mb-2 text-sm sm:text-base">ℹ️ <strong className="text-white">Note:</strong></p>
              <ul className="space-y-1 ml-4 leading-relaxed">
                <li>• Register settings sync across all devices using this register</li>
                <li className="hidden sm:list-item">• For business settings (payment methods, tax rates, etc.), contact your manager or use the Back Office</li>
                <li className="sm:hidden">• For business settings, use the Back Office</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
