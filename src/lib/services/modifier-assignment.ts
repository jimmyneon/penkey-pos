/**
 * Modifier assignment helpers
 *
 * - Uses the new set-based PUT endpoint to atomically reconcile which items are
 *   linked to a modifier group (eliminates the read-modify-write race in the
 *   old additive POST flow).
 * - Refreshes the local IndexedDB `item_modifier_groups` rows for ALL affected
 *   items so the sell page reflects the change immediately, even before the
 *   next full sync.
 * - Falls back to the outbox if the network call fails, so the change is never
 *   silently lost.
 */

import { getDB } from "@/lib/idb/db";
import { OutboxSyncService } from "./outbox-sync";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith("csrf_token=")) {
      return cookie.substring("csrf_token=".length);
    }
  }
  return null;
}

/**
 * Refresh the local item_modifier_groups cache for the given items by calling
 * /api/items/{id}/modifiers/full. Non-destructive: if a call fails the existing
 * local row is kept.
 */
export async function refreshLocalItemModifierGroups(
  itemIds: string[],
  orgId: string
): Promise<void> {
  if (!itemIds.length) return;
  const db = await getDB();
  const now = Date.now();

  await Promise.all(
    itemIds.map(async (itemId) => {
      try {
        const res = await fetch(`/api/items/${itemId}/modifiers/full`, {
          credentials: "include",
        });
        if (!res.ok) return; // keep existing
        const groups = await res.json();
        await db.put("item_modifier_groups", {
          item_id: itemId,
          groups,
          org_id: orgId,
          ts: now,
        });
      } catch (err) {
        console.warn(
          `[ModifierAssignment] Failed to refresh local cache for item ${itemId}; keeping previous local state`,
          err
        );
      }
    })
  );
}

export interface AssignModifierResult {
  ok: boolean;
  queued: boolean;
  affectedItemIds: string[];
  error?: string;
}

/**
 * Set-based assignment: replaces the full list of items linked to a modifier
 * group. Provide the COMPLETE desired item_ids set, not a delta.
 *
 * If the network call fails (offline / 5xx), the request is queued to the
 * outbox so it will sync when the connection returns.
 */
export async function setModifierGroupItems(params: {
  modifierGroupId: string;
  itemIds: string[];
  orgId: string;
  previousItemIds?: string[]; // used purely to know which local caches to refresh on failure
}): Promise<AssignModifierResult> {
  const { modifierGroupId, itemIds, orgId, previousItemIds = [] } = params;

  const csrf = getCsrfToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) headers["x-csrf-token"] = csrf;

  try {
    const res = await fetch(`/api/items/modifiers/assign`, {
      method: "PUT",
      headers,
      credentials: "include",
      body: JSON.stringify({
        modifier_group_id: modifierGroupId,
        item_ids: itemIds,
      }),
    });

    if (!res.ok) {
      // 4xx -> don't queue (validation / auth); 5xx -> queue
      if (res.status >= 500) {
        await queueAssignmentToOutbox(modifierGroupId, itemIds, orgId);
        return {
          ok: false,
          queued: true,
          affectedItemIds: dedupe([...itemIds, ...previousItemIds]),
          error: `Server error ${res.status}; queued for retry`,
        };
      }
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        queued: false,
        affectedItemIds: [],
        error: body.error || `Request failed: ${res.status}`,
      };
    }

    const body = await res.json().catch(() => ({}));
    const affected: string[] =
      body.affected_item_ids ||
      dedupe([...itemIds, ...previousItemIds]);

    // Refresh local cache for the union of (new ∪ removed) so UI is consistent
    await refreshLocalItemModifierGroups(affected, orgId);

    return { ok: true, queued: false, affectedItemIds: affected };
  } catch (err: any) {
    // Network error / offline → queue
    console.warn("[ModifierAssignment] PUT failed, queueing to outbox", err);
    await queueAssignmentToOutbox(modifierGroupId, itemIds, orgId);
    return {
      ok: false,
      queued: true,
      affectedItemIds: dedupe([...itemIds, ...previousItemIds]),
      error: err.message || "Network error; queued for retry",
    };
  }
}

async function queueAssignmentToOutbox(
  modifierGroupId: string,
  itemIds: string[],
  orgId: string
): Promise<void> {
  await OutboxSyncService.addToOutbox(
    "modifier_assignment" as any,
    {
      modifier_group_id: modifierGroupId,
      item_ids: itemIds,
    },
    orgId,
    true
  );
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}
