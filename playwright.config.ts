import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Load .env.local the same way Next.js does, so the app under test and this guard see the same Supabase URL.
loadEnvConfig(process.cwd());

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl || !LOCAL_HOSTNAMES.has(new URL(supabaseUrl).hostname)) {
  throw new Error(
    "The end-to-end suite creates and deletes accounts, so NEXT_PUBLIC_SUPABASE_URL must point at a local Supabase stack.",
  );
}

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // Tests share one local database and the auth rate limit, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Liftoff and landing motion are skipped by default; motion-specific tests opt back in with page.emulateMedia.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build: this is what deploys, and /dev/gallery must 404 here.
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 300_000,
    env: { SITE_URL: BASE_URL },
  },
});
