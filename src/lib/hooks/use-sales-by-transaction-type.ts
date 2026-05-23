import { useState, useEffect } from "react";

interface ProviderData {
  amount: number;
  count: number;
}

interface TransactionTypeData {
  method: string;
  total_amount: number;
  total_tips: number;
  transaction_count: number;
  avg_transaction: number;
  providers: Record<string, ProviderData>;
}

interface SummaryData {
  total_revenue: number;
  total_tips: number;
  total_transactions: number;
  most_common_method: string | null;
}

interface SalesByTransactionTypeData {
  transaction_types: TransactionTypeData[];
  summary: SummaryData;
}

interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export function useSalesByTransactionType(days: number = 30, dateRange?: DateRangeParams | null) {
  const [data, setData] = useState<SalesByTransactionTypeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSalesByTransactionType();
  }, [days, dateRange?.startDate, dateRange?.endDate]);

  const fetchSalesByTransactionType = async () => {
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

      let url = `/api/reports/sales-by-transaction-type?days=${days}&org_id=${orgId}&member_id=${memberId || ""}`;
      if (dateRange?.startDate && dateRange?.endDate) {
        url += `&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sales by transaction type");
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching sales by transaction type:", err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchSalesByTransactionType };
}
