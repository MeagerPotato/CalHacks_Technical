import {
  deleteAccountsByDomain,
  readSupabaseStatus,
  requireLocal,
  requireLocalDatabase,
  waitForApi,
} from "../tests/support/local-supabase";
import { E2E_EMAIL_DOMAIN } from "./support/env";

/**
 * Points the suite at the running local Supabase stack, refuses remote targets, checks that the app under test
 * uses the same stack, and removes E2E accounts before and after the run.
 */
export default async function globalSetup() {
  const status = readSupabaseStatus();
  const supabaseUrl = requireLocal(status.API_URL, "Supabase API URL");
  const databaseUrl = requireLocalDatabase(status.DB_URL, "database URL");
  const publishableKey = status.PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("Missing the local Supabase publishable key.");
  }

  const appSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!appSupabaseUrl || new URL(appSupabaseUrl).port !== new URL(supabaseUrl).port) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL in .env.local must point at the running local Supabase stack.");
  }

  process.env.E2E_SUPABASE_URL = supabaseUrl;
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY = publishableKey;
  process.env.E2E_DATABASE_URL = databaseUrl;

  await deleteAccountsByDomain(databaseUrl, E2E_EMAIL_DOMAIN);
  await waitForApi(supabaseUrl, publishableKey, E2E_EMAIL_DOMAIN);

  return async () => {
    await deleteAccountsByDomain(databaseUrl, E2E_EMAIL_DOMAIN);
  };
}
