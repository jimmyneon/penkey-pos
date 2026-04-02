"use client";

import { useState, useEffect } from "react";
import { dataCache, DataCacheService } from "@/lib/services/data-cache";

// Create a dedicated cache instance for stats with 1-hour TTL
const statsCache = new DataCacheService({ ttlHours: 1 });

interface DailyStats {
  sales: number;
  upsellCount: number;
  itemsSold: number;
  transactionCount: number;
}

export function useDailyStats(orgId: string | undefined, forceRefresh: boolean = false) {
  const [stats, setStats] = useState<DailyStats>({
    sales: 0,
    upsellCount: 0,
    itemsSold: 0,
    transactionCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!orgId || orgId === "skip") return;

    const fetchStats = async () => {
      try {
        // Check cache first (unless force refresh)
        if (!forceRefresh) {
          const cached = statsCache.get<DailyStats>(orgId, "daily_stats");
          if (cached) {
            console.log("[DailyStats] Using cached data");
            setStats(cached);
            setFromCache(true);
            return;
          }
        }

        // Fetch from API
        setLoading(true);
        setFromCache(false);
        const response = await fetch(`/api/stats/daily?org_id=${orgId}`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          
          // Cache with 1-hour TTL (stats update frequently during the day)
          statsCache.set(orgId, "daily_stats", data);
        }
      } catch (err) {
        console.error("Failed to fetch daily stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [orgId, forceRefresh]);

  return { stats, loading, fromCache };
}
