import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { Client, type QueryResultRow } from "pg";
import { expect, inject } from "vitest";

import type { ActionError, ActionErrorCode, ActionResult } from "@/lib/actions/result";
import type { ApplicationType, PublicAccountRole } from "@/lib/domain/enums";
import type { TypedSupabaseClient } from "@/lib/supabase/types";
import type { Database, Json } from "@/types/database";

import { TEST_EMAIL_DOMAIN, setActionClient } from "./shared";

export interface TestUser {
  client: TypedSupabaseClient;
  userId: string;
  email: string;
  password: string;
}

/** A Supabase client using the publishable key, exactly like the app. No service-role key. */
export function createTestClient(): TypedSupabaseClient {
  return createClient<Database>(inject("supabaseUrl"), inject("publishableKey"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function testEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 12)}@${TEST_EMAIL_DOMAIN}`.toLowerCase();
}

/** Random per-account password; test accounts are deleted after the run. */
export function newPassword(): string {
  return `pw-${randomUUID()}`;
}

/** Signs up through Supabase Auth directly. Omitting the role exercises the database default. */
export async function signUpTestUser(options: {
  label: string;
  role?: PublicAccountRole;
  displayName?: string;
}): Promise<TestUser> {
  const client = createTestClient();
  const email = testEmail(options.label);
  const password = newPassword();

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        ...(options.role ? { account_role: options.role } : {}),
        ...(options.displayName ? { display_name: options.displayName } : {}),
      },
    },
  });

  if (error || !data.user || !data.session) {
    throw new Error(`Test signup failed: ${error ? `${error.code} ${error.message}` : "no session returned"}`);
  }
  return { client, userId: data.user.id, email, password };
}

export async function withDatabase<T>(run: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: inject("databaseUrl") });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

/** Runs SQL as the local `postgres` role for setup and verification only (never app code). */
export async function queryRows<R extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<R[]> {
  return withDatabase(async (db) => (await db.query<R>(sql, values)).rows);
}

/** Creates an Organizer the only supported way: a normal account promoted by admin SQL. */
export async function createOrganizer(label = "organizer"): Promise<TestUser> {
  const user = await signUpTestUser({ label });
  await queryRows("select private.promote_to_organizer($1)", [user.email]);
  return user;
}

/** Creates (and optionally submits) an application through the Data API as the applicant. */
export async function createApplicationAs(
  user: TestUser,
  type: ApplicationType,
  responses: Record<string, unknown>,
  options: { submit: boolean },
): Promise<string> {
  const { data, error } = await user.client
    .from("applications")
    .insert({ user_id: user.userId, application_type: type, responses: responses as Json })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Test application insert failed: ${error.code} ${error.message}`);
  }

  if (options.submit) {
    const { error: submitError } = await user.client.from("applications").update({ status: "submitted" }).eq("id", data.id);
    if (submitError) {
      throw new Error(`Test application submit failed: ${submitError.code} ${submitError.message}`);
    }
  }
  return data.id;
}

/** Makes Server Actions and DAL reads run as this user (or as a signed-out client). */
export function actAs(target: TestUser | TypedSupabaseClient): void {
  setActionClient(isTestUser(target) ? target.client : target);
}

function isTestUser(target: TestUser | TypedSupabaseClient): target is TestUser {
  return typeof (target as Partial<TestUser>).userId === "string";
}

export function expectOk<T>(result: ActionResult<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success but got "${result.error.code}": ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

export function expectFailure(result: ActionResult<unknown>, code: ActionErrorCode): ActionError {
  if (result.ok) {
    throw new Error(`Expected "${code}" but the action succeeded.`);
  }
  expect(result.error.code).toBe(code);
  return result.error;
}

/** Matches the error thrown by next/navigation redirect(). */
export function redirectError() {
  return { digest: expect.stringContaining("NEXT_REDIRECT") };
}

interface UntypedRpcClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { code: string; hint?: string | null } | null }>;
}

/** Calls a function name that is intentionally absent from the generated types. */
export function callUntypedRpc(client: TypedSupabaseClient, fn: string, args?: Record<string, unknown>) {
  return (client as unknown as UntypedRpcClient).rpc(fn, args);
}
