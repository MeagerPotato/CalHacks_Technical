import type { ReviewAccess } from "@/lib/data/types";
import type { ApplicationStatus, ApplicationType, DecisionStatus, Recommendation } from "@/lib/domain/enums";
import type { AnswerSectionView, LinkView, NoticeView, TimestampView } from "@/lib/view-models/types";

// =============================================================================
// Display-ready view models for the organizer pages (Phase 3).
//
// Views in components/organizer import these as types only. Every string is final display text, every href is built,
// and every timestamp is formatted on the server, the same contract as lib/view-models/types.ts.
// =============================================================================

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** `aria-current` for a navigation entry: the page itself, a page inside its section, or neither. */
export type NavCurrent = "page" | "true" | null;

export interface OrganizerNavItemView {
  id: "dashboard" | "applications";
  label: string;
  href: string;
  current: NavCurrent;
}

/** Review queue totals as a progress meter. Never an estimate: only counts from the database. */
export interface QueueProgressView {
  label: string;
  /** Reviewed share of submitted applications, 0-100. */
  percent: number;
  valueText: string;
  remainingText: string;
}

/** Review progress of one listed application. Kebab-case so it can style through data attributes. */
export type RowReviewState = "complete" | "in-progress" | "none";

/** One application in the applications table, its stacked card, or the recent submissions list. */
export interface ApplicationRowView {
  id: string;
  /** Blind reference such as "H-1042". */
  reference: string;
  /** Link text that names the application without identifying the applicant, such as "Applicant H-1042". */
  referenceLabel: string;
  href: string;
  name: string;
  email: string;
  affiliation: string | null;
  type: ApplicationType;
  typeLabel: string;
  status: ApplicationStatus;
  statusLabel: string;
  submitted: TimestampView | null;
  /** Shown instead of `submitted` when it is null. */
  submittedFallback: string;
  /** Formatted overall score, or the not-scored text. */
  scoreText: string;
  reviewState: RowReviewState;
  reviewStateLabel: string;
  recommendationLabel: string | null;
}

/** A heading and body for an empty, no-results, or informational state. */
export interface MessageView {
  title: string;
  body: string;
  action: LinkView | null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type KpiId = "submitted" | "needs-review" | "reviews-complete" | "decisions-made";

export interface KpiView {
  id: KpiId;
  label: string;
  value: string;
}

export interface BreakdownRowView {
  status: ApplicationStatus;
  label: string;
  count: number;
  /** For example "3 of 7". */
  countText: string;
  /** Share of the type's total, 0-100; drives the bar width only. */
  percent: number;
}

export interface BreakdownTypeView {
  type: ApplicationType;
  label: string;
  totalText: string;
  rows: BreakdownRowView[];
}

/** One radar spoke: an expertise category in `JUDGE_EXPERTISE_OPTIONS` order. */
export interface RadarAxisView {
  key: string;
  label: string;
  count: number;
  /** `count` divided by the largest count (0 when every count is 0), so the busiest spoke reaches the rim. */
  fraction: number;
}

export interface ExpertiseRadarView {
  title: string;
  intro: string;
  /** Accessible name of the chart (`role="img"`). */
  imageLabel: string;
  tableCaption: string;
  columns: { area: string; judges: string };
  axes: RadarAxisView[];
  gap: {
    title: string;
    body: string;
    /** Labels of categories with no submitted Judge, in radar order. */
    items: string[];
  };
}

export interface DashboardView {
  heading: string;
  intro: string;
  /** Shown above the numbers while there are no applications at all. */
  empty: MessageView | null;
  kpisTitle: string;
  kpis: KpiView[];
  queue: {
    title: string;
    progress: QueueProgressView;
    /** Opens the next unreviewed application; null when the queue is empty. */
    startReviewing: LinkView | null;
    emptyText: string | null;
  };
  breakdown: { title: string; types: BreakdownTypeView[] };
  radar: ExpertiseRadarView;
  recent: {
    title: string;
    rows: ApplicationRowView[];
    emptyText: string | null;
    viewAll: LinkView;
  };
}

// ---------------------------------------------------------------------------
// Applications table
// ---------------------------------------------------------------------------

export interface SelectOptionView {
  value: string;
  label: string;
}

export interface FilterSelectView {
  id: string;
  name: string;
  label: string;
  /** Selected option value ("" for the "all" option). */
  value: string;
  options: SelectOptionView[];
}

export interface ApplicationFiltersView {
  title: string;
  /** GET form action; the fields serialize to the same query string the page parses. */
  action: string;
  search: { id: string; name: string; label: string; hint: string; value: string };
  selects: FilterSelectView[];
  /** Non-default values that have no visible control, such as `pageSize`. */
  hidden: { name: string; value: string }[];
  submitLabel: string;
  /** Present while any filter is active. */
  clear: LinkView | null;
}

export type SortDirection = "ascending" | "descending";

export type ApplicationColumnKey = "applicant" | "reference" | "type" | "status" | "submitted" | "score" | "review";

export interface TableColumnView {
  key: ApplicationColumnKey;
  label: string;
  /** Sortable columns link to their next sort order. */
  sort: {
    /** Current direction when the table is sorted by this column, else null. */
    direction: SortDirection | null;
    href: string;
    /** Visually hidden text after the label describing the order the link applies. */
    actionText: string;
  } | null;
}

export type ApplicationsResultState = "results" | "empty" | "no-results" | "past-end";

export interface PaginationView {
  label: string;
  statusText: string;
  previous: LinkView | null;
  next: LinkView | null;
}

export interface ApplicationsResultsView {
  state: ApplicationsResultState;
  /** For example "12 applications"; also announced after the filters change. */
  countText: string;
  rangeText: string | null;
  caption: string;
  columns: TableColumnView[];
  rows: ApplicationRowView[];
  /** Labels for the stacked cards shown on narrow screens. */
  cardLabels: { email: string; affiliation: string };
  message: MessageView | null;
  pagination: PaginationView | null;
}

export interface ApplicationsPageView {
  heading: string;
  intro: string;
  filters: ApplicationFiltersView;
  results: ApplicationsResultsView;
}

// ---------------------------------------------------------------------------
// Review workspace
// ---------------------------------------------------------------------------

export interface IdentityFieldView {
  key: "name" | "email" | "birthdate" | "countryOfResidence" | "cityOfResidence" | "affiliation" | "links";
  label: string;
  text: string | null;
  links: LinkView[];
}

export interface IdentityView {
  title: string;
  fields: IdentityFieldView[];
  missingText: string;
}

export interface ScoreOptionView {
  value: string;
  label: string;
  /** Short anchor text shown for the lowest, middle, and highest scores. */
  anchor: string | null;
}

export interface RubricDimensionView {
  key: string;
  label: string;
  /** Id of the first radio; error-summary links point here. */
  controlId: string;
  name: string;
  options: ScoreOptionView[];
}

/** Inline scorecard errors: messages per rubric dimension key, for the recommendation, and for the notes. */
export interface ScorecardErrors {
  scores: Record<string, string[]>;
  recommendation: string[];
  notes: string[];
}

/** The scorecard's form values. A null score is unscored; "" is no recommendation. */
export interface ScorecardValues {
  scores: Record<string, number | null>;
  notes: string;
  recommendation: Recommendation | "";
}

export interface ScorecardView {
  title: string;
  access: ReviewAccess;
  hint: string;
  dimensions: RubricDimensionView[];
  recommendation: {
    id: string;
    name: string;
    label: string;
    hint: string;
    options: SelectOptionView[];
  };
  notes: { id: string; label: string; hint: string; maxLength: number };
  maxScore: number;
  initialValues: ScorecardValues;
  isCompleted: boolean;
  /** Last saved time of the review shown, with its prefix; null before the first save. */
  saved: { prefix: string; time: TimestampView } | null;
  notSavedText: string;
  overall: { label: string; pendingText: string };
  actions: { saveDraft: string; saveReview: string; saveAndContinue: string };
  errorSummaryTitle: string;
  readOnly: { noScore: string; noRecommendation: string; noNotes: string };
}

export type DecisionReleaseState = "available" | "unavailable" | "released";

export interface DecisionReleaseView {
  state: DecisionReleaseState;
  title: string;
  intro: string;
  legend: string;
  options: { value: DecisionStatus; label: string }[];
  releaseLabel: string;
  confirmTitles: Record<DecisionStatus, string>;
  confirmBody: string;
  confirmLabel: string;
  cancelLabel: string;
  unavailableText: string | null;
  released: { status: DecisionStatus; text: string; time: TimestampView | null; timePrefix: string } | null;
}

export interface WorkspaceHeaderView {
  heading: string;
  typeLabel: string;
  status: ApplicationStatus;
  statusLabel: string;
  submitted: TimestampView | null;
  submittedPrefix: string;
  notSubmittedText: string;
  back: LinkView;
  next: LinkView | null;
  queue: QueueProgressView;
}

export interface BlindModeView {
  isBlind: boolean;
  statusText: string;
  toggleLabel: string;
  /** The same workspace with identity revealed or hidden. */
  toggleHref: string;
}

export interface ReviewWorkspaceView {
  applicationId: string;
  type: ApplicationType;
  reference: string;
  header: WorkspaceHeaderView;
  blind: BlindModeView;
  /** Present only when identity was explicitly revealed. */
  identity: IdentityView | null;
  narrative: { title: string; sections: AnswerSectionView[] };
  scorecard: ScorecardView;
  /** Null for drafts, which can have no decision. */
  decision: DecisionReleaseView | null;
  /** Page notices built on the server: review access, completion, and arrival after Save review and continue. */
  notices: NoticeView[];
}
