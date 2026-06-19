import { putMany, setMeta } from "@/lib/idb/db";
import { SyncManager } from "@/lib/services/sync-manager";
import { cachePinHashes } from "@/lib/services/pin-cache";

async function safeJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try { return (await res.json()) as T; } catch { return null; }
}

async function fetchWithTimeout<T>(url: string, timeoutMs: number = 5000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'include' });
    return await safeJson<T>(res);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log(`[Prefetch] Request timed out: ${url}`);
    } else {
      console.error(`[Prefetch] Request failed: ${url}`, err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Retry helper for critical per-item fetches. Returns null only after all attempts fail.
async function fetchWithRetry<T>(url: string, timeoutMs: number = 15000, attempts: number = 2): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    const result = await fetchWithTimeout<T>(url, timeoutMs);
    if (result !== null) return result;
    if (i < attempts - 1) {
      // Small backoff between attempts
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return null;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Modifier TTL: 4 hours — skip re-fetching per-item modifiers if recently done
const MODIFIER_GROUPS_TTL = 4 * 60 * 60 * 1000;

export async function prefetchOrgData(orgId: string, registerId?: string) {
  console.log('[Prefetch] Starting data prefetch for org:', orgId);
  const startTime = Date.now();
  const tasks: Promise<any>[] = [];

  // Fetch items once and reuse for both caching and modifier fetching
  // This avoids a duplicate /api/items network request
  const itemsPromise = fetchWithTimeout<any[]>(`/api/items?org_id=${orgId}`);

  // Categories
  tasks.push(
    fetchWithTimeout<any[]>(`/api/categories?org_id=${orgId}`).then(async (rows) => {
      if (rows && rows.length) {
        await putMany("categories", rows.map((x) => ({ ...x, org_id: orgId })));
        console.log(`[Prefetch] ✓ Cached ${rows.length} categories`);
      }
      await SyncManager.markSynced(orgId, 'CATEGORIES');
    }).catch(() => {})
  );

  // Items
  tasks.push(
    itemsPromise.then(async (rows) => {
      if (rows && rows.length) {
        await putMany("items", rows.map((x) => ({ ...x, org_id: orgId })));
        console.log(`[Prefetch] ✓ Cached ${rows.length} items`);
      }
      await SyncManager.markSynced(orgId, 'ITEMS');
    }).catch(() => {})
  );

  // Modifiers list
  tasks.push(
    fetchWithTimeout<any[]>(`/api/modifiers?org_id=${orgId}`).then(async (rows) => {
      if (rows && rows.length) {
        await putMany("modifiers", rows.map((x) => ({ ...x, org_id: orgId })));
        console.log(`[Prefetch] ✓ Cached ${rows.length} modifiers`);
      }
      await SyncManager.markSynced(orgId, 'MODIFIERS');
    }).catch(() => {})
  );

  // Modifier groups (full groups with options - used by modifiers page)
  tasks.push(
    fetchWithTimeout<any[]>(`/api/modifiers/groups?org_id=${orgId}`).then(async (rows) => {
      if (rows && rows.length) {
        // Store in IndexedDB as well for consistency
        await putMany("modifier_groups", rows.map((x) => ({ ...x, org_id: orgId })));
        console.log(`[Prefetch] ✓ Cached ${rows.length} modifier groups`);
      }
    }).catch(() => {})
  );

  // Item -> Modifier groups: reuse items promise, skip if recently cached
  tasks.push(
    itemsPromise.then(async (items) => {
      if (!items || !items.length) return;

      // Skip if modifier groups were fetched recently (TTL guard)
      const lastTs = await import('@/lib/idb/db').then(m => m.getMeta<number>(`item_modifiers_${orgId}_ts`));
      if (lastTs && (Date.now() - lastTs) < MODIFIER_GROUPS_TTL) {
        console.log(`[Prefetch] Modifier groups fresh (${Math.round((Date.now() - lastTs) / 60000)}m old), skipping re-fetch`);
        return;
      }

      const now = Date.now();
      const idb = await import('@/lib/idb/db');

      // ---- Strategy 1: try the batch endpoint first (one HTTP call) ----
      console.log(`[Prefetch] Fetching modifier groups for ${items.length} items (batch first)`);
      const batch = await fetchWithTimeout<{ items: Array<{ item_id: string; groups: any[] }> }>(
        `/api/items/modifiers/batch?org_id=${orgId}`,
        20000
      );

      if (batch && Array.isArray(batch.items)) {
        // Map keyed by item_id for fast merge
        const byId = new Map<string, any[]>();
        for (const row of batch.items) byId.set(row.item_id, row.groups || []);

        const fullGroups = items.map((it) => ({
          item_id: it.id,
          groups: byId.get(it.id) || [],
          org_id: orgId,
          ts: now,
        }));

        const withModifiers = fullGroups.filter((g) => g.groups.length > 0).length;
        await putMany("item_modifier_groups", fullGroups);
        await idb.setMeta(`item_modifiers_${orgId}_ts`, now);
        console.log(
          `[Prefetch] ✓ Modifier groups cached via batch: ${withModifiers} with, ${fullGroups.length - withModifiers} without`
        );
        return;
      }

      // ---- Strategy 2: fallback to per-item fetches with retry + NON-DESTRUCTIVE merge ----
      console.log('[Prefetch] Batch endpoint unavailable, falling back to per-item fetch');
      let withModifiers = 0;
      let withoutModifiers = 0;
      let failed = 0;
      const successfulRows: any[] = [];

      await Promise.all(
        items.map(async (it) => {
          // 15s timeout, 2 attempts
          const groups = await fetchWithRetry<any[]>(`/api/items/${it.id}/modifiers/full`, 15000, 2);
          if (groups === null) {
            // CRITICAL: do NOT overwrite existing local cache on failure.
            // The previous implementation wrote `{ groups: [] }` here, silently wiping
            // modifier links for items whose request timed out.
            failed++;
            return;
          }
          successfulRows.push({ item_id: it.id, groups, org_id: orgId, ts: now });
          if (groups.length > 0) withModifiers++;
          else withoutModifiers++;
        })
      );

      if (successfulRows.length) {
        await putMany("item_modifier_groups", successfulRows);
      }
      console.log(
        `[Prefetch] ✓ Modifier groups cached: ${withModifiers} with, ${withoutModifiers} without, ${failed} preserved (request failed)`
      );

      // Only update the freshness timestamp if EVERY item succeeded, otherwise we
      // want the next sync to retry the failed ones.
      if (failed === 0) {
        await idb.setMeta(`item_modifiers_${orgId}_ts`, now);
      }
    }).catch((err) => {
      console.error('[Prefetch] Failed to cache modifier groups:', err);
    })
  );

  // Taxes
  tasks.push(
    fetchWithTimeout<any[]>(`/api/taxes?org_id=${orgId}`).then(async (rows) => {
      if (rows && rows.length) await putMany("taxes", rows.map((x) => ({ ...x, org_id: orgId })));
      await SyncManager.markSynced(orgId, 'TAXES');
    }).catch(() => {})
  );

  // Register settings (only if register_id is provided)
  if (registerId) {
    tasks.push(
      fetchWithTimeout<any>(`/api/register/settings?org_id=${orgId}&register_id=${registerId}`).then(async (row) => {
        if (row) await putMany("register_settings", [{ ...row, org_id: orgId, register_id: registerId }]);
        await SyncManager.markSynced(orgId, 'REGISTER_SETTINGS');
      }).catch(() => {})
    );
  } else {
    console.log('[Prefetch] Skipping register settings - no register_id provided');
    await SyncManager.markSynced(orgId, 'REGISTER_SETTINGS');
  }

  // Receipts last 7 days
  tasks.push(
    fetchWithTimeout<any[]>(`/api/receipts?org_id=${orgId}&since=${encodeURIComponent(isoDaysAgo(7))}`)
      .then(async (rows) => {
        if (rows && rows.length) await putMany("receipts", rows.map((x) => ({ ...x, org_id: orgId })));
        await SyncManager.markSynced(orgId, 'RECEIPTS');
      }).catch(() => {})
  );

  // Reports cache (daily + sales summary last 7 days)
  tasks.push(
    fetchWithTimeout<any>(`/api/stats/daily?org_id=${orgId}&since=${encodeURIComponent(isoDaysAgo(7))}`)
      .then(async (data) => {
        if (data) {
          await putMany("reports_cache", [{ key: `daily_7d_${orgId}`, data, ts: Date.now() }]);
          await SyncManager.markSynced(orgId, 'REPORTS');
        }
      }).catch(() => {})
  );
  tasks.push(
    fetchWithTimeout<any>(`/api/reports/sales-summary?org_id=${orgId}&since=${encodeURIComponent(isoDaysAgo(7))}`)
      .then(async (data) => {
        if (data) await putMany("reports_cache", [{ key: `sales_summary_7d_${orgId}`, data, ts: Date.now() }]);
      }).catch(() => {})
  );

  // Cache PIN hashes + register for fully-offline PIN verification on next lock
  tasks.push(
    (async () => {
      let register: any = null;
      if (registerId) {
        try {
          const res = await fetchWithTimeout<any[]>(`/api/registers?org_id=${orgId}&active=true`);
          register = res?.[0] || null;
        } catch {}
      }
      await cachePinHashes(orgId, register);
      console.log('[Prefetch] ✓ Cached PIN hashes for fast local verification');
    })().catch((err) => {
      console.error('[Prefetch] Failed to cache PIN hashes:', err);
    })
  );

  await Promise.all(tasks);
  
  const duration = Date.now() - startTime;
  console.log(`[Prefetch] ✅ Complete! Cached all data in ${duration}ms`);
  console.log('[Prefetch] Data ready for offline use');
}
