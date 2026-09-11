import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

// Local Supabase helpers shared by the integration and end-to-end global setups. They create and
// delete real accounts, so they refuse anything but a local stack and a reserved .test email domain.

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const API_READY_TIMEOUT_MS = 60_000;
// RFC 2606 reserves .test, so cleanup can never match a real address. Lowercase only (auth emails are).
const TEST_EMAIL_DOMAIN_PATTERN = /^(?:[a-z0-9-]+\.)+test$/;

/** Values read from `supabase status -o json`. */
export interface SupabaseStatus {
  API_URL?: string;
  PUBLISHABLE_KEY?: string;
  DB_URL?: string;
}

/** Reads the local stack's status through the project's Supabase CLI. Throws when the stack is not running. */
export function readSupabaseStatus(): SupabaseStatus {
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

/** Returns `value` when it points at a local host. Throws otherwise, so a remote project is never modified. */
export function requireLocal(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label} for the tests.`);
  }
  const { hostname } = new URL(value);
  if (!LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error(
      `${label} must point at a local Supabase stack (got "${hostname}"). The test suites create and delete accounts.`,
    );
  }
  return value;
}

/**
 * Returns the Postgres URL `value` when the connection it describes targets a local host. node-postgres lets a `host`
 * query parameter override the URL authority, so the host is read back from a pg client, which resolves it exactly as
 * a real connection would.
 */
export function requireLocalDatabase(value: string | undefined, label: string): string {
  const url = requireLocal(value, label);
  const { host } = new Client({ connectionString: url });
  if (!LOCAL_HOSTNAMES.has(host)) {
    throw new Error(
      `${label} must point at a local Supabase stack (got host "${host}"). The test suites create and delete accounts.`,
    );
  }
  return url;
}

/**
 * Deletes every account whose email ends in `@<domain>`, connecting as the local `postgres` role.
 *
 * Order satisfies every foreign key: reviews.reviewer_id is ON DELETE RESTRICT, so reviews written by
 * these accounts (organizers) go first. Deleting auth.users then cascades to profiles, their
 * applications, and any reviews of those applications.
 */
export async function deleteAccountsByDomain(databaseUrl: string, domain: string): Promise<void> {
  if (!TEST_EMAIL_DOMAIN_PATTERN.test(domain)) {
    throw new Error("Refusing to delete accounts outside a lowercase .test email domain.");
  }

  const db = new Client({ connectionString: requireLocalDatabase(databaseUrl, "database URL") });
  await db.connect();
  const pattern = `%@${domain}`;
  try {
    await db.query("begin");
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
 * Waits until a newly signed-up user can query the Data API. The probe account uses `emailDomain`
 * so the caller's cleanup removes it.
 */
export async function waitForApi(supabaseUrl: string, publishableKey: string, emailDomain: string): Promise<void> {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const email = `readiness-${randomUUID().slice(0, 12)}@${emailDomain}`;
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
