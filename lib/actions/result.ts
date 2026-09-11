import type { FieldErrors } from "@/lib/validation/errors";

/**
 * Stable error codes returned by every Server Action. The frontend maps codes to copy;
 * `message` is a neutral default that never contains internal details.
 */
export type ActionErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "rate_limited"
  // auth
  | "email_taken"
  | "weak_password"
  | "invalid_credentials"
  | "email_not_confirmed"
  // applications
  | "application_type_mismatch"
  | "application_locked"
  | "application_incomplete"
  | "invalid_status_transition"
  // reviews and decisions
  | "review_owned_by_another_organizer"
  | "review_locked"
  | "review_already_completed"
  | "review_not_completed"
  | "unexpected_error";

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  /** Per-field validation messages keyed by field path (e.g. "bio", "scores.growth"). */
  fieldErrors?: FieldErrors;
  /** Validation messages not tied to a single field. */
  formErrors?: string[];
}

export type ActionSuccess<T> = { ok: true; data: T };
export type ActionFailure = { ok: false; error: ActionError };
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export const ACTION_ERROR_MESSAGES: Record<ActionErrorCode, string> = {
  unauthenticated: "Sign in to continue.",
  forbidden: "You do not have permission to do that.",
  not_found: "We could not find that record.",
  validation_failed: "Some fields need attention.",
  conflict: "This record changed or already exists. Refresh and try again.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
  email_taken: "An account with this email already exists.",
  weak_password: "Choose a stronger password.",
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Confirm your email address before signing in.",
  application_type_mismatch: "This application type does not match your account.",
  application_locked: "Submitted applications can no longer be edited.",
  application_incomplete: "Complete every required field before submitting.",
  invalid_status_transition: "That status change is not allowed.",
  review_owned_by_another_organizer: "Another organizer is already reviewing this application.",
  review_locked: "Reviews cannot be changed after a decision is released.",
  review_already_completed: "This review is already complete.",
  review_not_completed: "Complete the review before releasing a decision.",
  unexpected_error: "Something went wrong. Try again.",
};

export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function fail(
  code: ActionErrorCode,
  details: Partial<Omit<ActionError, "code">> = {},
): ActionFailure {
  return {
    ok: false,
    error: {
      code,
      message: details.message ?? ACTION_ERROR_MESSAGES[code],
      ...(details.fieldErrors && Object.keys(details.fieldErrors).length > 0
        ? { fieldErrors: details.fieldErrors }
        : {}),
      ...(details.formErrors && details.formErrors.length > 0 ? { formErrors: details.formErrors } : {}),
    },
  };
}
