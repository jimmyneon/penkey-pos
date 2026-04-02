"use client";

import { PropsWithChildren, useEffect, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { persistQueryClient, Persister, PersistedClient } from "@tanstack/react-query-persist-client";
import { getDB } from "@/lib/idb/db";

export function QueryProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const queryClientRef = useRef<QueryClient | null>(null);

  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 24 * 60 * 60 * 1000,
          gcTime: 48 * 60 * 60 * 1000,
          refetchOnWindowFocus: false,
          refetchOnReconnect: true,
          retry: 2,
        },
        mutations: {
          retry: 2,
        },
      },
    });
  }

  const queryClient = queryClientRef.current;

  // Minimal persister using our IDB 'queries' store
  const persister: Persister | null = typeof window === "undefined" ? null : {
    persistClient: async (client: PersistedClient) => {
      const db = await getDB();
      await db.put('queries' as any, { key: 'reactQuery', client, ts: Date.now() } as any);
    },
    restoreClient: async () => {
      const db = await getDB();
      const row: any = await db.get('queries' as any, 'reactQuery');
      return row?.client ?? null;
    },
    removeClient: async () => {
      const db = await getDB();
      await db.delete('queries' as any, 'reactQuery');
    },
  };

  useEffect(() => {
    if (!persister) return;
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 48 * 60 * 60 * 1000,
      hydrateOptions: {
        defaultOptions: {
          queries: { staleTime: 24 * 60 * 60 * 1000 },
        },
      },
    });
    setIsReady(true);
  }, [persister, queryClient]);

  if (!isReady) return null;

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
