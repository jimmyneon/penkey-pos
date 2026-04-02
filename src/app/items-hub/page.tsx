"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, Package, Tag, Boxes, Percent, Home } from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

export default function ItemsHubPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionData = sessionStorage.getItem("pos_session");
    if (!sessionData) {
      router.push("/lock");
      return;
    }
    try {
      const parsed = JSON.parse(sessionData);
      setSession(parsed);
    } catch (err) {
      console.error("Failed to parse session:", err);
      router.push("/lock");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const catalogueItems = [
    {
      title: "Items",
      description: "Manage products",
      icon: Package,
      href: "/items",
      color: "bg-blue-500",
    },
    {
      title: "Categories",
      description: "Organize items",
      icon: Tag,
      href: "/categories",
      color: "bg-purple-500",
    },
    {
      title: "Modifiers",
      description: "Add options",
      icon: Boxes,
      href: "/modifiers",
      color: "bg-green-500",
    },
    {
      title: "Discounts",
      description: "Manage discounts",
      icon: Percent,
      href: "/discounts",
      color: "bg-orange-500",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2d2d2d] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#3d3d3d] text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            hapticButtonPress();
            router.push("/sell");
          }}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <h1 className="font-semibold text-lg">Management</h1>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            hapticButtonPress();
            router.push("/sell");
          }}
          className="text-white hover:bg-white/10"
          title="Home"
        >
          <Home className="h-5 w-5" />
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {catalogueItems.map((item) => (
            <button
              key={item.title}
              onClick={() => {
                hapticButtonPress();
                router.push(item.href);
              }}
              className="bg-[#3d3d3d] rounded-xl p-6 hover:bg-[#4d4d4d] transition-all duration-200 border-2 border-transparent hover:border-penkey-orange active:scale-95"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`${item.color} rounded-xl p-4 transition-transform duration-200`}>
                  <item.icon className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {item.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
