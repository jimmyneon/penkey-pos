export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

interface Category {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  description: string | null;
  is_active: boolean;
}

interface ItemVariant {
  id: string;
  name: string;
  price: number;
  is_default: boolean;
}

interface Item {
  id: string;
  name: string;
  category_id: string | null;
  base_price: number | null;
  sku: string | null;
  description: string | null;
  has_variants: boolean;
  is_active: boolean;
  item_variants: ItemVariant[];
}

interface ModifierOption {
  id: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
}

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: string;
  min_selections: number;
  max_selections: number | null;
  sort_order: number;
  modifier_options: ModifierOption[];
}

function escapeCSV(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  const escaped = str.toString().replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed GET /api/export: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] GET /api/export - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked GET /api/export - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name, color, sort_order, description, is_active")
      .eq("org_id", session.org_id)
      .order("sort_order", { ascending: true });

    if (categoriesError) throw categoriesError;

    // Fetch items with variants
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select(`
        id,
        name,
        category_id,
        base_price,
        sku,
        description,
        has_variants,
        is_active,
        item_variants(id, name, price, is_default)
      `)
      .eq("org_id", session.org_id)
      .order("name");

    if (itemsError) throw itemsError;

    // Fetch modifier groups with options
    const { data: modifierGroups, error: modifiersError } = await supabase
      .from("modifier_groups")
      .select(`
        id,
        name,
        selection_type,
        min_selections,
        max_selections,
        sort_order,
        modifier_options(
          id,
          name,
          price_adjustment,
          is_default,
          sort_order,
          is_active
        )
      `)
      .eq("org_id", session.org_id)
      .order("sort_order", { ascending: true });

    if (modifiersError) throw modifiersError;

    // Build category name map
    const categoryMap = new Map((categories as Category[] || []).map(c => [c.id, c.name]));
    
    // Generate CSV content
    const csvLines: string[] = [];
    
    // Add header
    csvLines.push('Type,Name,Category,Price,SKU,Description,Color,Selection Type,Min Selections,Max Selections,Sort Order,Is Active');
    
    // Add categories
    (categories as Category[] || []).forEach(cat => {
      csvLines.push(
        `Category,${escapeCSV(cat.name)},,,${escapeCSV(cat.description)},${escapeCSV(cat.color)},,,,${cat.sort_order},${cat.is_active}`
      );
    });
    
    // Add items
    (items as Item[] || []).forEach(item => {
      const categoryName = item.category_id ? categoryMap.get(item.category_id) || '' : '';
      const price = item.base_price || 0;
      csvLines.push(
        `Item,${escapeCSV(item.name)},${escapeCSV(categoryName)},${price},${escapeCSV(item.sku)},${escapeCSV(item.description)},,,,,,${item.is_active}`
      );
    });
    
    // Add modifier groups
    (modifierGroups as ModifierGroup[] || []).forEach(group => {
      csvLines.push(
        `Modifier Group,${escapeCSV(group.name)},,,,,${escapeCSV(group.selection_type)},${group.min_selections},${group.max_selections || ''},${group.sort_order},`
      );
      
      // Add modifier options
      (group.modifier_options || []).forEach(opt => {
        csvLines.push(
          `Modifier Option,${escapeCSV(opt.name)},,${opt.price_adjustment},,,,,,,,${opt.sort_order},${opt.is_active}`
        );
      });
    });
    
    const csvContent = csvLines.join('\n');

    console.log(`[API-AUTH] Successful GET /api/export - User: ${session.user_id}, Org: ${session.org_id}`);
    
    // Return as CSV file download
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="penkey-export-${session.org_id}-${Date.now()}.csv"`
      }
    });
  } catch (error: any) {
    console.error("Failed to export data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export data" },
      { status: 500 }
    );
  }
}
