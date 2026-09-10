import type { TypedSupabaseClient } from "@/lib/supabase/types";

/** Every account created by the integration suite uses this domain and is deleted afterwards. */
export const TEST_EMAIL_DOMAIN = "launchpad.test";

const ACTION_CLIENT_KEY = "__launchpadTestActionClient";
type ActionClientHolder = Record<typeof ACTION_CLIENT_KEY, TypedSupabaseClient | null | undefined>;

/** Sets the client that the mocked `@/lib/supabase/server` createClient() returns. */
export function setActionClient(client: TypedSupabaseClient | null): void {
  (globalThis as unknown as ActionClientHolder)[ACTION_CLIENT_KEY] = client;
}

export function getActionClient(): TypedSupabaseClient {
  const client = (globalThis as unknown as ActionClientHolder)[ACTION_CLIENT_KEY];
  if (!client) {
    throw new Error("No Supabase client is set for Server Actions. Call actAs() in the test first.");
  }
  return client;
}
