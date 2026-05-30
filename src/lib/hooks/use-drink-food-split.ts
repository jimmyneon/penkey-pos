import { useState, useEffect } from "react";

interface DrinkFoodSplitData {
  summary: {
    total_receipts: number;
    total_revenue: number;
    drinks_only: {
      count: number;
      revenue: number;
      percentage: number;
    };
    food_only: {
      count: number;
      revenue: number;
      percentage: number;
    };
    both: {
      count: number;
      revenue: number;
      percentage: number;
    };
    other_only: {
      count: number;
      revenue: number;
      percentage: number;
    };
  };
}

export function useDrinkFoodSplit(days: number, dateRangeParams?: { startDate: string; endDate: string } | null) {
  const [data, setData] = useState<DrinkFoodSplitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

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

        const response = await fetch(url, {
          credentials: 'same-origin',
          headers: {
            'x-pos-session': sessionData,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch drink/food split data');
        }

        const result = await response.json();
        setData(result);
      } catch (err: any) {
        console.error('[useDrinkFoodSplit] Error:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days, dateRangeParams]);

  return { data, loading, error };
}
