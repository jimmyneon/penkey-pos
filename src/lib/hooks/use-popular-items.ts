import { useState, useEffect } from "react";
import { dataCache } from "@/lib/services/data-cache";
import { Item } from "./use-items";

/**
 * Hook to fetch popular items based on sales data
 * Time-aware: Returns different items based on current time of day
 * Cached with 2-hour TTL for performance
 */
export function usePopularItems(orgId: string, forceRefresh: boolean = false) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    console.log("[usePopularItems] orgId:", orgId, "forceRefresh:", forceRefresh);
    if (orgId && orgId !== "skip") {
      loadPopularItems(forceRefresh);
    } else {
      console.log("[usePopularItems] Skipping load - invalid orgId");
      setLoading(false);
    }
  }, [orgId, forceRefresh]);

  const getTimeSegment = (): string => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) return "breakfast";
    if (hour >= 11 && hour < 15) return "lunch";
    if (hour >= 15 && hour < 21) return "dinner";
    return "late_night";
  };

  const loadPopularItems = async (skipCache: boolean = false) => {
    try {
      setLoading(true);
      setFromCache(false);

      const timeSegment = getTimeSegment();
      const cacheKey = `popular_${timeSegment}`;

      // Try cache first (2-hour TTL for popular items)
      if (!skipCache) {
        const cached = dataCache.get<Item[]>(orgId, cacheKey);
        if (cached) {
          console.log("[usePopularItems] Using cached popular items:", cached.length);
          setItems(cached);
          setFromCache(true);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const url = `/api/items/popular?org_id=${orgId}&limit=20`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("Failed to fetch popular items");
      }

      const data = await response.json();
      console.log("[usePopularItems] Loaded popular items from API:", data.length);
      
      setItems(data);
      setError(null);

      // Cache the data with time segment key
      dataCache.set(orgId, cacheKey, data);
    } catch (err: any) {
      console.error("Failed to load popular items:", err);
      setError(err.message);
      // On error, return empty array so UI doesn't break
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  return { 
    items, 
    loading, 
    error, 
    fromCache, 
    reload: loadPopularItems,
    timeSegment: getTimeSegment()
  };
}
