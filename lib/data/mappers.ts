import { formatApplicantReference, splitIdentityResponses } from "@/lib/domain/applicant-identity";
import type { ApplicationType } from "@/lib/domain/enums";
import { deriveMissionState } from "@/lib/domain/mission";
import type {
  ApplicantApplication,
  ApplicantIdentity,
  ApplicationListItem,
  OrganizerOverview,
  ReviewApplication,
  ReviewQueueProgress,
  ReviewRecord,
} from "@/lib/data/types";
import { PROFILE_LINK_KEYS, isProfileLink, parseStoredResponses } from "@/lib/validation/application";
import { calculateApplicationCompletion } from "@/lib/validation/completion";
import type { Database } from "@/types/database";

// Pure row -> DTO mappers shared by the data access layer and Server Actions.

type PublicSchema = Database["public"];

export type ApplicationRow = PublicSchema["Tables"]["applications"]["Row"];
export type ReviewRow = PublicSchema["Tables"]["reviews"]["Row"];

type NullableFields<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

/** Generated RPC types mark every column non-null; these fields can be null at runtime. */
export type ApplicationListRow = NullableFields<
  PublicSchema["Functions"]["list_review_applications"]["Returns"][number],
  | "affiliation"
  | "launched_at"
  | "review_started_at"
  | "decision_released_at"
  | "review_id"
  | "reviewer_id"
  | "overall_score"
  | "recommendation"
  | "review_completed_at"
>;

export type OrganizerOverviewRow = PublicSchema["Functions"]["get_organizer_overview"]["Returns"][number];

export const APPLICATION_SELECT =
  "id, reference_number, user_id, application_type, responses, completion_percent, status, launched_at, review_started_at, decision_released_at, created_at, updated_at";

export const REVIEW_SELECT =
  "id, application_id, reviewer_id, rubric_scores, overall_score, notes, recommendation, completed_at, created_at, updated_at";

function applicationBase<T extends ApplicationType>(row: ApplicationRow & { application_type: T }) {
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    applicantReference: formatApplicantReference(row.application_type, row.reference_number),
    type: row.application_type,
    status: row.status,
    completionPercent: row.completion_percent,
    launchedAt: row.launched_at,
    reviewStartedAt: row.review_started_at,
    decisionReleasedAt: row.decision_released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toApplicantApplication(row: ApplicationRow): ApplicantApplication {
  return {
    ...applicationBase(row),
    responses: parseStoredResponses(row.application_type, row.responses),
    completion: calculateApplicationCompletion(row.application_type, row.responses),
    mission: deriveMissionState(row),
    isEditable: row.status === "draft",
  } as ApplicantApplication;
}

export function toReviewApplication(row: ApplicationRow): ReviewApplication {
  const responses = parseStoredResponses(row.application_type, row.responses) as Record<string, unknown>;
  const { narrative } = splitIdentityResponses(row.application_type, responses);
  return { ...applicationBase(row), narrative } as ReviewApplication;
}

function toScoreRecord(value: unknown): Record<string, number> {
  const scores: Record<string, number> = {};
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [dimension, score] of Object.entries(value)) {
      if (typeof score === "number") {
        scores[dimension] = score;
      }
    }
  }
  return scores;
}

export function toReviewRecord(row: ReviewRow, viewerId: string): ReviewRecord {
  return {
    id: row.id,
    applicationId: row.application_id,
    reviewerId: row.reviewer_id,
    isMine: row.reviewer_id === viewerId,
    scores: toScoreRecord(row.rubric_scores),
    overallScore: row.overall_score === null ? null : Number(row.overall_score),
    notes: row.notes,
    recommendation: row.recommendation,
    completedAt: row.completed_at,
    isCompleted: row.completed_at !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toStoredScores(value: unknown): Record<string, number> {
  return toScoreRecord(value);
}

export function toApplicationListItem(row: ApplicationListRow): ApplicationListItem {
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    applicantReference: formatApplicantReference(row.application_type, row.reference_number),
    type: row.application_type,
    status: row.status,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    affiliation: row.affiliation,
    launchedAt: row.launched_at,
    reviewStartedAt: row.review_started_at,
    decisionReleasedAt: row.decision_released_at,
    review:
      row.review_id && row.reviewer_id
        ? {
            id: row.review_id,
            reviewerId: row.reviewer_id,
            overallScore: row.overall_score === null ? null : Number(row.overall_score),
            recommendation: row.recommendation,
            completedAt: row.review_completed_at,
            isCompleted: row.review_completed_at !== null,
          }
        : null,
  };
}

export function toApplicantIdentity(
  row: Pick<ApplicationRow, "id" | "application_type" | "responses">,
  profile: { display_name: string | null; email: string } | null,
): ApplicantIdentity {
  const responses = parseStoredResponses(row.application_type, row.responses) as Record<string, unknown>;
  const presentText = (key: string) => {
    const value = responses[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  };

  return {
    applicationId: row.id,
    displayName: profile?.display_name ?? null,
    email: profile?.email ?? "",
    fullName: presentText("fullName"),
    birthdate: presentText("birthdate"),
    countryOfResidence: presentText("countryOfResidence"),
    cityOfResidence: presentText("cityOfResidence"),
    affiliation: presentText(row.application_type === "hacker" ? "school" : "company"),
    // Only links that pass their profile pattern are returned, so every link is safe to render as an href.
    links: PROFILE_LINK_KEYS.flatMap((key) => {
      const value = responses[key];
      return isProfileLink(key, value) ? [value] : [];
    }),
  };
}

export function toOrganizerOverview(row: OrganizerOverviewRow | undefined): OrganizerOverview {
  return {
    totalApplications: row?.total_applications ?? 0,
    draftCount: row?.draft_count ?? 0,
    submittedCount: row?.submitted_count ?? 0,
    awaitingReviewCount: row?.awaiting_review_count ?? 0,
    inReviewCount: row?.in_review_count ?? 0,
    needsReviewCount: row?.needs_review_count ?? 0,
    reviewsCompletedCount: row?.reviews_completed_count ?? 0,
    readyForDecisionCount: row?.ready_for_decision_count ?? 0,
    acceptedCount: row?.accepted_count ?? 0,
    waitlistedCount: row?.waitlisted_count ?? 0,
    decisionsMadeCount: row?.decisions_made_count ?? 0,
  };
}

export function toQueueProgress(overview: OrganizerOverview): ReviewQueueProgress {
  return {
    total: overview.submittedCount,
    reviewed: overview.reviewsCompletedCount,
    remaining: overview.needsReviewCount,
  };
}
