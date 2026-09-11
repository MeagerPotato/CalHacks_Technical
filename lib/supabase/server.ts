import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicEnv } from "@/lib/env";
import type { TypedSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers, bound to the
 * current user's session cookies. Create one per request; never cache it in module scope.
 * Queries run as the signed-in user, so Row Level Security always applies.
 */
export async function createClient(): Promise<TypedSupabaseClient> {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes the session on every
          // request, so ignoring the write here is safe.
        }
      },
    },
  });
}
