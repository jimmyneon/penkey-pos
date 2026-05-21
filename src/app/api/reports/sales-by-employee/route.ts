export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/reports/sales-by-employee`);
    return unauthorizedResponse();
  }

  // ✅ SECURITY: Rate limit
  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const days = parseInt(searchParams.get("days") || "30");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const startDate = new Date();
    // For days=1 (today), we want 0 days back. For days=7, we want 6 days back, etc.
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    console.log(`[Sales by Employee] Fetching for last ${days} days, from ${startDate.toISOString()}`);

    // Fetch receipts with employee details (excluding refunded/voided)
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select(`
        id,
        total,
        subtotal,
        tax_total,
        discount_total,
        created_at,
        member_id,
        org_members!inner (
          id,
          first_name,
          last_name,
          display_name
        )
      `)
      .eq("org_id", orgId)
      .gte("created_at", startDate.toISOString())
      .neq("status", "fully_refunded")
      .neq("status", "voided");

    if (receiptsError) {
      console.error("[Sales by Employee] Error fetching receipts:", receiptsError);
      return NextResponse.json({ error: "Failed to fetch employee sales data" }, { status: 500 });
    }

    // Aggregate by employee
    const employeeMap = new Map();

    (receipts || []).forEach((receipt: any) => {
      const employee = receipt.org_members;
      const employeeId = employee?.id || receipt.member_id;
      const employeeName = employee?.display_name || 
                         `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || 
                         'Unknown';

      if (!employeeMap.has(employeeId)) {
        employeeMap.set(employeeId, {
          employee_id: employeeId,
          employee_name: employeeName,
          total_sales: 0,
          total_subtotal: 0,
          total_tax: 0,
          total_discounts: 0,
          transaction_count: 0,
          avg_transaction: 0,
        });
      }

      const data = employeeMap.get(employeeId);
      data.total_sales += parseFloat(receipt.total || "0");
      data.total_subtotal += parseFloat(receipt.subtotal || "0");
      data.total_tax += parseFloat(receipt.tax_total || "0");
      data.total_discounts += parseFloat(receipt.discount_total || "0");
      data.transaction_count += 1;
    });

    // Calculate averages and convert to array
    const employees = Array.from(employeeMap.values()).map(emp => ({
      ...emp,
      avg_transaction: emp.transaction_count > 0 ? emp.total_sales / emp.transaction_count : 0,
    }));

    // Sort by total sales (descending)
    employees.sort((a, b) => b.total_sales - a.total_sales);

    // Calculate totals
    const totalSales = employees.reduce((sum, emp) => sum + emp.total_sales, 0);
    const totalTransactions = employees.reduce((sum, emp) => sum + emp.transaction_count, 0);

    return NextResponse.json({
      employees,
      summary: {
        total_employees: employees.length,
        total_sales: totalSales,
        total_transactions: totalTransactions,
        top_performer: employees.length > 0 ? employees[0] : null,
      },
    });
  } catch (error: any) {
    console.error("[Sales by Employee] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales by employee" },
      { status: 500 }
    );
  }
}
