import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@penkey/database";
import { validatePOSSession, unauthorizedResponse } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

/**
 * Get intelligent upsell suggestions for an item
 * Uses multiple strategies:
 * 1. Frequently bought together (from sales data)
 * 2. Category-based suggestions (complementary categories)
 * 3. High-margin items from same category
 */
export async function GET(request: NextRequest) {
  // ✅ SECURITY: Validate session first
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Unauthorized GET /api/items/upsell`);
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
    const itemId = searchParams.get("item_id");
    const categoryId = searchParams.get("category_id");
    const limit = parseInt(searchParams.get("limit") || "4");

    // ✅ SECURITY: Verify org_id matches session
    if (!orgId || orgId !== session.org_id) {
      console.warn(`[API-AUTH] Org mismatch - Request: ${orgId}, Session: ${session.org_id}`);
      return unauthorizedResponse();
    }

    if (!itemId) {
      return NextResponse.json(
        { error: "item_id is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const suggestions: any[] = [];

    // Strategy 1: Frequently bought together
    try {
      const { data: frequentlyBought, error: fbError } = await supabase.rpc(
        "get_frequently_bought_together",
        {
          p_org_id: orgId,
          p_item_id: itemId,
          p_days_back: 90,
          p_limit: 3,
        }
      );

      if (!fbError && frequentlyBought && frequentlyBought.length > 0) {
        // Fetch full item details
        const itemIds = frequentlyBought.map((fb: any) => fb.suggested_item_id);
        const { data: items } = await supabase
          .from("items")
          .select(`
            *,
            categories(name, color),
            item_variants(id, name, price, is_default)
          `)
          .in("id", itemIds)
          .eq("is_active", true);

        if (items && Array.isArray(items)) {
          suggestions.push(
            ...items.map((item: any) => ({
              ...item,
              suggestion_reason: "frequently_bought_together",
              priority: 1,
            }))
          );
        }
      }
    } catch (err) {
      console.log("[Upsell] Frequently bought together query failed:", err);
    }

    // Strategy 2: Category-based suggestions
    // If item is from food category, suggest drinks; if drinks, suggest desserts, etc.
    if (categoryId && suggestions.length < limit) {
      try {
        // Get the category to determine complementary categories
        const { data: category } = await supabase
          .from("categories")
          .select("name")
          .eq("id", categoryId)
          .single();

        let complementaryCategoryNames: string[] = [];

        if (category && 'name' in category) {
          const catName = (category.name as string).toLowerCase();
          
          // Define complementary category mappings
          if (catName.includes("food") || catName.includes("main") || catName.includes("burger") || catName.includes("pizza")) {
            complementaryCategoryNames = ["drinks", "beverages", "sides"];
          } else if (catName.includes("drink") || catName.includes("beverage")) {
            complementaryCategoryNames = ["desserts", "snacks", "sides"];
          } else if (catName.includes("coffee") || catName.includes("tea")) {
            complementaryCategoryNames = ["pastries", "cakes", "desserts"];
          }
        }

        if (complementaryCategoryNames.length > 0) {
          // Get categories that match complementary names
          const { data: complementaryCategories } = await supabase
            .from("categories")
            .select("id")
            .eq("org_id", orgId)
            .eq("is_active", true);

          if (complementaryCategories && Array.isArray(complementaryCategories)) {
            const matchingCategoryIds = complementaryCategories
              .filter((cat: any) => 
                cat.id && complementaryCategoryNames.some(name => 
                  String(cat.id).toLowerCase().includes(name)
                )
              )
              .map((cat: any) => cat.id);

            if (matchingCategoryIds.length > 0) {
              // Get popular items from complementary categories
              const { data: complementaryItems } = await supabase
                .from("items")
                .select(`
                  *,
                  categories(name, color),
                  item_variants(id, name, price, is_default)
                `)
                .in("category_id", matchingCategoryIds)
                .eq("org_id", orgId)
                .eq("is_active", true)
                .limit(3);

              if (complementaryItems && Array.isArray(complementaryItems)) {
                // Filter out items already in suggestions
                const existingIds = new Set(suggestions.map((s) => s.id));
                const newItems = complementaryItems
                  .filter((item: any) => item.id && !existingIds.has(item.id))
                  .map((item: any) => ({
                    ...item,
                    suggestion_reason: "complementary_category",
                    priority: 2,
                  }));

                suggestions.push(...newItems);
              }
            }
          }
        }
      } catch (err) {
        console.log("[Upsell] Category-based suggestions failed:", err);
      }
    }

    // Strategy 3: High-margin items from same or popular categories
    if (suggestions.length < limit) {
      try {
        const { data: highMarginItems } = await supabase
          .from("items")
          .select(`
            *,
            categories(name, color),
            item_variants(id, name, price, is_default)
          `)
          .eq("org_id", orgId)
          .eq("is_active", true)
          .not("id", "eq", itemId)
          .order("base_price", { ascending: false })
          .limit(5);

        if (highMarginItems && Array.isArray(highMarginItems)) {
          // Filter out items already in suggestions
          const existingIds = new Set(suggestions.map((s) => s.id));
          const newItems = highMarginItems
            .filter((item: any) => item.id && !existingIds.has(item.id))
            .map((item: any) => ({
              ...item,
              suggestion_reason: "high_value",
              priority: 3,
            }));

          suggestions.push(...newItems);
        }
      } catch (err) {
        console.log("[Upsell] High-margin items query failed:", err);
      }
    }

    // Sort by priority and limit results
    const sortedSuggestions = suggestions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, limit);

    return NextResponse.json(sortedSuggestions);
  } catch (error: any) {
    console.error("Failed to fetch upsell suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch upsell suggestions", details: error.message },
      { status: 500 }
    );
  }
}
