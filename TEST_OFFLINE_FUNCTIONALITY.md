# Test Offline Functionality - Step by Step

## Prerequisites
- Build must complete: `npm run build`
- Start production server: `npm start`
- Open in browser: http://localhost:3000

## Test 1: Cache-First Loading (Online)

### Steps:
1. Open DevTools (F12) → Network tab
2. Clear browser cache (Hard refresh)
3. Login with PIN
4. **Expected**: See network requests for items, categories, modifiers
5. Navigate to different page and back to /sell
6. **Expected**: NO new network requests (data from cache)
7. Check console for: `[useItems] Cache is fresh, skipping network sync`

### Success Criteria:
✅ First load fetches from network  
✅ Subsequent loads use cache (0 network requests)  
✅ Page loads instantly (<100ms)  

## Test 2: Offline Receipt Saving

### Steps:
1. Add items to cart
2. Open DevTools → Network tab → Check "Offline"
3. Click "Pay" → "Cash" → Enter amount
4. **Expected**: Sale completes successfully
5. **Expected**: Toast message: "Sale saved offline. Will sync when online."
6. Check console for: `[Payment] Saving receipt offline to outbox`
7. Check console for: `[Outbox] Added receipt to outbox with id X`

### Success Criteria:
✅ Sale completes offline  
✅ Receipt saved to outbox  
✅ User sees success message  
✅ Cart clears  

## Test 3: Outbox Auto-Sync

### Steps:
1. With offline receipts in outbox
2. Uncheck "Offline" in DevTools
3. Wait 5-10 seconds
4. **Expected**: Console shows `[Outbox] Starting sync...`
5. **Expected**: Console shows `[Outbox] Receipt synced: <id>`
6. **Expected**: Console shows `[Outbox] Successfully synced receipt`

### Success Criteria:
✅ Outbox syncs automatically when online  
✅ Receipts appear in database  
✅ Sync status indicator updates  

## Test 4: Sync Status Indicator

### Steps:
1. Look at bottom-right corner
2. **Expected**: See green badge with "Online"
3. Go offline (DevTools or Airplane mode)
4. **Expected**: Badge turns red, shows "Offline"
5. Create offline sale
6. **Expected**: Badge turns yellow, shows "1 pending"
7. Click badge to see details
8. **Expected**: Shows pending count, last sync time
9. Go online
10. **Expected**: Badge shows "Syncing..." then back to green

### Success Criteria:
✅ Indicator shows correct online/offline status  
✅ Shows pending item count  
✅ Manual sync button works  
✅ Updates in real-time  

## Test 5: Stale Data Refresh

### Steps:
1. Login and load data
2. Wait 61+ minutes (or modify TTL to 1 minute for testing)
3. Navigate to /sell page
4. **Expected**: Console shows `[SyncManager] ITEMS age: >3600s, TTL: 3600s, stale: true`
5. **Expected**: Background refresh fetches new data
6. **Expected**: Page still loads instantly from cache first

### Success Criteria:
✅ Stale data triggers background refresh  
✅ Page loads instantly from cache  
✅ New data updates in background  

## Test 6: Force Refresh

### Steps:
1. On /sell page with cached data
2. Pull down to refresh (if implemented) OR
3. Click sync button in sync indicator
4. **Expected**: Network requests fire immediately
5. **Expected**: Data updates
6. **Expected**: New timestamp set

### Success Criteria:
✅ Force refresh bypasses cache  
✅ Fetches fresh data  
✅ Updates cache  

## Test 7: Complete Offline Workflow

### Steps:
1. Login and load all data
2. Enable Airplane mode (or DevTools offline)
3. Navigate between pages
4. **Expected**: All pages load from cache
5. View receipts page
6. **Expected**: Shows last 7 days of receipts
7. View reports
8. **Expected**: Shows cached report data
9. Complete 3 sales
10. **Expected**: All save to outbox
11. Disable Airplane mode
12. **Expected**: All 3 receipts sync automatically
13. Check receipts page
14. **Expected**: All 3 new receipts appear

### Success Criteria:
✅ Full app works offline  
✅ All data available (7 days)  
✅ Sales save to outbox  
✅ Auto-sync when online  
✅ No data loss  

## Test 8: Network Interruption During Sale

### Steps:
1. Start adding items to cart (online)
2. Enable offline mode
3. Complete sale
4. **Expected**: Sale saves to outbox
5. Re-enable online
6. **Expected**: Sale syncs automatically

### Success Criteria:
✅ Graceful fallback to offline  
✅ No errors shown to user  
✅ Sale completes successfully  

## Test 9: Multiple Offline Sales

### Steps:
1. Go offline
2. Complete 5 sales
3. Check sync indicator
4. **Expected**: Shows "5 pending"
5. Go online
6. **Expected**: All 5 sync in sequence
7. **Expected**: Indicator shows "Syncing..." then "Online"

### Success Criteria:
✅ Multiple sales queue in outbox  
✅ All sync when online  
✅ Correct order maintained  

## Test 10: Failed Sync Retry

### Steps:
1. Go offline
2. Complete sale
3. Modify outbox item to have invalid data (DevTools → IndexedDB)
4. Go online
5. **Expected**: Sync fails, item marked as 'failed'
6. **Expected**: Indicator shows "1 failed"
7. Fix data or click "Retry Failed"
8. **Expected**: Item retries and syncs

### Success Criteria:
✅ Failed items marked correctly  
✅ Retry mechanism works  
✅ User can manually retry  

## Performance Benchmarks

### Expected Performance:
- **First load** (cold cache): 2-3 seconds
- **Subsequent loads** (warm cache): <100ms
- **Offline page load**: <50ms
- **Network requests per page**: 0 (if cache fresh)
- **Outbox sync time**: <1 second per item

### Monitor in DevTools:
1. Network tab → Check request count
2. Performance tab → Check load time
3. Application → IndexedDB → Check data
4. Console → Check sync logs

## Troubleshooting

### If data doesn't load:
```javascript
// In console:
indexedDB.deleteDatabase('pos-offline');
// Then reload and login again
```

### If outbox doesn't sync:
```javascript
// In console:
import { OutboxSyncService } from '@/lib/services/outbox-sync';
await OutboxSyncService.syncOutbox();
```

### If cache is stale:
```javascript
// In console:
import { SyncManager } from '@/lib/services/sync-manager';
await SyncManager.clearSyncTimestamp(orgId, 'ITEMS');
```

## Console Commands for Testing

### Check sync status:
```javascript
import { SyncManager } from '@/lib/services/sync-manager';
const session = JSON.parse(sessionStorage.getItem('pos_session'));
const status = await SyncManager.getSyncStatus(session.org_id);
console.table(status);
```

### Check outbox:
```javascript
import { OutboxSyncService } from '@/lib/services/outbox-sync';
const counts = await OutboxSyncService.getOutboxCount();
console.log('Pending:', counts.pending, 'Failed:', counts.failed);
```

### Force sync:
```javascript
import { OutboxSyncService } from '@/lib/services/outbox-sync';
await OutboxSyncService.syncOutbox();
```

### Clear cache:
```javascript
const db = await indexedDB.open('pos-offline');
// Clear specific store
const tx = db.transaction(['items'], 'readwrite');
await tx.objectStore('items').clear();
```

## Expected Console Logs

### Normal cache hit:
```
[useItems] orgId: abc123, forceRefresh: false
[useItems] IDB hit: 45
[SyncManager] ITEMS age: 1200s, TTL: 3600s, stale: false
[useItems] Cache is fresh, skipping network sync
```

### Stale cache refresh:
```
[useItems] IDB hit: 45
[SyncManager] ITEMS age: 4200s, TTL: 3600s, stale: true
[useItems] Loaded items from API: 45
[SyncManager] Marked ITEMS as synced
```

### Offline sale:
```
[Payment] Network error, falling back to offline mode
[Payment] Saving receipt offline to outbox
[Outbox] Added receipt to outbox with id 1
```

### Outbox sync:
```
[Outbox] Network reconnected, syncing...
[Outbox] Starting sync...
[Outbox] Found 1 pending items
[Outbox] Receipt synced: abc123
[Outbox] Successfully synced receipt (id: 1)
[Outbox] Sync complete
```

## Sign-Off Checklist

- [ ] All 10 tests pass
- [ ] Performance benchmarks met
- [ ] No console errors
- [ ] Sync indicator works correctly
- [ ] Offline sales work
- [ ] Auto-sync works
- [ ] Cache prevents unnecessary requests
- [ ] 7 days of data available offline
- [ ] No data loss during network transitions
- [ ] User experience is smooth

## Notes

- Build must complete before testing
- Use production mode for accurate performance
- Test on real device for true offline experience
- Monitor IndexedDB size (should stay reasonable)
- Check network tab to verify 0 requests on cache hits
