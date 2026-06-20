import { useState, useEffect } from "react";

interface BucketData {
  count: number;
  revenue: number;
  percentage: number;
}

interface DrinkFoodSplitData {
  summary: {
    total_receipts: number;
    total_revenue: number;
    drinks_only: BucketData;
    wet: BucketData;
    other_only: BucketData;
    breakdown: {
      drinks_only: BucketData;
      drinks_sweet: BucketData;
      drinks_lunch: BucketData;
      drinks_both_food: BucketData;
      sweet_only: BucketData;
      lunch_only: BucketData;
      both_food_only: BucketData;
      other: BucketData;
    };
  };
}

export function useDrinkFoodSplit(days: number, dateRangeParams?: { startDate: string; endDate: string } | null) {
  const [data, setData] = useState<DrinkFoodSplitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();
    const requestId = Date.now();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setData(null);

        const sessionData = sessionStorage.getItem('pos_session');
        if (!sessionData) {
          throw new Error('No session found');
        }

        const session = JSON.parse(sessionData);
        const orgId = session.org_id;

        let url = `/api/reports/drink-food-split?org_id=${orgId}&days=${days}`;
        
        if (dateRangeParams?.startDate && dateRangeParams?.endDate) {
          url += `&start_date=${dateRangeParams.startDate}&end_date=${dateRangeParams.endDate}`;
        }

        // Add cache buster to prevent any browser/CDN caching
        url += `&_t=${requestId}`;

        console.log('[useDrinkFoodSplit] Fetching:', url);

        const response = await fetch(url, {
          cache: 'no-store',
          credentials: 'include',
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch drink/food split data: ${response.status}`);
        }

        const result = await response.json();
        console.log('[useDrinkFoodSplit] Result:', result);
        setData(result);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[useDrinkFoodSplit] Request aborted:', requestId);
          return;
        }
        console.error('[useDrinkFoodSplit] Error:', err);
        setError(err.message || 'Failed to load data');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [days, dateRangeParams?.startDate, dateRangeParams?.endDate, refetchKey]);

  const refetch = () => {
    setRefetchKey(prev => prev + 1);
  };

  return { data, loading, error, refetch };
}
