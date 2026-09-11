/** Every account the end-to-end suite creates uses this domain and is deleted before and after the run. */
export const E2E_EMAIL_DOMAIN = "launchpad-e2e.test";

export interface E2EEnvironment {
  supabaseUrl: string;
  publishableKey: string;
  databaseUrl: string;
}

/** Local stack values published by e2e/global-setup.ts through process.env, which Playwright passes to workers. */
export function e2eEnvironment(): E2EEnvironment {
  const supabaseUrl = process.env.E2E_SUPABASE_URL;
  const publishableKey = process.env.E2E_SUPABASE_PUBLISHABLE_KEY;
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!supabaseUrl || !publishableKey || !databaseUrl) {
    throw new Error("The E2E environment is missing. Run the suite with `npm run test:e2e` so global setup runs first.");
  }
  return { supabaseUrl, publishableKey, databaseUrl };
}
