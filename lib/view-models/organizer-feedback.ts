import { COPY, ORGANIZER_COPY } from "@/content/copy";
import type { ActionErrorCode } from "@/lib/actions/result";
import { ROUTES } from "@/lib/routes";
import type { NoticeActionKind, NoticeActionView, NoticeTone, NoticeView } from "@/lib/view-models/types";

// =============================================================================
// Failure notices for the organizer review workspace (client-safe, pure).
//
// The applicant editor's `noticeForError` shows generic copy for review and decision codes, so the organizer pages map
// every action error code to organizer copy here. Server `message` text is never shown.
// =============================================================================

/** Every failure the review workspace can surface: action error codes plus failures detected in the browser. */
export type OrganizerFeedbackCode = ActionErrorCode | "network" | "stale_deployment";

type OrganizerNoticeCopyKey = keyof typeof ORGANIZER_COPY.notices;

interface NoticeSpec {
  readonly copy: OrganizerNoticeCopyKey;
  readonly tone: NoticeTone;
  readonly actions: readonly NoticeActionKind[];
}

const UNEXPECTED: NoticeSpec = { copy: "unexpected_error", tone: "error", actions: ["retry"] };
const REFRESH: readonly NoticeActionKind[] = ["reload_latest"];

// Keyed by every code, so a new action error code fails typecheck until it is mapped here.
const NOTICE_SPECS = {
  unauthenticated: { copy: "unauthenticated", tone: "warning", actions: ["sign_in_new_tab", "retry"] },
  forbidden: { copy: "forbidden", tone: "error", actions: ["reload"] },
  not_found: { copy: "not_found", tone: "error", actions: ["reload"] },
  // The error summary lists the answers; the notice only confirms nothing was saved.
  validation_failed: { copy: "validation_failed", tone: "error", actions: [] },
  conflict: { copy: "conflict", tone: "warning", actions: ["retry", "reload_latest"] },
  rate_limited: { copy: "rate_limited", tone: "error", actions: ["retry"] },
  // Auth and applicant codes cannot come from the review actions.
  email_taken: UNEXPECTED,
  weak_password: UNEXPECTED,
  invalid_credentials: UNEXPECTED,
  email_not_confirmed: UNEXPECTED,
  application_type_mismatch: UNEXPECTED,
  application_locked: UNEXPECTED,
  application_incomplete: UNEXPECTED,
  invalid_status_transition: { copy: "invalid_status_transition", tone: "warning", actions: REFRESH },
  review_owned_by_another_organizer: { copy: "review_owned_by_another_organizer", tone: "warning", actions: REFRESH },
  review_locked: { copy: "review_locked", tone: "info", actions: REFRESH },
  review_already_completed: { copy: "review_already_completed", tone: "info", actions: REFRESH },
  review_not_completed: { copy: "review_not_completed", tone: "warning", actions: REFRESH },
  unexpected_error: UNEXPECTED,
  network: { copy: "network", tone: "warning", actions: ["retry"] },
  stale_deployment: { copy: "stale_deployment", tone: "warning", actions: ["reload"] },
} as const satisfies Record<OrganizerFeedbackCode, NoticeSpec>;

const ACTION_LABELS = {
  retry: COPY.notices.actions.retry,
  reload: COPY.notices.actions.reload,
  reload_latest: COPY.notices.actions.reloadLatest,
  sign_in_new_tab: COPY.notices.actions.signInNewTab,
  check_status: COPY.notices.actions.checkStatus,
  dismiss: COPY.notices.actions.dismiss,
} as const satisfies Record<NoticeActionKind, string>;

function buildActions(kinds: readonly NoticeActionKind[], signInHref: string): NoticeActionView[] {
  return kinds.map((kind) =>
    kind === "sign_in_new_tab" ? { kind, label: ACTION_LABELS[kind], href: signInHref } : { kind, label: ACTION_LABELS[kind] },
  );
}

/**
 * The organizer notice for a failed review save, identity toggle, or decision release. Unknown runtime codes use the
 * `unexpected_error` copy and id. Action kinds: `retry` repeats the failed action, `reload_latest` refreshes the page
 * data, `reload` reloads the document, and `sign_in_new_tab` links to `options.signInHref` (default: the login page).
 * Returns a new object on every call.
 */
export function organizerNoticeFor(code: OrganizerFeedbackCode, options: { signInHref?: string } = {}): NoticeView {
  const known = Object.prototype.hasOwnProperty.call(NOTICE_SPECS, code);
  const spec: NoticeSpec = known ? NOTICE_SPECS[code] : UNEXPECTED;
  const copy = ORGANIZER_COPY.notices[spec.copy];
  return {
    // The id names the copy, so codes that share the unexpected error notice share its id.
    id: spec.copy,
    tone: spec.tone,
    title: copy.title,
    body: copy.body,
    actions: buildActions(spec.actions, options.signInHref ?? ROUTES.login),
  };
}

/** A sign-in link that returns to `path` after signing in (opened in a new tab by the notice). */
export function organizerSignInHref(path: string): string {
  return `${ROUTES.login}?next=${encodeURIComponent(path)}`;
}

/** The success notice shown when Save review and continue finds no other application needing review. */
export function queueDoneNotice(): NoticeView {
  const { title, body } = ORGANIZER_COPY.workspace.queueDone;
  return { id: "queue-done", tone: "success", title, body, actions: [] };
}
