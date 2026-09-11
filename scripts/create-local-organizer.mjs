// Creates a local Organizer login for trying the organizer pages.
//
// The account is made the supported way: a normal signup through local Supabase Auth, then
// `private.promote_to_organizer` as the local postgres role. The script refuses any Supabase stack that is not on this
// machine and any email that already has an account. It prints a generated password once and writes nothing to disk.
// `npm run db:reset` deletes every local auth user, so run it again after a reset.
//
// Usage: npm run organizer:create -- [email]
// The default email is organizer@mission-control.test (.test is reserved, so it can never reach a real inbox).

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const DEFAULT_EMAIL = "organizer@mission-control.test";
const DISPLAY_NAME = "Local Organizer";

function readSupabaseStatus() {
  const cli = path.resolve(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
  let output;
  try {
    output = execFileSync(process.execPath, [cli, "status", "-o", "json"], {
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
  return JSON.parse(output.slice(start, end + 1));
}

function requireLocal(value, label) {
  if (!value) {
    throw new Error(`The local stack did not report its ${label}.`);
  }
  const { hostname } = new URL(value);
  if (!LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error(`The ${label} points at "${hostname}". This script only changes a local Supabase stack.`);
  }
  return value;
}

async function main() {
  const email = (process.argv[2] ?? DEFAULT_EMAIL).trim().toLowerCase();
  const status = readSupabaseStatus();
  const supabaseUrl = requireLocal(status.API_URL, "API URL");
  const databaseUrl = requireLocal(status.DB_URL, "database URL");
  if (!status.PUBLISHABLE_KEY) {
    throw new Error("The local stack did not report its publishable key.");
  }

  // node-postgres lets a `host` query parameter override the URL, so check the host a connection would really use.
  const db = new pg.Client({ connectionString: databaseUrl });
  if (!LOCAL_HOSTNAMES.has(db.host)) {
    throw new Error(`The database host is "${db.host}". This script only changes a local Supabase stack.`);
  }

  await db.connect();
  try {
    const existing = await db.query("select 1 from auth.users where lower(email) = $1", [email]);
    if (existing.rowCount > 0) {
      throw new Error(`${email} already has an account. Only promote an account you just created; pass another email.`);
    }

    const password = randomBytes(18).toString("base64url");
    const auth = createClient(supabaseUrl, status.PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await auth.auth.signUp({ email, password, options: { data: { display_name: DISPLAY_NAME } } });
    if (error || !data.user) {
      throw new Error(`Signup failed: ${error ? error.code : "no user returned"}.`);
    }

    await db.query("select private.promote_to_organizer($1)", [email]);

    console.log("Local Organizer account created.");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log("Sign in at http://localhost:3000/login to open Mission Control. Keep this password out of the repository.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
