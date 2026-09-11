import type { ApplicationStatus, ApplicationType, DecisionStatus } from "@/lib/domain/enums";
import type { MissionLeg, MissionLegState, MissionStage } from "@/lib/domain/mission";
import type { SectionCompletionStatus } from "@/lib/validation/completion";

// =============================================================================
// Display-ready view models shared by app/ containers, lib/view-models builders, and components/ views.
//
// Views import these as types only. Every string is final display text (copy already resolved), every href is
// already built, and every timestamp is already formatted on the server, so views never import logic modules.
// =============================================================================

/**
 * A server-formatted instant or calendar day. `iso` feeds `<time dateTime>`: a UTC instant, or YYYY-MM-DD for a value
 * shown as a date. `label` is the display text in the event time zone.
 */
export interface TimestampView {
  iso: string;
  label: string;
}

/** A link with resolved display text. */
export interface LinkView {
  label: string;
  href: string;
}

export type ReadinessState = SectionCompletionStatus;

/** One Launch Readiness checklist item (one application section). */
export interface ReadinessItemView {
  id: string;
  label: string;
  state: ReadinessState;
  stateLabel: string;
  /** The section the applicant is on, or the next incomplete section outside the editor. */
  isCurrent: boolean;
  /** Became complete on the most recent successful save; drives the one-time completion motion. */
  justCompleted: boolean;
  needsAttention: boolean;
  progressText: string;
  href: string;
}

/** One editor navigation entry: a section, or the final review step. */
export interface SectionNavItemView {
  step: string;
  label: string;
  state: ReadinessState | "review";
  stateLabel: string;
  isActive: boolean;
  needsAttention: boolean;
  justCompleted: boolean;
  href: string;
}

/** One answered (or unanswered) field on the review and submitted-application screens. */
export interface AnswerView {
  key: string;
  label: string;
  /** Option labels are already resolved; link lists are arrays. Null when unanswered. */
  value: string | string[] | null;
  /** Shown when `value` is null. */
  missingText: string | null;
  errors: string[];
}

export interface AnswerSectionView {
  id: string;
  label: string;
  /** Null when the application is no longer editable. */
  editLabel: string | null;
  editHref: string | null;
  answers: AnswerView[];
}

/** One error-summary entry linking to the field that needs attention. */
export interface SummaryItemView {
  key: string;
  label: string;
  message: string;
  href: string;
}

export type NoticeTone = "info" | "success" | "warning" | "error";

export type NoticeActionKind = "retry" | "reload" | "reload_latest" | "sign_in_new_tab" | "check_status" | "dismiss";

/** A notice action. Actions with an `href` render as links; the rest call the container's `onAction` handler. */
export interface NoticeActionView {
  kind: NoticeActionKind;
  label: string;
  href?: string;
}

export interface NoticeView {
  /** Stable identifier, usually a feedback code. Rendered as `data-testid="notice-<id>"`. */
  id: string;
  tone: NoticeTone;
  title: string;
  body: string | null;
  actions: NoticeActionView[];
}

export type SaveStatusState = "saved" | "saving" | "dirty" | "invalid" | "error" | "blocked";

export interface SaveStatusView {
  state: SaveStatusState;
  text: string;
}

/** One leg of the Rocket Mission Tracker. */
export interface MissionLegView {
  leg: MissionLeg;
  name: string;
  state: MissionLegState;
  stateLabel: string;
  /** Status detail for this leg, such as its plan status label or the pending-decision note. */
  detail: string | null;
  time: TimestampView | null;
  timePrefix: string | null;
}

/** A released Accepted or Waitlisted decision. */
export interface DecisionView {
  status: DecisionStatus;
  label: string;
  message: string;
  releasedAt: TimestampView | null;
}

/** The Rocket Mission Tracker for a submitted application. Never contains percentages or estimated times. */
export interface MissionView {
  stage: MissionStage;
  status: ApplicationStatus;
  statusLabel: string;
  /** Rendered as the page `h1`. */
  headline: string;
  legs: [MissionLegView, MissionLegView, MissionLegView];
  /** Present only after a decision is released. */
  decision: DecisionView | null;
  reviewNote: string | null;
}

/** One application in the portal's application switcher. */
export interface ApplicationSwitcherItemView {
  type: ApplicationType;
  label: string;
  href: string;
  /** The application this page shows. */
  isCurrent: boolean;
}

/** Links between an applicant's Hacker and Judge dashboards. Present only when they hold both applications. */
export interface ApplicationSwitcherView {
  /** Accessible name of the switcher's navigation landmark. */
  label: string;
  /** In form order: Hacker, then Judge. */
  items: ApplicationSwitcherItemView[];
}

export interface PortalWelcomeView {
  greeting: string;
  typeLabel: string;
  reference: string;
  /** Null when the applicant holds one application; the type badge shows instead. */
  switcher: ApplicationSwitcherView | null;
}

export interface PortalProgressView {
  percent: number;
  valueText: string;
  nextStep: LinkView | null;
  /** Null until the first save. */
  lastSaved: TimestampView | null;
  cta: LinkView;
}

/** Portal dashboard for an editable draft. */
export interface PortalDraftView {
  kind: "draft";
  welcome: PortalWelcomeView;
  progress: PortalProgressView;
  /** Null while the deadline is to be announced. */
  deadline: TimestampView | null;
  readiness: ReadinessItemView[];
}

/** Portal dashboard once the application has launched. */
export interface PortalSubmittedView {
  kind: "submitted";
  welcome: PortalWelcomeView;
  status: ApplicationStatus;
  statusLabel: string;
  launched: TimestampView | null;
  deadline: TimestampView | null;
  trackHref: string;
  viewHref: string;
}

export type PortalView = PortalDraftView | PortalSubmittedView;

export type TimelineStopId = "applicationsOpen" | "applicationDeadline" | "resultsReleased" | "event";

/** `active` is a stop in progress: applications while they are open, or the event while it runs. */
export type TimelineStopState = "complete" | "active" | "upcoming";

/** One milestone on the landing page's mission timeline. */
export interface TimelineStopView {
  id: TimelineStopId;
  name: string;
  state: TimelineStopState;
  /** The state as text; the current upcoming stop reads as up next. */
  stateLabel: string;
  /** The stop in progress, or the next stop when none is. At most one stop is current; none after the event. */
  isCurrent: boolean;
  /** Its date (or date and time), or null when `whenText` stands in. */
  when: TimestampView | null;
  /** "Open now" or "To be announced" when there is no date; null when `when` is set or there is nothing to show. */
  whenText: string | null;
}

/** The event schedule in order: applications open, application deadline, results released, event dates. */
export interface TimelineView {
  title: string;
  stops: TimelineStopView[];
}

/** `launch` counts down to the application deadline; `landing` counts down to the start of the event. */
export type CountdownId = "launch" | "landing";

/** The fixed parts of one countdown, built on the server. */
export interface CountdownTimerView {
  id: CountdownId;
  title: string;
  /** Text before the target, for example "Applications due". */
  caption: string;
  /** The target as displayed: a date and time for the deadline, a date for the event. */
  target: TimestampView;
  /** The UTC instant the countdown reaches zero. */
  endsAt: string;
  /** Shown instead of the reading once the target has passed. */
  completeText: string;
}

/** The countdown panel on the landing page and the portal. Null from the builder when no countdown has a date. */
export interface CountdownsView {
  title: string;
  /** Label of the pause toggle. It stays the same; `aria-pressed` reports the state. */
  pauseLabel: string;
  /** The server clock (epoch milliseconds) when the page rendered. The server render and hydration read from it. */
  renderedAt: number;
  timers: CountdownTimerView[];
}

export type CountdownUnit = "days" | "hours" | "minutes" | "seconds";

export interface CountdownUnitView {
  unit: CountdownUnit;
  /** Days as a plain number; hours, minutes, and seconds as two digits. */
  value: string;
  label: string;
}

/** One countdown's reading at a moment, recomputed every second in the browser. */
export interface CountdownReadingView {
  id: CountdownId;
  state: "counting" | "complete";
  /** Days, hours, minutes, and seconds while counting; empty once complete. */
  units: CountdownUnitView[];
  /** The time left to the minute for assistive technology, or the complete text. */
  summary: string;
}

/** Resolved label and helper text for one application field. */
export interface FieldCopyView {
  label: string;
  /** Generated from the form config (ranges, limits, formats); not editable copy. */
  hint: string | null;
  /** Optional help prose from `FIELD_COPY`. */
  help: string | null;
  /** "(optional)" for optional fields, otherwise null. */
  optionalText: string | null;
}
