import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/database";

export function createSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string
) {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export function createSupabaseServerClient(
  supabaseUrl: string,
  serviceRoleKey: string
) {
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
