"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@penkey/ui";
import { PrinterManager } from "@/components/printer-manager";

export default function PrintersSettingsPage() {
  const router = useRouter();
  const [registerId, setRegisterId] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const sessionData = sessionStorage.getItem("pos_session") || localStorage.getItem("pos_session");
      if (sessionData) {
        const session = JSON.parse(sessionData);
        setRegisterId(session.register?.id);
      }
    } catch {}
  }, []);

  return (
    <div className="h-screen bg-[#2d2d2d] flex flex-col overflow-hidden">
      <header className="bg-[#3d3d3d] text-white px-3 sm:px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/settings")}
          className="text-white hover:bg-white/10 min-h-[44px] min-w-[44px] p-2"
        >
          <ArrowLeft className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Back to Settings</span>
        </Button>
        <h1 className="font-semibold text-base sm:text-lg">Printer Management</h1>
        <div className="w-[44px] sm:w-36" />
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="max-w-4xl mx-auto">
          <PrinterManager registerId={registerId} />
        </div>
      </div>
    </div>
  );
}
