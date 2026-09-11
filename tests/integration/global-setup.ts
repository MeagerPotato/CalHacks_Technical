import type { TestProject } from "vitest/node";

import {
  deleteAccountsByDomain,
  readSupabaseStatus,
  requireLocal,
  requireLocalDatabase,
  waitForApi,
} from "../support/local-supabase";
import { TEST_EMAIL_DOMAIN } from "./shared";

declare module "vitest" {
  export interface ProvidedContext {
    supabaseUrl: string;
    publishableKey: string;
    databaseUrl: string;
  }
}

/**
 * Reads the local stack's URL, publishable key, and database URL (or TEST_SUPABASE_URL,
 * TEST_SUPABASE_PUBLISHABLE_KEY, TEST_DATABASE_URL), refuses non-local targets, waits for the
 * API, and removes test accounts before and after the run.
 */
export default async function setup(project: TestProject) {
  const useEnv = Boolean(process.env.TEST_SUPABASE_URL);
  const status = useEnv ? {} : readSupabaseStatus();

  const supabaseUrl = requireLocal(process.env.TEST_SUPABASE_URL ?? status.API_URL, "Supabase API URL");
  const databaseUrl = requireLocalDatabase(process.env.TEST_DATABASE_URL ?? status.DB_URL, "database URL");
  const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? status.PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("Missing the Supabase publishable key for the integration tests.");
  }

  project.provide("supabaseUrl", supabaseUrl);
  project.provide("publishableKey", publishableKey);
  project.provide("databaseUrl", databaseUrl);

  await deleteAccountsByDomain(databaseUrl, TEST_EMAIL_DOMAIN);
  await waitForApi(supabaseUrl, publishableKey, TEST_EMAIL_DOMAIN);

  return async () => {
    await deleteAccountsByDomain(databaseUrl, TEST_EMAIL_DOMAIN);
  };
}
