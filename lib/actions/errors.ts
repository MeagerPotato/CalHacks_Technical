import type { AuthError, PostgrestError } from "@supabase/supabase-js";

import { fail, type ActionErrorCode, type ActionFailure } from "@/lib/actions/result";

// Database guard triggers raise with a stable machine-readable HINT (see migrations).
const DATABASE_HINT_CODES: Record<string, ActionErrorCode> = {
  forbidden: "forbidden",
  not_found: "not_found",
  invalid_account_role: "forbidden",
  application_type_mismatch: "application_type_mismatch",
  role_application_mismatch: "forbidden",
  application_locked: "application_locked",
  invalid_status_transition: "invalid_status_transition",
  review_locked: "review_locked",
  review_already_completed: "review_already_completed",
  review_not_completed: "review_not_completed",
  review_incomplete: "validation_failed",
  invalid_rubric: "validation_failed",
  invalid_filter: "validation_failed",
};

export type DatabaseErrorLike = Pick<PostgrestError, "code" | "message"> &
  Partial<Pick<PostgrestError, "details" | "hint">>;

/** Logs internal error details on the server only. Never include responses or notes. */
export function logServerError(context: string, error: unknown): void {
  if (error && typeof error === "object") {
    const { code, status, hint, message } = error as Record<string, unknown>;
    console.error(`[launchpad] ${context}`, { code, status, hint, message });
  } else {
    console.error(`[launchpad] ${context}`, error);
  }
}

/** Maps a PostgREST/Postgres error to a stable action error without leaking internals. */
export function failFromDatabase(context: string, error: DatabaseErrorLike): ActionFailure {
  const hinted = error.hint ? DATABASE_HINT_CODES[error.hint] : undefined;
  if (hinted) {
    return fail(hinted);
  }

  logServerError(context, error);

  // Constraint names are stable; the rest of the message (and `details`) may contain row data.
  const message = error.message ?? "";
  if (message.includes("applications_submitted_responses_complete")) {
    return fail("application_incomplete");
  }
  if (message.includes("applications_status_timestamps") || message.includes("applications_timestamp_order")) {
    return fail("invalid_status_transition");
  }
  if (message.includes("reviews_one_per_application")) {
    return fail("review_owned_by_another_organizer");
  }

  switch (error.code) {
    case "42501": // insufficient_privilege or RLS violation
      return fail("forbidden");
    case "23505": // unique_violation
      return fail("conflict");
    case "23502": // not_null_violation
    case "23514": // check_violation
    case "22P02": // invalid_text_representation (e.g. bad uuid)
    case "22P05": // untranslatable_character (e.g. a NUL character in JSON text)
    case "22023": // invalid_parameter_value
      return fail("validation_failed");
    case "23503": // foreign_key_violation
    case "PGRST116": // .single() found no rows
      return fail("not_found");
    default:
      return fail("unexpected_error");
  }
}

/** Maps a Supabase Auth error to a stable action error. */
export function failFromAuth(context: string, error: Pick<AuthError, "message" | "status"> & { code?: string }): ActionFailure {
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return fail("email_taken");
    case "weak_password":
      return fail("weak_password");
    case "invalid_credentials":
      return fail("invalid_credentials");
    case "email_not_confirmed":
      return fail("email_not_confirmed");
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return fail("rate_limited");
    case "signup_disabled":
    case "email_provider_disabled":
      return fail("forbidden");
    default:
      break;
  }

  if (error.status === 429) {
    return fail("rate_limited");
  }

  logServerError(context, error);
  return fail("unexpected_error");
}
