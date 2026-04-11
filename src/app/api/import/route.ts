export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/database";
import { unauthorizedResponse, validatePOSSession } from "@/lib/api/auth";
import { ratelimit } from "@/lib/ratelimit";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function unescapeCSV(str: string): string {
  return str.replace(/""/g, '"');
}

function isLoyverseFormat(headers: string[]): boolean {
  const headerLower = headers.map(h => h.toLowerCase().trim());
  return headerLower.includes('handle') && headerLower.includes('sku') && headerLower.includes('name');
}

export async function POST(request: NextRequest) {
  const session = await validatePOSSession(request);
  if (!session) {
    console.warn(`[API-AUTH] Failed POST /api/import: Invalid or missing session`);
    return unauthorizedResponse();
  }

  console.log(`[API-AUTH] POST /api/import - User: ${session.user_id}, Org: ${session.org_id}`);

  const { success } = await ratelimit.limit(session.user_id);
  if (!success) {
    console.warn(`[API-RATELIMIT] Blocked POST /api/import - User: ${session.user_id}, Org: ${session.org_id}`);
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const body = await request.text();
    const lines = body.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "Invalid CSV format: empty or missing data" },
        { status: 400 }
      );
    }

    const headers = parseCSVLine(lines[0]);
    const headerMap = new Map(headers.map((h, i) => [h.toLowerCase().trim(), i]));
    
    const isLoyverse = isLoyverseFormat(headers);
    console.log(`[Import] Detected format: ${isLoyverse ? 'Loyverse' : 'Penkey'}`);
    
    const supabase = createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results = {
      categories: { created: 0, errors: 0 },
      items: { created: 0, errors: 0 },
      modifier_groups: { created: 0, errors: 0 },
      modifier_options: { created: 0, errors: 0 },
      item_modifier_links: { created: 0, errors: 0 }
    };

    const categoryMap = new Map<string, string>();
    const modifierGroupMap = new Map<string, string>();
    const itemMap = new Map<string, string>();

    if (isLoyverse) {
      // Loyverse format: Handle, SKU, Name, Category, Description, Sold by weight, Option 1 name, Option 1 value, Option 2 name, Option 2 value, Option 3 name, Option 3 value, Cost, Barcode, SKU of included item, Quantity of included item, Track stock, Available for sale [Store], Price [Store], In stock [Store], Low stock [Store], Modifier columns...
      
      // Find price column (first column matching "Price [")
      const priceColumnIndex = headers.findIndex(h => h.toLowerCase().startsWith('price ['));
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const handle = unescapeCSV(values[headerMap.get('handle') || 0] || '');
        const sku = unescapeCSV(values[headerMap.get('sku') || 1] || '');
        const name = unescapeCSV(values[headerMap.get('name') || 2] || '');
        const category = unescapeCSV(values[headerMap.get('category') || 3] || '');
        const description = unescapeCSV(values[headerMap.get('description') || 4] || '') || null;
        const price = priceColumnIndex >= 0 ? parseFloat(values[priceColumnIndex] || '0') || 0 : 0;
        
        if (!name) continue;

        // Import or get category
        if (category) {
          if (!categoryMap.has(category)) {
            try {
              const { data: existing } = await supabase
                .from("categories")
                .select("id")
                .eq("org_id", session.org_id)
                .eq("name", category)
                .single() as { data: { id: string } | null };

              if (existing) {
                categoryMap.set(category, existing.id);
              } else {
                const { data: newCat, error: catError } = await supabase
                  .from("categories")
                  .insert({
                    org_id: session.org_id,
                    name: category,
                    color: '#f97316',
                    sort_order: categoryMap.size,
                    description: null,
                    is_active: true
                  } as any)
                  .select()
                  .single() as { data: { id: string }; error: any };

                if (catError) throw catError;
                categoryMap.set(category, newCat.id);
                results.categories.created++;
              }
            } catch (err) {
              console.error("Failed to import category:", category, err);
              results.categories.errors++;
            }
          }
        }

        // Import item
        try {
          const categoryId = category ? categoryMap.get(category) || null : null;
          const finalSku = sku || handle || null;

          const { data: newItem, error: itemError } = await supabase
            .from("items")
            .insert({
              org_id: session.org_id,
              name,
              category_id: categoryId,
              base_price: price,
              sku: finalSku,
              description,
              has_variants: false,
              track_inventory: true,
              is_active: true
            } as any)
            .select()
            .single() as { data: { id: string }; error: any };

          if (itemError) throw itemError;

          results.items.created++;

          // Process modifier columns (columns starting with "Modifier - ")
          const modifierColumns = headers.filter(h => h.toLowerCase().startsWith('modifier -'));
          const itemModifierGroups = new Set<string>();

          for (const modCol of modifierColumns) {
            const modValue = unescapeCSV(values[headers.indexOf(modCol)] || '');
            if (modValue.toLowerCase() === 'y' || modValue.toLowerCase() === 'yes') {
              const groupName = modCol.replace(/^Modifier -\s*/i, '').replace(/"/g, '');
              itemModifierGroups.add(groupName);
            }
          }

          // Create modifier groups and options for this item
          for (const groupName of Array.from(itemModifierGroups)) {
            if (!modifierGroupMap.has(groupName)) {
              try {
                const { data: newGroup, error: groupError } = await supabase
                  .from("modifier_groups")
                  .insert({
                    org_id: session.org_id,
                    name: groupName,
                    selection_type: 'optional',
                    min_selections: 0,
                    max_selections: null,
                    sort_order: modifierGroupMap.size
                  } as any)
                  .select()
                  .single() as { data: { id: string }; error: any };

                if (groupError) throw groupError;
                modifierGroupMap.set(groupName, newGroup.id);
                results.modifier_groups.created++;
              } catch (err) {
                console.error("Failed to import modifier group:", groupName, err);
                results.modifier_groups.errors++;
              }
            }

            // Link item to modifier group
            const groupId = modifierGroupMap.get(groupName);
            if (groupId) {
              try {
                await supabase
                  .from("item_modifiers")
                  .insert({
                    item_id: newItem.id,
                    modifier_group_id: groupId,
                    sort_order: 0
                  } as any);
              } catch (err) {
                console.error("Failed to link item to modifier group:", groupName, err);
              }
            }
          }

        } catch (err) {
          console.error("Failed to import item:", name, err);
          results.items.errors++;
        }
      }
    } else {
      // Penkey format: Type,Name,Category,Price,SKU,Description,Color,Selection Type,Min Selections,Max Selections,Sort Order,Is Active
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const type = values[headerMap.get('type') || 0]?.toLowerCase().trim();
        const name = unescapeCSV(values[headerMap.get('name') || 1] || '');
        
        if (!name) continue;

        if (type === 'category') {
          try {
            const color = unescapeCSV(values[headerMap.get('color') || 5] || '#f97316');
            const description = unescapeCSV(values[headerMap.get('description') || 4] || '') || null;
            const sortOrder = parseInt(values[headerMap.get('sort order') || 9] || '0') || 0;
            const isActive = values[headerMap.get('is active') || 11]?.toLowerCase() === 'true';

            const { data: existing } = await supabase
              .from("categories")
              .select("id")
              .eq("org_id", session.org_id)
              .eq("name", name)
              .single() as { data: { id: string } | null };

            if (existing) {
              categoryMap.set(name, existing.id);
              continue;
            }

            const { data, error } = await supabase
              .from("categories")
              .insert({
                org_id: session.org_id,
                name,
                color,
                sort_order: sortOrder,
                description,
                is_active: isActive
              } as any)
              .select()
              .single() as { data: { id: string }; error: any };

            if (error) throw error;
            
            categoryMap.set(name, data.id);
            results.categories.created++;
          } catch (err) {
            console.error("Failed to import category:", name, err);
            results.categories.errors++;
          }
        } else if (type === 'item') {
          try {
            const categoryName = unescapeCSV(values[headerMap.get('category') || 2] || '');
            const price = parseFloat(values[headerMap.get('price') || 3] || '0') || 0;
            const sku = unescapeCSV(values[headerMap.get('sku') || 4] || '') || null;
            const description = unescapeCSV(values[headerMap.get('description') || 5] || '') || null;
            const isActive = values[headerMap.get('is active') || 11]?.toLowerCase() === 'true';

            const categoryId = categoryName ? categoryMap.get(categoryName) || null : null;

            const { data: newItem, error: itemError } = await supabase
              .from("items")
              .insert({
                org_id: session.org_id,
                name,
                category_id: categoryId,
                base_price: price,
                sku,
                description,
                has_variants: false,
                track_inventory: true,
                is_active: isActive
              } as any)
              .select()
              .single() as { data: { id: string }; error: any };

            if (itemError) throw itemError;

            itemMap.set(name, newItem.id);
            results.items.created++;
          } catch (err) {
            console.error("Failed to import item:", name, err);
            results.items.errors++;
          }
        } else if (type === 'modifier group') {
          try {
            const selectionType = unescapeCSV(values[headerMap.get('selection type') || 6] || 'optional');
            const minSelections = parseInt(values[headerMap.get('min selections') || 7] || '0') || 0;
            const maxSelections = values[headerMap.get('max selections') || 8] ? parseInt(values[headerMap.get('max selections') || 8]) : null;
            const sortOrder = parseInt(values[headerMap.get('sort order') || 9] || '0') || 0;

            const { data: newGroup, error: groupError } = await supabase
              .from("modifier_groups")
              .insert({
                org_id: session.org_id,
                name,
                selection_type: selectionType,
                min_selections: minSelections,
                max_selections: maxSelections,
                sort_order: sortOrder
              } as any)
              .select()
              .single() as { data: { id: string }; error: any };

            if (groupError) throw groupError;

            modifierGroupMap.set(name, newGroup.id);
            results.modifier_groups.created++;
          } catch (err) {
            console.error("Failed to import modifier group:", name, err);
            results.modifier_groups.errors++;
          }
        } else if (type === 'modifier option') {
          try {
            const priceAdjustment = parseFloat(values[headerMap.get('price') || 3] || '0') || 0;
            const sortOrder = parseInt(values[headerMap.get('sort order') || 9] || '0') || 0;
            const isActive = values[headerMap.get('is active') || 11]?.toLowerCase() === 'true';

            const recentGroupId = modifierGroupMap.get(name) || Array.from(modifierGroupMap.values()).pop();
            
            if (!recentGroupId) {
              console.error("No modifier group found for option:", name);
              results.modifier_options.errors++;
              continue;
            }

            await supabase
              .from("modifier_options")
              .insert({
                modifier_group_id: recentGroupId,
                name,
                price_adjustment: priceAdjustment,
                is_default: false,
                is_active: isActive,
                sort_order: sortOrder
              } as any);

            results.modifier_options.created++;
          } catch (err) {
            console.error("Failed to import modifier option:", name, err);
            results.modifier_options.errors++;
          }
        } else if (type === 'item modifier link') {
          try {
            const itemName = unescapeCSV(values[headerMap.get('item') || 11] || '');
            const modifierGroupName = unescapeCSV(values[headerMap.get('modifier group') || 12] || '');
            const sortOrder = parseInt(values[headerMap.get('sort order') || 7] || '0') || 0;

            const itemId = itemName ? itemMap.get(itemName) || null : null;
            const modifierGroupId = modifierGroupName ? modifierGroupMap.get(modifierGroupName) || null : null;

            if (!itemId || !modifierGroupId) {
              console.error("Missing item or modifier group for link:", itemName, modifierGroupName);
              results.item_modifier_links.errors++;
              continue;
            }

            await supabase
              .from("item_modifiers")
              .insert({
                item_id: itemId,
                modifier_group_id: modifierGroupId,
                sort_order: sortOrder
              } as any);

            results.item_modifier_links.created++;
          } catch (err) {
            console.error("Failed to import item modifier link:", name, err);
            results.item_modifier_links.errors++;
          }
        }
      }
    }

    console.log(`[API-AUTH] Successful POST /api/import - User: ${session.user_id}, Org: ${session.org_id}`, results);
    
    return NextResponse.json({
      success: true,
      results,
      format: isLoyverse ? 'Loyverse' : 'Penkey'
    });
  } catch (error: any) {
    console.error("Failed to import data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import data" },
      { status: 500 }
    );
  }
}
