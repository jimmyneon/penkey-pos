"use client";

import { useState, useEffect, useCallback } from "react";

export function usePendingOrders(pollIntervalMs = 30000) {
  const [pendingCount, setPendingCount] = useState(0);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?status=pending");
      if (res.ok) {
        const data = await res.json();
        setPendingCount((data.orders || []).length);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, pollIntervalMs);
    return () => clearInterval(id);
  }, [check, pollIntervalMs]);

  return pendingCount;
}
