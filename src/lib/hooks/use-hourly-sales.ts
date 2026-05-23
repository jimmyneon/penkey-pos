import { useState, useEffect } from "react";

interface HourlyData {
  hour: number;
  total_sales: number;
  transaction_count: number;
  avg_transaction: number;
}

interface SummaryData {
  total_sales: number;
  total_transactions: number;
  peak_hours: HourlyData[];
  busiest_hour: number | null;
}

interface HourlySalesData {
  hourly_data: HourlyData[];
  summary: SummaryData;
}

interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export function useHourlySales(days: number = 30, dateRange?: DateRangeParams | null) {
  const [data, setData] = useState<HourlySalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHourlySales();
  }, [days, dateRange?.startDate, dateRange?.endDate]);

  const fetchHourlySales = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get org_id and member_id from session storage
      const sessionData = sessionStorage.getItem("pos_session");
      let orgId: string | undefined;
      let memberId: string | undefined;

      if (!sessionData) {
        const userData = localStorage.getItem("pos_user");
        if (!userData) throw new Error("No active POS session. Please log in.");
        const user = JSON.parse(userData);
        orgId = user.org_id;
        memberId = user.member_id || user.id;
      } else {
        const session = JSON.parse(sessionData);
        orgId = session.org_id;
        memberId = session.employee?.id || session.member_id;
      }

      if (!orgId) throw new Error("No organization ID found");

      let url = `/api/reports/hourly-sales?days=${days}&org_id=${orgId}&member_id=${memberId || ""}`;
      if (dateRange?.startDate && dateRange?.endDate) {
        url += `&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch hourly sales");
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching hourly sales:", err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchHourlySales };
}
