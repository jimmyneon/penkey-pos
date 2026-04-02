"use client";

import { useNetworkStatus } from "@/hooks/use-network-status";
import { WifiOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

export function NetworkStatusIndicator() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
        isOnline
          ? "bg-green-500 text-white animate-in slide-in-from-top-5"
          : "bg-red-500 text-white animate-in slide-in-from-top-5"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Connection restored</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>No internet connection</span>
        </>
      )}
    </div>
  );
}
