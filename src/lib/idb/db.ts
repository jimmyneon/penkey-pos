import { openDB, IDBPDatabase } from 'idb';

export type POSDB = IDBPDatabase<unknown>;

let dbPromise: Promise<POSDB> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB('pos-offline', 4, {
      upgrade(db, oldVersion) {
        // Core catalogs
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('modifier_groups')) db.createObjectStore('modifier_groups', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('modifiers')) db.createObjectStore('modifiers', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('item_modifiers')) db.createObjectStore('item_modifiers', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('prices')) db.createObjectStore('prices', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('taxes')) db.createObjectStore('taxes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('register_settings')) db.createObjectStore('register_settings', { keyPath: 'org_id' });

        // Receipts: keep last 7 days and allow pagination
        if (!db.objectStoreNames.contains('receipts')) {
          const store = db.createObjectStore('receipts', { keyPath: 'id' });
          store.createIndex('by_created_at', 'created_at');
          store.createIndex('by_org', 'org_id');
        }

        // Reports cache: key by metric+range+org
        if (!db.objectStoreNames.contains('reports_cache')) db.createObjectStore('reports_cache', { keyPath: 'key' });

        // Outbox for offline mutations
        if (!db.objectStoreNames.contains('outbox')) {
          const store = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_status', 'status');
          store.createIndex('by_type', 'type');
        }

        // Meta/version timestamps
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });

        // React Query cache persistence
        if (!db.objectStoreNames.contains('queries')) db.createObjectStore('queries', { keyPath: 'key' });

        // Full modifier groups per item for offline modifier dialog
        if (!db.objectStoreNames.contains('item_modifier_groups')) db.createObjectStore('item_modifier_groups', { keyPath: 'item_id' });

        // Cached PIN hashes for fast local verification (v4)
        if (!db.objectStoreNames.contains('cached_pins')) {
          const store = db.createObjectStore('cached_pins', { keyPath: 'member_id' });
          store.createIndex('by_org', 'org_id');
        }
      },
    });
  }
  return dbPromise;
}

export async function putMany(storeName: string, records: any[]) {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName as any);
  // Use Promise.all for parallel writes instead of sequential
  await Promise.all(records.map(r => store.put(r)));
  await tx.done;
}

export async function getAll(storeName: string) {
  const db = await getDB();
  return db.getAll(storeName as any);
}

export async function getByKey(storeName: string, key: IDBValidKey) {
  const db = await getDB();
  return db.get(storeName as any, key);
}

export async function getAllByIndex<T = any>(storeName: string, indexName: string, query: IDBKeyRange | IDBValidKey): Promise<T[]> {
  const db = await getDB();
  return (await db.getAllFromIndex(storeName as any, indexName as any, query)) as T[];
}

export async function getAllByIndexRange<T = any>(storeName: string, indexName: string, lower?: IDBValidKey, upper?: IDBValidKey, lowerOpen?: boolean, upperOpen?: boolean): Promise<T[]> {
  let range: IDBKeyRange | undefined;
  if (lower !== undefined && upper !== undefined) {
    range = IDBKeyRange.bound(lower, upper, !!lowerOpen, !!upperOpen);
  } else if (lower !== undefined) {
    range = IDBKeyRange.lowerBound(lower, !!lowerOpen);
  } else if (upper !== undefined) {
    range = IDBKeyRange.upperBound(upper, !!upperOpen);
  }
  return getAllByIndex<T>(storeName, indexName, range as any);
}

export async function setMeta(key: string, value: any) {
  const db = await getDB();
  await db.put('meta', { key, value, updated_at: Date.now() });
}

export async function getMeta<T = any>(key: string): Promise<T | null> {
  const db = await getDB();
  const res = (await db.get('meta', key)) as any;
  return res ? (res.value as T) : null;
}

export async function deleteMeta(key: string) {
  const db = await getDB();
  await db.delete('meta', key);
}

export async function clearStore(storeName: string) {
  const db = await getDB();
  const tx = db.transaction(storeName, 'readwrite');
  await tx.objectStore(storeName as any).clear();
  await tx.done;
}
