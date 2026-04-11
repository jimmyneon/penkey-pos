import { useState, useEffect } from "react";

interface ItemData {
  item_id: string | null;
  name: string;
  quantity_sold: number;
  total_revenue: number;
  total_tax: number;
  total_discount: number;
  avg_price: number;
  transaction_count: number;
}

interface SummaryData {
  total_items: number;
  total_quantity_sold: number;
  total_revenue: number;
  top_selling_item: ItemData | null;
}

interface SalesByItemsData {
  items: ItemData[];
  summary: SummaryData;
}

export function useSalesByItems(days: number = 30) {
  const [data, setData] = useState<SalesByItemsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSalesByItems();
  }, [days]);

  const fetchSalesByItems = async () => {
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

      const response = await fetch(
        `/api/reports/sales-by-items?days=${days}&org_id=${orgId}&member_id=${memberId || ""}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch sales by items");
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching sales by items:", err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchSalesByItems };
}
