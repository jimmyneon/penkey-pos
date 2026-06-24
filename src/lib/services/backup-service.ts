/**
 * Backup Service
 * Collects all critical business data from Supabase for backup purposes.
 */

import { createSupabaseServerClient } from "@/lib/database";

const CRITICAL_TABLES = [
  "receipts",
  "receipt_lines",
  "payments",
  "tickets",
  "items",
  "categories",
  "modifier_groups",
  "item_modifiers",
  "discounts",
  "gift_vouchers",
  "voucher_redemptions",
  "printers",
  "org_members",
  "employee_pins",
  "roles",
  "orgs",
  "register_settings",
  "qr_codes",
  "qr_scans",
  "shifts",
  "upsell_analytics",
  "refunds",
  "user_preferences",
  "saved_tickets",
  "active_carts",
  "kds_screens",
] as const;

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

export interface BackupResult {
  timestamp: string;
  tables: Record<string, any[]>;
  totalRows: number;
  tableCounts: Record<string, number>;
}

/**
 * Collect all data from critical tables, paginating as needed.
 */
export async function collectBackupData(
  supabaseUrl: string,
  supabaseKey: string
): Promise<BackupResult> {
  const supabase = createSupabaseServerClient(supabaseUrl, supabaseKey);
  const tables: Record<string, any[]> = {};
  const tableCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const table of CRITICAL_TABLES) {
    try {
      const allRows: any[] = [];

      for (let page = 0; page < MAX_PAGES; page++) {
        const offset = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          // Table might not exist — skip silently
          break;
        }

        if (!data || data.length === 0) {
          break;
        }

        allRows.push(...data);

        if (data.length < PAGE_SIZE) {
          break;
        }
      }

      tables[table] = allRows;
      tableCounts[table] = allRows.length;
      totalRows += allRows.length;
    } catch {
      // Table doesn't exist or other error — skip
      tables[table] = [];
      tableCounts[table] = 0;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    tables,
    totalRows,
    tableCounts,
  };
}
