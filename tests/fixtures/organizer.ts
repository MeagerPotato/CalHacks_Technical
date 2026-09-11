import type {
  ApplicantIdentity,
  ApplicationListItem,
  ApplicationListPage,
  ApplicationListReviewSummary,
  OrganizerDashboard,
  ReviewAccess,
  ReviewQueueProgress,
  ReviewRecord,
  ReviewWorkspace,
} from "@/lib/data/types";
import { formatApplicantReference, splitIdentityResponses } from "@/lib/domain/applicant-identity";
import {
  APPLICATION_TYPES,
  type ApplicationStatus,
  type ApplicationType,
  type Recommendation,
} from "@/lib/domain/enums";
import { JUDGE_EXPERTISE_AREAS, type JudgeExpertiseArea } from "@/lib/validation/application";
import { parseApplicationListFilters, type ApplicationListFiltersInput } from "@/lib/validation/organizer";
import { calculateOverallScore } from "@/lib/validation/review";
import { validHackerResponses, validJudgeResponses } from "@/tests/fixtures/applications";
import { completeHackerRubric, completeJudgeRubric } from "@/tests/fixtures/reviews";

// =============================================================================
// Organizer data-layer DTOs for unit tests and the organizer gallery. They follow the shapes lib/data/organizer.ts
// returns, with counts that agree with each other.
// =============================================================================

export const ORGANIZER_TIMES = {
  created: "2026-09-01T17:00:00.000Z",
  launched: "2026-09-09T18:30:00.000Z",
  reviewStarted: "2026-09-12T16:05:00.000Z",
  reviewed: "2026-09-12T17:20:00.000Z",
  decided: "2026-09-20T19:45:00.000Z",
} as const;

export const REVIEWER_ID = "c0000000-0000-4000-8000-000000000001";
export const OTHER_REVIEWER_ID = "c0000000-0000-4000-8000-000000000002";

export const QUEUE_PROGRESS: ReviewQueueProgress = { total: 7, reviewed: 3, remaining: 4 };

export function fixtureApplicationId(index: number): string {
  return `b0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function isDecided(status: ApplicationStatus): boolean {
  return status === "accepted" || status === "waitlisted";
}

export interface ListReviewOptions {
  index: number;
  completed?: boolean;
  overallScore?: number | null;
  recommendation?: Recommendation | null;
  reviewerId?: string;
}

export function listReviewSummary(options: ListReviewOptions): ApplicationListReviewSummary {
  const completed = options.completed ?? true;
  return {
    id: `d0000000-0000-4000-8000-${String(options.index).padStart(12, "0")}`,
    reviewerId: options.reviewerId ?? REVIEWER_ID,
    overallScore: options.overallScore === undefined ? (completed ? 4 : null) : options.overallScore,
    recommendation: options.recommendation === undefined ? (completed ? "yes" : null) : options.recommendation,
    completedAt: completed ? ORGANIZER_TIMES.reviewed : null,
    isCompleted: completed,
  };
}

export interface ListItemOptions {
  index: number;
  type?: ApplicationType;
  status?: ApplicationStatus;
  name?: string;
  email?: string;
  affiliation?: string | null;
  review?: ApplicationListReviewSummary | null;
}

export function listItem(options: ListItemOptions): ApplicationListItem {
  const type = options.type ?? "hacker";
  const status = options.status ?? "submitted";
  const referenceNumber = 1000 + options.index;
  return {
    id: fixtureApplicationId(options.index),
    referenceNumber,
    applicantReference: formatApplicantReference(type, referenceNumber),
    type,
    status,
    applicantName: options.name ?? `Test ${type === "hacker" ? "Hacker" : "Judge"} ${options.index}`,
    applicantEmail: options.email ?? `applicant-${options.index}@example.com`,
    affiliation:
      options.affiliation === undefined ? (type === "hacker" ? "Example University" : "Example Labs") : options.affiliation,
    launchedAt: status === "draft" ? null : ORGANIZER_TIMES.launched,
    reviewStartedAt: status === "in_review" || isDecided(status) ? ORGANIZER_TIMES.reviewStarted : null,
    decisionReleasedAt: isDecided(status) ? ORGANIZER_TIMES.decided : null,
    review: options.review ?? null,
  };
}

/** Four listed applications: a reviewed Hacker, an unreviewed Judge, a Hacker with a draft review, an accepted Judge. */
export function sampleListItems(): ApplicationListItem[] {
  return [
    listItem({
      index: 1,
      type: "hacker",
      status: "in_review",
      review: listReviewSummary({ index: 1, overallScore: 4, recommendation: "strong_yes" }),
    }),
    listItem({ index: 2, type: "judge", status: "submitted" }),
    listItem({ index: 3, type: "hacker", status: "in_review", review: listReviewSummary({ index: 3, completed: false }) }),
    listItem({
      index: 4,
      type: "judge",
      status: "accepted",
      review: listReviewSummary({ index: 4, overallScore: 4.25, recommendation: "yes" }),
    }),
  ];
}

/** A list page for `items`, with filters parsed the way the page parses the query string. */
export function applicationListPage(
  items: ApplicationListItem[],
  input: ApplicationListFiltersInput = {},
  total: number = items.length,
): ApplicationListPage {
  const filters = parseApplicationListFilters(input);
  return {
    items,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
    filters,
  };
}

const JUDGE_COUNTS: Partial<Record<JudgeExpertiseArea, number>> = { web: 3, security: 2, ai_ml: 1, data: 1, design_ux: 1 };

/** A dashboard with 9 applications (2 drafts), 3 completed reviews, 2 decisions, and 3 submitted Judges. */
export function organizerDashboard(overrides: Partial<OrganizerDashboard> = {}): OrganizerDashboard {
  const expertiseCoverage = JUDGE_EXPERTISE_AREAS.map((expertise) => ({
    expertise,
    judgeCount: JUDGE_COUNTS[expertise] ?? 0,
  })).sort((first, second) => second.judgeCount - first.judgeCount);

  return {
    overview: {
      totalApplications: 9,
      draftCount: 2,
      submittedCount: 7,
      awaitingReviewCount: 2,
      inReviewCount: 3,
      needsReviewCount: 4,
      reviewsCompletedCount: 3,
      readyForDecisionCount: 1,
      acceptedCount: 1,
      waitlistedCount: 1,
      decisionsMadeCount: 2,
    },
    queueProgress: { ...QUEUE_PROGRESS },
    statusBreakdown: [
      { type: "hacker", total: 5, counts: { draft: 1, submitted: 1, in_review: 2, accepted: 1, waitlisted: 0 } },
      { type: "judge", total: 4, counts: { draft: 1, submitted: 1, in_review: 1, accepted: 0, waitlisted: 1 } },
    ],
    expertiseCoverage,
    expertiseGaps: expertiseCoverage.filter((entry) => entry.judgeCount === 0).map((entry) => entry.expertise),
    submittedJudgeCount: 3,
    recentSubmissions: sampleListItems(),
    nextUnreviewedApplicationId: fixtureApplicationId(2),
    ...overrides,
  };
}

/** A dashboard before any application exists. */
export function emptyOrganizerDashboard(): OrganizerDashboard {
  return {
    overview: {
      totalApplications: 0,
      draftCount: 0,
      submittedCount: 0,
      awaitingReviewCount: 0,
      inReviewCount: 0,
      needsReviewCount: 0,
      reviewsCompletedCount: 0,
      readyForDecisionCount: 0,
      acceptedCount: 0,
      waitlistedCount: 0,
      decisionsMadeCount: 0,
    },
    queueProgress: { total: 0, reviewed: 0, remaining: 0 },
    statusBreakdown: APPLICATION_TYPES.map((type) => ({
      type,
      total: 0,
      counts: { draft: 0, submitted: 0, in_review: 0, accepted: 0, waitlisted: 0 },
    })),
    expertiseCoverage: JUDGE_EXPERTISE_AREAS.map((expertise) => ({ expertise, judgeCount: 0 })),
    expertiseGaps: [...JUDGE_EXPERTISE_AREAS],
    submittedJudgeCount: 0,
    recentSubmissions: [],
    nextUnreviewedApplicationId: null,
  };
}

/** A complete review written by the signed-in organizer, from the shared rubric fixtures. */
export function reviewRecord(type: ApplicationType, overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  const rubric = type === "hacker" ? completeHackerRubric : completeJudgeRubric;
  const scores: Record<string, number> = { ...rubric.scores };
  return {
    id: "d0000000-0000-4000-8000-000000000001",
    applicationId: fixtureApplicationId(1),
    reviewerId: REVIEWER_ID,
    isMine: true,
    scores,
    overallScore: calculateOverallScore(type, scores),
    notes: "notes" in rubric ? rubric.notes : "",
    recommendation: rubric.recommendation,
    completedAt: ORGANIZER_TIMES.reviewed,
    isCompleted: true,
    createdAt: ORGANIZER_TIMES.reviewStarted,
    updatedAt: ORGANIZER_TIMES.reviewed,
    ...overrides,
  };
}

/** A draft review with one score, no recommendation, and no notes. */
export function draftReviewRecord(type: ApplicationType, overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  const complete = reviewRecord(type);
  const [firstKey] = Object.keys(complete.scores);
  return {
    ...complete,
    scores: { [firstKey]: complete.scores[firstKey] },
    overallScore: null,
    notes: "",
    recommendation: null,
    completedAt: null,
    isCompleted: false,
    updatedAt: ORGANIZER_TIMES.reviewStarted,
    ...overrides,
  };
}

/** Revealed identity for a workspace. The only fixture that fills ApplicantIdentity fields. */
export function applicantIdentity(type: ApplicationType, index = 1): ApplicantIdentity {
  return {
    applicationId: fixtureApplicationId(index),
    displayName: "Ada Builder",
    email: `applicant-${index}@example.com`,
    fullName: type === "hacker" ? "Test Hacker" : "Test Judge",
    birthdate: type === "hacker" ? "2006-02-14" : "1990-06-01",
    countryOfResidence: type === "hacker" ? "US" : "CA",
    cityOfResidence: type === "hacker" ? "Berkeley" : "Toronto",
    affiliation: type === "hacker" ? "Example University" : "Example Labs",
    links: type === "hacker" ? ["https://example.com/test-hacker", "not a link"] : [],
  };
}

export interface WorkspaceOptions {
  type?: ApplicationType;
  status?: ApplicationStatus;
  index?: number;
  review?: ReviewRecord | null;
  revealIdentity?: boolean;
  nextUnreviewedApplicationId?: string | null;
  queueProgress?: ReviewQueueProgress;
}

/** A review workspace as getReviewWorkspace returns it, with access and decision flags derived the same way. */
export function reviewWorkspace(options: WorkspaceOptions = {}): ReviewWorkspace {
  const type = options.type ?? "hacker";
  const status = options.status ?? "in_review";
  const index = options.index ?? 1;
  const referenceNumber = 1000 + index;
  const responses: Record<string, unknown> = type === "hacker" ? validHackerResponses : validJudgeResponses;
  const { narrative } = splitIdentityResponses(type, responses);
  const reviewable = status === "submitted" || status === "in_review";
  const id = fixtureApplicationId(index);
  const review = options.review ? { ...options.review, applicationId: id } : null;

  let reviewAccess: ReviewAccess = "editable";
  if (!reviewable) {
    reviewAccess = "locked";
  } else if (review && !review.isMine) {
    reviewAccess = "owned_by_another_organizer";
  }

  const application = {
    id,
    referenceNumber,
    applicantReference: formatApplicantReference(type, referenceNumber),
    type,
    status,
    completionPercent: status === "draft" ? 60 : 100,
    launchedAt: status === "draft" ? null : ORGANIZER_TIMES.launched,
    reviewStartedAt: status === "in_review" || isDecided(status) ? ORGANIZER_TIMES.reviewStarted : null,
    decisionReleasedAt: isDecided(status) ? ORGANIZER_TIMES.decided : null,
    createdAt: ORGANIZER_TIMES.created,
    updatedAt: ORGANIZER_TIMES.launched,
    narrative,
  } as unknown as ReviewWorkspace["application"];

  return {
    application,
    identity: options.revealIdentity ? applicantIdentity(type, index) : null,
    isBlind: !options.revealIdentity,
    review,
    reviewAccess,
    canReleaseDecision: reviewable && Boolean(review?.isCompleted),
    nextUnreviewedApplicationId:
      options.nextUnreviewedApplicationId === undefined ? fixtureApplicationId(index + 1) : options.nextUnreviewedApplicationId,
    queueProgress: options.queueProgress ?? { ...QUEUE_PROGRESS },
  };
}
