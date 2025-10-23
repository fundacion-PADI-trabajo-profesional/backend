import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getConfig } from "./env";

let cachedClient: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient ?? null;

  const { supabaseUrl, supabaseKey } = getConfig();
  if (!supabaseUrl || !supabaseKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}


