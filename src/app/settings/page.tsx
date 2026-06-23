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
      title: "Display",
      description: "Theme & layout",
      icon: Grid3x3,
      href: "/settings/display",
      color: "bg-blue-500",
    },
    {
      title: "Orders",
      description: "Dining & shifts",
      icon: Utensils,
      href: "/settings/order",
      color: "bg-purple-500",
    },
    {
      title: "Receipts",
      description: "Print & tips",
      icon: Receipt,
      href: "/settings/receipts",
      color: "bg-orange-500",
    },
    {
      title: "Payments",
      description: "SumUp & terminals",
      icon: CreditCard,
      href: "/settings/payments",
      color: "bg-green-500",
    },
    {
      title: "Perks",
      description: "Loyalty & beans",
      icon: Star,
      href: "/settings/perks",
      color: "bg-yellow-500",
    },
    {
      title: "QR Codes",
      description: "Reviews & scans",
      icon: QrCode,
      href: "/settings/qr-codes",
      color: "bg-cyan-500",
    },
    {
      title: "Printers",
      description: "Manage printers",
      icon: Printer,
      href: "/settings/printers",
      color: "bg-slate-500",
    },
    {
      title: "Security",
      description: "PIN & sign out",
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {settingsCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.href}
                onClick={() => {
                  hapticButtonPress();
                  router.push(card.href);
                }}
                className="bg-[#3d3d3d] rounded-xl p-6 hover:bg-[#4d4d4d] transition-all duration-200 border-2 border-transparent hover:border-penkey-orange active:scale-95"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className={`${card.color} rounded-xl p-4 transition-transform duration-200`}>
                    <Icon className="h-10 w-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{card.title}</h3>
                    <p className="text-sm text-gray-400">{card.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
