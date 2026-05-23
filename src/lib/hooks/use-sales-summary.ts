import { useState, useEffect } from "react";
import { getByKey, putMany } from "@/lib/idb/db";

interface SalesData {
  grossSales: number;
  refunds: number;
  discounts: number;
  netSales: number;
  receipts: any[];
  refundsList: any[];
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
}

interface SalesSummaryData {
  userName: string;
  salesData: SalesData;
  employees: Employee[];
}

interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export function useSalesSummary(days: number = 30, dateRange?: DateRangeParams | null) {
  const [data, setData] = useState<SalesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSalesSummary();
  }, [days, dateRange?.startDate, dateRange?.endDate]);

  const fetchSalesSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get org_id and member_id from session storage (set during PIN login)
      const sessionData = sessionStorage.getItem("pos_session");
      console.log("Session data:", sessionData);
      
      let orgId: string | undefined;
      let memberId: string | undefined;
      if (!sessionData) {
        // Fallback: try to get from localStorage user data
        const userData = localStorage.getItem("pos_user");
        console.log("User data from localStorage:", userData);
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

      console.log("Fetching sales summary with org_id:", orgId, "member_id:", memberId);

      // IDB-first: try reports_cache
      const cacheKey = `sales_summary_${days}_${orgId}`;
      try {
        let cached: any = await getByKey('reports_cache', cacheKey as any);
        if (!cached && days !== 7) {
          cached = await getByKey('reports_cache', `sales_summary_7d_${orgId}` as any);
        }
        if (cached?.data) {
          setData(cached.data as SalesSummaryData);
          setLoading(false);
        }
      } catch {}

      let url = `/api/reports/sales-summary?days=${days}&org_id=${orgId}&member_id=${memberId || ""}`;
      if (dateRange?.startDate && dateRange?.endDate) {
        url += `&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sales summary");
      }

      const result = await response.json();
      console.log("Sales summary result:", result);
      setData(result);
      try {
        await putMany('reports_cache', [{ key: cacheKey, data: result, ts: Date.now() }]);
      } catch {}
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching sales summary:", err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchSalesSummary };
}
