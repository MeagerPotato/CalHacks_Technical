import type { DecisionReleaseStep } from "@/components/organizer/DecisionRelease";
import type { FieldCounter } from "@/components/ui/Field";
import { ORGANIZER_COPY } from "@/content/copy";
import { ACTION_ERROR_MESSAGES, type ActionErrorCode } from "@/lib/actions/result";
import type { ReviewWorkspace } from "@/lib/data/types";
import { ROUTES, organizerApplicationRoute } from "@/lib/routes";
import { toFieldErrors } from "@/lib/validation/errors";
import { REVIEW_SCHEMAS } from "@/lib/validation/review";
import { toApplicationsPageView } from "@/lib/view-models/organizer-applications";
import { toDashboardView } from "@/lib/view-models/organizer-dashboard";
import { organizerNoticeFor, queueDoneNotice, type OrganizerFeedbackCode } from "@/lib/view-models/organizer-feedback";
import { toReviewWorkspaceView } from "@/lib/view-models/organizer-review";
import { toOrganizerNavItems } from "@/lib/view-models/organizer-routes";
import {
  notesCounterText,
  overallScoreText,
  toReviewDraftPayload,
  toReviewErrorState,
} from "@/lib/view-models/organizer-scorecard";
import type {
  ApplicationsPageView,
  DashboardView,
  OrganizerNavItemView,
  ReviewWorkspaceView,
  ScorecardErrors,
  ScorecardValues,
} from "@/lib/view-models/organizer-types";
import type { NoticeView, SummaryItemView } from "@/lib/view-models/types";
import {
  OTHER_REVIEWER_ID,
  applicationListPage,
  draftReviewRecord,
  emptyOrganizerDashboard,
  fixtureApplicationId,
  organizerDashboard,
  reviewRecord,
  reviewWorkspace,
  sampleListItems,
} from "@/tests/fixtures/organizer";

// Organizer gallery fixtures. Every view model is built by the real pure functions from the shared organizer test
// fixtures, so the gallery shows what the organizer pages render. Never imported by product routes (lint-restricted).

export interface OrganizerGalleryVariant<T> {
  id: string;
  label: string;
  view: T;
}

export const navVariants: OrganizerGalleryVariant<OrganizerNavItemView[]>[] = [
  { id: "dashboard", label: "On the dashboard", view: toOrganizerNavItems(ROUTES.organizer) },
  { id: "applications", label: "On the applications table", view: toOrganizerNavItems(ROUTES.organizerApplications) },
  {
    id: "workspace",
    label: "In a review workspace",
    view: toOrganizerNavItems(organizerApplicationRoute(fixtureApplicationId(1))),
  },
];

export const dashboardVariants: OrganizerGalleryVariant<DashboardView>[] = [
  { id: "data", label: "With data", view: toDashboardView(organizerDashboard()) },
  {
    id: "queue-empty",
    label: "Nothing left to review",
    view: toDashboardView(
      organizerDashboard({
        nextUnreviewedApplicationId: null,
        queueProgress: { total: 7, reviewed: 7, remaining: 0 },
      }),
    ),
  },
  { id: "empty", label: "Empty", view: toDashboardView(emptyOrganizerDashboard()) },
];

const listItems = sampleListItems();

export const applicationsVariants: OrganizerGalleryVariant<ApplicationsPageView>[] = [
  {
    id: "results",
    label: "Results with pagination",
    view: toApplicationsPageView(applicationListPage(listItems, { page: 2, pageSize: 4 }, 12)),
  },
  {
    id: "filtered",
    label: "Filtered, sorted by score",
    view: toApplicationsPageView(
      applicationListPage(listItems.slice(0, 1), { search: "Example", type: "hacker", sort: "score_desc" }),
    ),
  },
  {
    id: "no-results",
    label: "No results",
    view: toApplicationsPageView(applicationListPage([], { search: "nobody", reviewState: "reviewed" })),
  },
  { id: "empty", label: "Empty", view: toApplicationsPageView(applicationListPage([])) },
  { id: "past-end", label: "Page past the end", view: toApplicationsPageView(applicationListPage([], { page: 9 }, 12)) },
];

/** A workspace view plus the client state the container would hold. */
export interface WorkspaceGalleryState {
  view: ReviewWorkspaceView;
  values: ScorecardValues;
  overallText: string;
  notesCounter: FieldCounter;
  errors?: ScorecardErrors;
  summaryItems: SummaryItemView[];
  decisionStep: DecisionReleaseStep;
  decisionChoice: string;
  decisionError: string | null;
  clientNotice: NoticeView | null;
}

interface WorkspaceStateOptions {
  reviewedReference?: string;
  values?: ScorecardValues;
  errors?: ScorecardErrors;
  summaryItems?: SummaryItemView[];
  decisionStep?: DecisionReleaseStep;
  decisionChoice?: string;
  decisionError?: string | null;
  clientNotice?: NoticeView | null;
}

function workspaceState(workspace: ReviewWorkspace, options: WorkspaceStateOptions = {}): WorkspaceGalleryState {
  const view = toReviewWorkspaceView(workspace, { reviewedReference: options.reviewedReference });
  const values = options.values ?? view.scorecard.initialValues;
  const { maxLength } = view.scorecard.notes;
  return {
    view,
    values,
    overallText: overallScoreText(view.type, values.scores),
    notesCounter: { current: values.notes.length, max: maxLength, text: notesCounterText(values.notes, maxLength) },
    errors: options.errors,
    summaryItems: options.summaryItems ?? [],
    decisionStep: options.decisionStep ?? "choose",
    decisionChoice: options.decisionChoice ?? "",
    decisionError: options.decisionError ?? null,
    clientNotice: options.clientNotice ?? null,
  };
}

function submissionErrors(): { errors: ScorecardErrors; summaryItems: SummaryItemView[] } {
  const blank = reviewWorkspace({ status: "submitted" });
  const view = toReviewWorkspaceView(blank);
  const parsed = REVIEW_SCHEMAS.hacker.submission.safeParse({
    ...toReviewDraftPayload("hacker", view.scorecard.initialValues),
    scores: {},
  });
  const state = toReviewErrorState("hacker", parsed.success ? undefined : toFieldErrors(parsed.error, 2));
  return { errors: state.errors, summaryItems: state.summary };
}

const completedHacker = reviewWorkspace({ review: reviewRecord("hacker") });

export const workspaceVariants: OrganizerGalleryVariant<WorkspaceGalleryState>[] = [
  { id: "blind", label: "Blind, not reviewed", view: workspaceState(reviewWorkspace({ status: "submitted" })) },
  {
    id: "revealed",
    label: "Identity revealed, draft review",
    view: workspaceState(reviewWorkspace({ revealIdentity: true, review: draftReviewRecord("hacker") })),
  },
  {
    id: "judge-revealed",
    label: "Judge, identity revealed",
    view: workspaceState(reviewWorkspace({ type: "judge", index: 2, revealIdentity: true })),
  },
  {
    id: "errors",
    label: "Save review with missing answers",
    view: workspaceState(reviewWorkspace({ status: "submitted" }), submissionErrors()),
  },
  {
    id: "arrival",
    label: "Arrived through Save review and continue",
    view: workspaceState(reviewWorkspace({ type: "judge", index: 2, status: "submitted" }), { reviewedReference: "H-1001" }),
  },
  { id: "completed", label: "Review complete, decision available", view: workspaceState(completedHacker) },
  {
    id: "choose-error",
    label: "Release decision without a choice",
    view: workspaceState(completedHacker, { decisionError: ORGANIZER_COPY.workspace.decision.chooseError }),
  },
  {
    id: "confirm",
    label: "Decision release confirmation",
    view: workspaceState(completedHacker, { decisionStep: "confirm", decisionChoice: "accepted" }),
  },
  {
    id: "queue-done",
    label: "Nothing left in the queue",
    view: workspaceState(reviewWorkspace({ review: reviewRecord("hacker"), nextUnreviewedApplicationId: null }), {
      clientNotice: queueDoneNotice(),
    }),
  },
  {
    id: "conflict",
    label: "Save failed with a conflict",
    view: workspaceState(reviewWorkspace({ review: draftReviewRecord("hacker") }), {
      clientNotice: organizerNoticeFor("conflict"),
    }),
  },
  {
    id: "owned",
    label: "Owned by another organizer",
    view: workspaceState(
      reviewWorkspace({ review: reviewRecord("hacker", { isMine: false, reviewerId: OTHER_REVIEWER_ID }) }),
    ),
  },
  { id: "not-submitted", label: "Locked: not submitted", view: workspaceState(reviewWorkspace({ status: "draft" })) },
  {
    id: "decided",
    label: "Locked: decision released",
    view: workspaceState(reviewWorkspace({ status: "waitlisted", review: reviewRecord("hacker") })),
  },
];

const FEEDBACK_CODES: OrganizerFeedbackCode[] = [
  ...(Object.keys(ACTION_ERROR_MESSAGES) as ActionErrorCode[]),
  "network",
  "stale_deployment",
];

/** One notice per distinct organizer notice id (codes without their own copy share the unexpected error notice). */
export const organizerNotices: NoticeView[] = FEEDBACK_CODES.map((code) => organizerNoticeFor(code)).filter(
  (notice, index, all) => all.findIndex((other) => other.id === notice.id) === index,
);
