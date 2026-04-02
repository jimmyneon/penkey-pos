"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@penkey/ui";
import { ArrowLeft, Percent } from "lucide-react";
import { hapticButtonPress } from "@/lib/utils/haptics";

interface Session {
  employee: { id: string; name: string; role: string };
  register: { id: string; name: string; store_name: string };
  org_id: string;
}

export default function DiscountsPage() {
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
            router.back();
          }}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <h1 className="font-semibold text-lg">Discounts</h1>
        <div className="w-20" /> {/* Spacer */}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <div className="text-center">
          <Percent className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Discounts management coming soon...</p>
        </div>
      </div>
    </div>
  );
}
