import { COPY } from "@/content/copy";
import { ACTION_ERROR_MESSAGES, type ActionError, type ActionErrorCode } from "@/lib/actions/result";
import { APPLICATION_FORMS } from "@/lib/application-config";
import type { ApplicationType } from "@/lib/domain/enums";
import { fieldControlId } from "@/lib/editor/steps";
import { ROUTES } from "@/lib/routes";
import type { FieldErrors } from "@/lib/validation/errors";
import { resolveFieldCopy } from "@/lib/view-models/fields";
import type {
  NoticeActionKind,
  NoticeActionView,
  NoticeTone,
  NoticeView,
  SummaryItemView,
} from "@/lib/view-models/types";

// =============================================================================
// Failure feedback for the editor and the auth forms (client-safe, pure).
//
// Maps action error codes and client-side failures to display-ready notices and error-summary items. Copy comes from
// COPY.notices and COPY.authNotices; server `message` text is never shown in a notice.
// =============================================================================

/** Every failure the editor can surface: action error codes plus failures detected in the browser. */
export type FeedbackCode = ActionErrorCode | "network" | "stale_deployment" | "unconfirmed_submit";

/** Codes with auth-form notice copy in `COPY.authNotices`. */
export type AuthNoticeCode = keyof typeof COPY.authNotices;

/** Inline errors, their summary, and an optional form-level notice for an auth or onboarding form. */
export interface AuthFeedback {
  fieldErrors: FieldErrors;
  summary: SummaryItemView[];
  notice: NoticeView | null;
}

type NoticeCopyKey = Exclude<keyof typeof COPY.notices, "actions">;

interface NoticeSpec {
  readonly copy: NoticeCopyKey;
  readonly tone: NoticeTone;
  readonly actions: readonly NoticeActionKind[];
}

const UNEXPECTED_NOTICE: NoticeSpec = { copy: "unexpected_error", tone: "error", actions: ["retry"] };

// Keyed by every FeedbackCode, so a new action error code fails typecheck until it is mapped here.
const NOTICE_SPECS = {
  unauthenticated: { copy: "unauthenticated", tone: "warning", actions: ["sign_in_new_tab", "retry"] },
  forbidden: { copy: "forbidden", tone: "error", actions: ["reload"] },
  not_found: { copy: "not_found", tone: "error", actions: ["reload"] },
  validation_failed: { copy: "validation_failed", tone: "error", actions: ["retry"] },
  conflict: { copy: "conflict", tone: "warning", actions: ["retry", "reload_latest"] },
  rate_limited: { copy: "rate_limited", tone: "error", actions: ["retry"] },
  // Auth codes belong to toAuthFeedback; the editor never expects them.
  email_taken: UNEXPECTED_NOTICE,
  weak_password: UNEXPECTED_NOTICE,
  invalid_credentials: UNEXPECTED_NOTICE,
  email_not_confirmed: UNEXPECTED_NOTICE,
  application_type_mismatch: UNEXPECTED_NOTICE,
  application_locked: { copy: "application_locked", tone: "info", actions: [] },
  // The error summary explains an incomplete application, so no notice is shown.
  application_incomplete: null,
  // Organizer and review codes cannot happen in the applicant product.
  invalid_status_transition: UNEXPECTED_NOTICE,
  review_owned_by_another_organizer: UNEXPECTED_NOTICE,
  review_locked: UNEXPECTED_NOTICE,
  review_already_completed: UNEXPECTED_NOTICE,
  review_not_completed: UNEXPECTED_NOTICE,
  unexpected_error: UNEXPECTED_NOTICE,
  network: { copy: "network", tone: "warning", actions: ["retry"] },
  stale_deployment: { copy: "stale_deployment", tone: "warning", actions: ["reload"] },
  unconfirmed_submit: { copy: "unconfirmed_submit", tone: "warning", actions: ["check_status"] },
} as const satisfies Record<FeedbackCode, NoticeSpec | null>;

const AUTH_NOTICE_SPECS = {
  invalid_credentials: { tone: "error", actions: [] },
  email_not_confirmed: { tone: "warning", actions: [] },
  rate_limited: { tone: "error", actions: ["retry"] },
  forbidden: { tone: "error", actions: [] },
  unexpected_error: { tone: "error", actions: ["retry"] },
  network: { tone: "warning", actions: ["retry"] },
  validation_failed: { tone: "error", actions: [] },
} as const satisfies Record<AuthNoticeCode, Omit<NoticeSpec, "copy">>;

const ACTION_LABELS = {
  retry: COPY.notices.actions.retry,
  reload: COPY.notices.actions.reload,
  reload_latest: COPY.notices.actions.reloadLatest,
  sign_in_new_tab: COPY.notices.actions.signInNewTab,
  check_status: COPY.notices.actions.checkStatus,
  dismiss: COPY.notices.actions.dismiss,
} as const satisfies Record<NoticeActionKind, string>;

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function buildActions(kinds: readonly NoticeActionKind[], signInHref: string): NoticeActionView[] {
  return kinds.map((kind) =>
    kind === "sign_in_new_tab"
      ? { kind, label: ACTION_LABELS[kind], href: signInHref }
      : { kind, label: ACTION_LABELS[kind] },
  );
}

/** Non-empty string messages for one key, copied. Own properties only. */
function ownMessages(fieldErrors: FieldErrors, key: string): string[] {
  const messages: unknown = hasOwn(fieldErrors, key) ? fieldErrors[key] : undefined;
  return Array.isArray(messages)
    ? messages.filter((message): message is string => typeof message === "string" && message !== "")
    : [];
}

/**
 * The editor notice for a failure, or null for `application_incomplete` (the error summary covers it). Organizer,
 * review, and auth codes use the `unexpected_error` copy and tone, as does any unknown runtime code. The sign-in
 * action links to `options.signInHref`, defaulting to the login page. Returns a new object on every call.
 */
export function noticeForError(code: FeedbackCode, options?: { signInHref?: string }): NoticeView | null {
  const known = hasOwn(NOTICE_SPECS, code);
  const spec: NoticeSpec | null = known ? NOTICE_SPECS[code] : UNEXPECTED_NOTICE;
  if (spec === null) {
    return null;
  }
  const copy = COPY.notices[spec.copy];
  return {
    id: known ? code : "unexpected_error",
    tone: spec.tone,
    title: copy.title,
    body: copy.body,
    actions: buildActions(spec.actions, options?.signInHref ?? ROUTES.login),
  };
}

/**
 * Error-summary items in form order, one per field with errors, using the field's first message and its resolved
 * label. Keys that are not fields of the form are skipped because they cannot link anywhere.
 */
export function toSummaryItems(
  type: ApplicationType,
  fieldErrors: FieldErrors,
  hrefFor: (key: string) => string,
): SummaryItemView[] {
  const items: SummaryItemView[] = [];
  for (const section of APPLICATION_FORMS[type].sections) {
    for (const field of section.fields) {
      const [message] = ownMessages(fieldErrors, field.key);
      if (message !== undefined) {
        items.push({ key: field.key, label: resolveFieldCopy(type, field).label, message, href: hrefFor(field.key) });
      }
    }
  }
  return items;
}

/** An auth or onboarding form notice using `COPY.authNotices`. `id` defaults to the code. Returns a new object. */
export function authNoticeFor(code: AuthNoticeCode, id?: string): NoticeView {
  const spec = AUTH_NOTICE_SPECS[code];
  const copy = COPY.authNotices[code];
  return {
    id: id ?? code,
    tone: spec.tone,
    title: copy.title,
    body: copy.body,
    actions: buildActions(spec.actions, ROUTES.login),
  };
}

function toFieldFeedback(
  code: ActionErrorCode,
  source: unknown,
  formErrors: unknown,
  fields: readonly { key: string; label: string }[],
  hrefFor: (key: string) => string,
): AuthFeedback {
  const errors: FieldErrors = typeof source === "object" && source !== null ? (source as FieldErrors) : {};
  const fieldErrors: FieldErrors = {};
  const summary: SummaryItemView[] = [];

  for (const field of fields) {
    const messages = ownMessages(errors, field.key);
    if (messages.length > 0) {
      fieldErrors[field.key] = messages;
      summary.push({ key: field.key, label: field.label, message: messages[0], href: hrefFor(field.key) });
    }
  }

  const knownKeys = new Set(fields.map((field) => field.key));
  const hasUnplacedErrors =
    (Array.isArray(formErrors) && formErrors.length > 0) ||
    Object.keys(errors).some((key) => !knownKeys.has(key) && ownMessages(errors, key).length > 0);

  // With nothing to show inline, the user still needs to learn that the submission failed. Resending the same input
  // cannot succeed, so the notice explains the problem rather than offering a retry.
  const notice = hasUnplacedErrors || summary.length === 0 ? authNoticeFor("validation_failed", code) : null;

  return { fieldErrors, summary, notice };
}

/**
 * Maps an auth or onboarding action error to inline field errors, an error summary, and a form notice.
 * - `validation_failed`: messages for keys in `fields` become field errors and summary items (in `fields` order);
 *   unknown keys, form errors, or no details at all produce a notice.
 * - `email_taken` and `weak_password`: a field error on `email` or `password` with the ACTION_ERROR_MESSAGES text.
 * - `invalid_credentials`, `email_not_confirmed`, `rate_limited`, `forbidden`, `unexpected_error`: a notice with
 *   `COPY.authNotices` copy. Any other code uses the `unexpected_error` notice.
 * `hrefFor` defaults to `#field-<key>`.
 */
export function toAuthFeedback(
  error: ActionError,
  fields: readonly { key: string; label: string }[],
  hrefFor: (key: string) => string = (key) => `#${fieldControlId(key)}`,
): AuthFeedback {
  switch (error.code) {
    case "validation_failed":
      return toFieldFeedback(error.code, error.fieldErrors, error.formErrors, fields, hrefFor);
    case "email_taken":
      return toFieldFeedback(error.code, { email: [ACTION_ERROR_MESSAGES.email_taken] }, [], fields, hrefFor);
    case "weak_password":
      return toFieldFeedback(error.code, { password: [ACTION_ERROR_MESSAGES.weak_password] }, [], fields, hrefFor);
    case "invalid_credentials":
    case "email_not_confirmed":
    case "rate_limited":
    case "forbidden":
    case "unexpected_error":
      return { fieldErrors: {}, summary: [], notice: authNoticeFor(error.code) };
    default:
      return {
        fieldErrors: {},
        summary: [],
        notice: authNoticeFor("unexpected_error", hasOwn(ACTION_ERROR_MESSAGES, error.code) ? error.code : undefined),
      };
  }
}
