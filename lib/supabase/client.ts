import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/env";
import type { TypedSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database";

/**
 * Supabase client for Client Components. It uses the same session cookies as the server and
 * is still limited by Row Level Security. Prefer Server Actions for mutations so validation
 * and authorization run on the server.
 */
export function createClient(): TypedSupabaseClient {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
