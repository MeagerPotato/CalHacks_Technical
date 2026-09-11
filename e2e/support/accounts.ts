import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client, type QueryResultRow } from "pg";

import type { ApplicationType, PublicAccountRole } from "@/lib/domain/enums";
import type { Database, Json } from "@/types/database";

import { E2E_EMAIL_DOMAIN, e2eEnvironment } from "./env";

export interface E2EUser {
  email: string;
  password: string;
  userId: string;
  /** Signed-in publishable-key client. Its writes go through RLS exactly like the app's. */
  client: SupabaseClient<Database>;
}

export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 12)}@${E2E_EMAIL_DOMAIN}`.toLowerCase();
}

/** Random per-account password; E2E accounts are deleted after the run. */
export function newPassword(): string {
  return `pw-${randomUUID()}`;
}

function createDataClient(): SupabaseClient<Database> {
  const { supabaseUrl, publishableKey } = e2eEnvironment();
  return createClient<Database>(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Creates an account through Supabase Auth with the publishable key, skipping the signup UI. `types` applies for
 * several applications at once; `role` is the single-type shorthand.
 */
export async function createAccount(
  label: string,
  options: { role?: PublicAccountRole; types?: readonly ApplicationType[]; displayName?: string } = {},
): Promise<E2EUser> {
  const client = createDataClient();
  const email = uniqueEmail(label);
  const password = newPassword();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        ...(options.types ? { application_types: options.types } : {}),
        ...(options.role ? { account_role: options.role } : {}),
        ...(options.displayName ? { display_name: options.displayName } : {}),
      },
    },
  });
  if (error || !data.user || !data.session) {
    throw new Error(`E2E signup failed: ${error ? error.code : "no session returned"}`);
  }
  return { email, password, userId: data.user.id, client };
}

/** Signs in an account that was created through the UI, for Data API setup. */
export async function signInDataClient(email: string, password: string): Promise<E2EUser> {
  const client = createDataClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`E2E sign-in failed: ${error ? error.code : "no user returned"}`);
  }
  return { email, password, userId: data.user.id, client };
}

/** Runs SQL as the local `postgres` role, for test setup and verification only (never app code). */
export async function queryRows<R extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<R[]> {
  const db = new Client({ connectionString: e2eEnvironment().databaseUrl });
  await db.connect();
  try {
    return (await db.query<R>(sql, values)).rows;
  } finally {
    await db.end();
  }
}

/** Creates an Organizer the only supported way: a normal account promoted by admin SQL. */
export async function createOrganizer(label = "organizer"): Promise<E2EUser> {
  const user = await createAccount(label);
  await queryRows("select private.promote_to_organizer($1)", [user.email]);
  return user;
}

/** Creates the applicant's application through the Data API with the given answers. */
export async function seedApplication(
  user: E2EUser,
  type: ApplicationType,
  responses: Record<string, unknown>,
  options: { submit?: boolean } = {},
): Promise<string> {
  const { data, error } = await user.client
    .from("applications")
    .insert({ user_id: user.userId, application_type: type, responses: responses as Json })
    .select("id")
    .single();
  if (error) {
    throw new Error(`E2E application insert failed: ${error.code} ${error.message}`);
  }
  if (options.submit) {
    await submitViaApi(user, data.id);
  }
  return data.id;
}

/** Looks up the applicant's own application id; pass the type when the account holds both applications. */
export async function findApplicationId(user: E2EUser, type?: ApplicationType): Promise<string> {
  const mine = user.client.from("applications").select("id").eq("user_id", user.userId);
  const { data, error } = await (type ? mine.eq("application_type", type) : mine).single();
  if (error) {
    throw new Error(`E2E application lookup failed: ${error.code} ${error.message}`);
  }
  return data.id;
}

/** Replaces a draft's saved answers through the Data API as its owner. */
export async function setDraftResponses(
  user: E2EUser,
  applicationId: string,
  responses: Record<string, unknown>,
): Promise<void> {
  const { error } = await user.client
    .from("applications")
    .update({ responses: responses as Json })
    .eq("id", applicationId);
  if (error) {
    throw new Error(`E2E response update failed: ${error.code} ${error.message}`);
  }
}

/** Submits through the Data API as the owner; the database sets launched_at. */
export async function submitViaApi(user: E2EUser, applicationId: string): Promise<void> {
  const { error } = await user.client.from("applications").update({ status: "submitted" }).eq("id", applicationId);
  if (error) {
    throw new Error(`E2E submit failed: ${error.code} ${error.message}`);
  }
}
