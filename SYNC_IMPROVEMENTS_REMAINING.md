# Sync System Improvements - Remaining Work

**Date:** May 23, 2026  
**Status:** Critical bugs fixed (modifier link loss, item edit loss). Remaining items are enhancements for robustness and observability.

---

## ✅ Completed (Already Deployed)

These fixes address the specific symptoms reported: "press sync → lose modifiers" and "item/modifier edits lost on flaky network."

### 1. Non-destructive sync for modifier groups
- **File:** `src/lib/offline/prefetch.ts`
- **Change:** Removed destructive write of `{ groups: [] }` on per-item fetch timeout. Now uses `fetchWithRetry` (15s timeout, 2 attempts) and preserves existing local rows on failure. Freshness timestamp only set when all items succeed.
- **Impact:** Modifier links no longer disappear when manual sync hits a timeout.

### 2. Batch endpoint for item→modifier groups
- **File:** `src/app/api/items/modifiers/batch/route.ts` (new)
- **Change:** Single endpoint returns all item→modifier-group associations for an org in one query.
- **Impact:** Eliminates N parallel HTTP calls during prefetch, dramatically reducing timeout probability.

### 3. Set-based reconcile for modifier assignment
- **File:** `src/app/api/items/modifiers/assign/route.ts`
- **Change:** Added PUT method that atomically reconciles the full set of items linked to a modifier group (insert missing, delete removed). POST kept for backward-compat with additive flows.
- **Impact:** Eliminates read-modify-write race in the old "unassign by re-posting remaining ids" flow.

### 4. Outbox fallback for modifier assignments
- **File:** `src/lib/services/modifier-assignment.ts` (new), `src/lib/services/outbox-sync.ts`
- **Change:** Added `modifier_assignment` outbox type. UI uses `setModifierGroupItems()` helper which queues to outbox on network/5xx failure. Local cache refreshes when queued item syncs.
- **Impact:** Modifier assignments survive offline / server errors.

### 5. Outbox fallback for item edits
- **File:** `src/app/items/quick-edit-dialog.tsx`
- **Change:** Item PATCH now queues to outbox on network/5xx failure.
- **Impact:** Item edits are never silently lost.

### 6. Per-item cache invalidation
- **File:** `src/lib/services/modifier-assignment.ts`
- **Change:** `refreshLocalItemModifierGroups()` refreshes only affected items' IDB rows after successful assignment, non-destructive on failure.
- **Impact:** Sell page reflects modifier changes immediately without waiting for full sync.

### 7. Non-destructive UnifiedSync
- **File:** `src/lib/services/unified-sync.ts`
- **Change:** Removed `tx.store.clear()` on `item_modifier_groups`. Now only clears the freshness TTL.
- **Impact:** Manual sync no longer wipes the entire store before re-fetch.

---

## 📋 Remaining Improvements (Deferred)

These are enhancements for robustness, conflict resolution, and observability. Not required for the reported symptoms.

### P1: Single sync coordinator
**Current state:** Two separate sync paths — background (push-only) and manual (push+pull).  
**Problem:** Inconsistent behavior, no single source of truth.  
**Proposed:** Merge into one `SyncCoordinator` with three phases:
1. Push local changes (outbox)
2. Pull fresh data (incremental if possible)
3. Reconcile conflicts

**Files to modify:**
- `src/lib/services/sync-manager.ts` (extend)
- `src/app/sell/page.tsx` (background sync)
- `src/components/page-header.tsx` (manual sync)

---

### P1: Incremental pull with `updated_at`
**Current state:** Full fetch of all items/categories/modifiers on every sync.  
**Problem:** Wasteful on large catalogs, slow on poor connections.  
**Proposed:** Add `?since=` parameter to all list APIs (items, categories, modifiers, taxes). Pull only rows with `updated_at > since`.  
**Database requirement:** Ensure `updated_at` column exists and is indexed on all sync'd tables.

**Files to modify:**
- `src/app/api/items/route.ts` (add `since` query param)
- `src/app/api/categories/route.ts`
- `src/app/api/modifiers/route.ts`
- `src/app/api/taxes/route.ts`
- `src/lib/offline/prefetch.ts` (pass `since` from stored timestamp)

---

### P1: Tombstones for deleted items
**Current state:** Soft-deleted items (`is_active = false`) remain in local IDB indefinitely.  
**Problem:** Stale deleted items can linger locally and reappear if cache isn't cleared.  
**Proposed:** 
- Add `deleted_at` column to items/categories/modifiers tables (null if not deleted)
- API returns deleted items with `deleted_at` when `?include_deleted=true`
- Local sync removes IDB rows for items with `deleted_at` set
- Or: add a "sync deletions" flag that triggers a full reconcile

**Files to modify:**
- Database migration: add `deleted_at` columns
- API routes: support `include_deleted` filter
- `src/lib/offline/prefetch.ts`: handle deletions

---

### P1: Dirty flag on IDB rows
**Current state:** Pull sync can overwrite unsynced local changes if timing is unlucky (local edit queued, then full sync pulls stale remote data before outbox flush).  
**Problem:** Lost local changes in race condition.  
**Proposed:** Add `dirty: boolean` flag to IDB rows modified locally. Pull sync skips dirty rows; outbox sync clears dirty flag after successful push.

**Files to modify:**
- `src/lib/idb/db.ts`: add `dirty` to relevant stores (items, categories, modifiers)
- Mutation UIs: set `dirty = true` on local IDB write
- `src/lib/offline/prefetch.ts`: skip dirty rows during pull
- `src/lib/services/outbox-sync.ts`: clear dirty flag after successful sync

---

### P2: Conflict resolution with `if_unmodified_since`
**Current state:** Concurrent edits can clobber each other (last write wins).  
**Problem:** No detection of concurrent edits by different users/devices.  
**Proposed:** 
- APIs accept `if_unmodified_since` header (based on `updated_at`)
- On conflict (409), surface to user with "Someone else edited this item. Their version: X. Your version: Y. Overwrite or discard?"
- Outbox sync includes `updated_at` from local row

**Files to modify:**
- API routes: add `if_unmodified_since` header check
- `src/lib/services/outbox-sync.ts`: include `updated_at` in sync payload
- UI: add conflict resolution dialog

---

### P2: Outbox UI surface
**Current state:** Failed outbox items are invisible to users unless they check console.  
**Problem:** No visibility into pending/failed syncs.  
**Proposed:** Add a "Sync Status" panel showing:
- Pending count
- Failed count
- List of failed items with error messages
- "Retry failed" button

**Files to modify:**
- `src/components/sync-status-indicator.tsx` (expand)
- `src/app/sell/sidebar-menu.tsx` (add sync status section)

---

### P2: Sync history log
**Current state:** No audit trail of sync runs.  
**Problem:** Hard to debug sync issues retroactively.  
**Proposed:** Store sync history in IDB `meta`:
```typescript
{
  key: `sync_history_${orgId}`,
  value: [
    { started_at, finished_at, pushed, pulled, error, types: { ... } },
    ...
  ]
}
```
Add a "View Sync History" button in sync panel.

**Files to modify:**
- `src/lib/services/unified-sync.ts`: log each sync run
- `src/lib/idb/db.ts`: helper for sync history
- UI: sync history dialog

---

### P2: Outbox paths for remaining mutations
**Current state:** Only `receipt`, `item_update`, `category_update`, `modifier_assignment` use outbox.  
**Problem:** Other mutations (new item creation, modifier group/option CRUD, reordering) are lost on network failure.  
**Proposed:** Add outbox types for:
- `item_create`
- `item_delete`
- `modifier_group_create|update|delete`
- `modifier_option_create|update|delete`
- `modifier_reorder`

**Files to modify:**
- `src/lib/services/outbox-sync.ts`: add types and sync methods
- UI mutation dialogs: use outbox helpers instead of direct fetch

---

### P2: Playwright tests
**Current state:** No automated tests for sync behavior.  
**Problem:** Hard to verify sync robustness after changes.  
**Proposed:** Add Playwright test:
- Go offline
- Create new item
- Add modifier group to item
- Edit item
- Go online
- Press sync
- Verify all changes appear in database
- Verify no duplicate receipts

**Files to create:**
- `tests/sync.spec.ts`

---

## Priority Summary

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| P1 | Single sync coordinator | Consistency | Medium |
| P1 | Incremental pull | Performance | Medium |
| P1 | Tombstones for deletions | Data hygiene | Medium |
| P1 | Dirty flag on IDB rows | Race prevention | Medium |
| P2 | Conflict resolution | Multi-user safety | High |
| P2 | Outbox UI surface | Observability | Low |
| P2 | Sync history log | Debugging | Low |
| P2 | Outbox for all mutations | Robustness | Medium |
| P2 | Playwright tests | Confidence | Medium |

---

## Implementation Order Recommendation

1. **P1: Dirty flag** — prevents race condition between local edit and pull sync
2. **P1: Incremental pull** — reduces sync time, makes large catalogs viable
3. **P1: Single sync coordinator** — unifies behavior, easier to reason about
4. **P2: Outbox for all mutations** — makes system truly offline-first
5. **P2: Conflict resolution** — multi-user safety
6. **P2: Outbox UI + Sync history** — observability
7. **P1: Tombstones** — data hygiene (can defer if soft-delete is sufficient)
8. **P2: Playwright tests** — confidence (can defer to later)

---

## Notes

- All completed changes are backward-compatible. Existing POST `/api/items/modifiers/assign` still works for additive flows.
- The batch endpoint is a performance optimization; fallback to per-item fetch is preserved.
- Outbox fallback is opt-in per mutation type; existing direct fetch paths still work.
