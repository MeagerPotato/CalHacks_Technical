import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

import { TEST_EMAIL_DOMAIN } from "./shared";

declare module "vitest" {
  export interface ProvidedContext {
    supabaseUrl: string;
    publishableKey: string;
    databaseUrl: string;
  }
}

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const API_READY_TIMEOUT_MS = 60_000;

interface SupabaseStatus {
  API_URL?: string;
  PUBLISHABLE_KEY?: string;
  DB_URL?: string;
}

function readSupabaseStatus(): SupabaseStatus {
  const cli = path.resolve(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
  let output: string;
  try {
    output = execFileSync(process.execPath, [cli, "status", "-o", "json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error("Could not read the local Supabase stack. Start Docker and run `npm run db:start` first.", {
      cause: error,
    });
  }

  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("`supabase status -o json` did not return JSON. Is the local stack running?");
  }
  return JSON.parse(output.slice(start, end + 1)) as SupabaseStatus;
}

function requireLocal(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label} for the integration tests.`);
  }
  const { hostname } = new URL(value);
  if (!LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error(
      `${label} must point at a local Supabase stack (got "${hostname}"). The integration suite creates and deletes accounts.`,
    );
  }
  return value;
}

async function deleteTestAccounts(databaseUrl: string): Promise<void> {
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const pattern = `%@${TEST_EMAIL_DOMAIN}`;
  try {
    await db.query("begin");
    // reviews.reviewer_id is ON DELETE RESTRICT, so remove reviews written by test organizers first.
    await db.query("delete from public.reviews r using auth.users u where r.reviewer_id = u.id and u.email like $1", [
      pattern,
    ]);
    await db.query("delete from auth.users where email like $1", [pattern]);
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * `supabase db reset` restarts the API containers, which can briefly reject fresh sessions.
 * Waits until a newly signed-up user can query the Data API.
 */
async function waitForApi(supabaseUrl: string, publishableKey: string): Promise<void> {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const email = `readiness-${randomUUID().slice(0, 12)}@${TEST_EMAIL_DOMAIN}`;
  const password = `pw-${randomUUID()}`;
  const deadline = Date.now() + API_READY_TIMEOUT_MS;
  let signedIn = false;
  let lastProblem = "no response";

  while (Date.now() < deadline) {
    try {
      if (!signedIn) {
        const signUp = await client.auth.signUp({ email, password });
        const result =
          signUp.error?.code === "user_already_exists" ? await client.auth.signInWithPassword({ email, password }) : signUp;
        if (result.error || !result.data.session) {
          lastProblem = `auth: ${result.error?.code ?? "no session"}`;
        } else {
          signedIn = true;
        }
      }

      if (signedIn) {
        const { error } = await client.from("profiles").select("id").limit(1);
        if (!error) {
          return;
        }
        lastProblem = `data api: ${error.code}`;
      }
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`The local Supabase API did not become ready within ${API_READY_TIMEOUT_MS / 1000}s (${lastProblem}).`);
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
  const databaseUrl = requireLocal(process.env.TEST_DATABASE_URL ?? status.DB_URL, "database URL");
  const publishableKey = process.env.TEST_SUPABASE_PUBLISHABLE_KEY ?? status.PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("Missing the Supabase publishable key for the integration tests.");
  }

  project.provide("supabaseUrl", supabaseUrl);
  project.provide("publishableKey", publishableKey);
  project.provide("databaseUrl", databaseUrl);

  await deleteTestAccounts(databaseUrl);
  await waitForApi(supabaseUrl, publishableKey);

  return async () => {
    await deleteTestAccounts(databaseUrl);
  };
}
