"use client";

import { useState, useEffect } from "react";

interface StaffTargetsData {
  upsellCount: number;
  wetMixPercentage: number;
  ticketCount: number;
  reviewMentions: number;
}

interface UseStaffTargetsResult {
  data: StaffTargetsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStaffTargets(
  orgId: string | undefined,
  days: number,
  memberId?: string,
): UseStaffTargetsResult {
  const [data, setData] = useState<StaffTargetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchTargets() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("org_id", orgId!);
        params.set("days", String(days));
        if (memberId) params.set("member_id", memberId);

        const res = await fetch(`/api/stats/staff-targets?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to fetch staff targets");

        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        if (!cancelled) {
          setError(err.message || "Unknown error");
          setLoading(false);
        }
      }
    }

    fetchTargets();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [orgId, days, memberId, refetchTrigger]);

  return {
    data,
    loading,
    error,
    refetch: () => setRefetchTrigger(prev => prev + 1),
  };
}
