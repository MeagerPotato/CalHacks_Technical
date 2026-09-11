import type { IDENTITY_RESPONSE_KEYS } from "@/lib/domain/applicant-identity";
import type { ApplicationStatus, ApplicationType, Recommendation } from "@/lib/domain/enums";
import type { MissionState } from "@/lib/domain/mission";
import type { ApplicationDraftByType, JudgeExpertiseArea } from "@/lib/validation/application";
import type { ApplicationCompletion } from "@/lib/validation/completion";
import type { ApplicationListFilters } from "@/lib/validation/organizer";

// =============================================================================
// Data transfer objects returned by the data access layer and Server Actions.
// All timestamps are ISO 8601 strings from Postgres timestamptz.
// =============================================================================

interface ApplicationBase<T extends ApplicationType> {
  id: string;
  referenceNumber: number;
  /** Stable non-identifying label such as "H-1042". */
  applicantReference: string;
  type: T;
  status: ApplicationStatus;
  /** Stored convenience value (always 100 once submitted). */
  completionPercent: number;
  launchedAt: string | null;
  reviewStartedAt: string | null;
  decisionReleasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The current applicant's own application. Discriminate on `type`. */
export type ApplicantApplication<T extends ApplicationType = ApplicationType> = T extends ApplicationType
  ? ApplicationBase<T> & {
      /** Saved answers (invalid or unknown stored values are omitted). */
      responses: Partial<ApplicationDraftByType[T]>;
      /** Live completion and Launch Readiness data derived from the Zod schema. */
      completion: ApplicationCompletion<T>;
      /** Launch/Cruise/Landing state derived from status and workflow timestamps. */
      mission: MissionState;
      /** Only drafts can be saved or submitted. */
      isEditable: boolean;
    }
  : never;

export type IdentityResponseKey<T extends ApplicationType> = (typeof IDENTITY_RESPONSE_KEYS)[T][number];

/** Application as shown in the review workspace, with identifying answers removed. */
export type ReviewApplication<T extends ApplicationType = ApplicationType> = T extends ApplicationType
  ? ApplicationBase<T> & {
      narrative: Omit<Partial<ApplicationDraftByType[T]>, IdentityResponseKey<T>>;
    }
  : never;

/** Identifying details withheld in blind review until explicitly revealed. */
export interface ApplicantIdentity {
  applicationId: string;
  displayName: string | null;
  email: string;
  preferredName: string | null;
  /** School for Hackers, company/organization for Judges. */
  affiliation: string | null;
  links: string[];
}

export interface ReviewRecord {
  id: string;
  applicationId: string;
  reviewerId: string;
  /** True when the signed-in organizer wrote this review. */
  isMine: boolean;
  scores: Record<string, number>;
  /** Average of all dimensions (two decimals), null until every dimension is scored. */
  overallScore: number | null;
  notes: string;
  recommendation: Recommendation | null;
  completedAt: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReviewAccess = "editable" | "owned_by_another_organizer" | "locked";

export interface ReviewQueueProgress {
  /** Non-draft applications. */
  total: number;
  /** Applications with a completed review. */
  reviewed: number;
  /** Submitted or in-review applications without a completed review. */
  remaining: number;
}

export interface ReviewWorkspace {
  application: ReviewApplication;
  /** Null unless identity was explicitly requested (blind review by default). */
  identity: ApplicantIdentity | null;
  isBlind: boolean;
  review: ReviewRecord | null;
  reviewAccess: ReviewAccess;
  /** True when a completed review exists and no decision has been released. */
  canReleaseDecision: boolean;
  /** Next application needing review after this one (queue order), or null. */
  nextUnreviewedApplicationId: string | null;
  queueProgress: ReviewQueueProgress;
}

export interface ApplicationListReviewSummary {
  id: string;
  reviewerId: string;
  overallScore: number | null;
  recommendation: Recommendation | null;
  completedAt: string | null;
  isCompleted: boolean;
}

export interface ApplicationListItem {
  id: string;
  referenceNumber: number;
  applicantReference: string;
  type: ApplicationType;
  status: ApplicationStatus;
  applicantName: string;
  applicantEmail: string;
  /** School for Hackers, company/organization for Judges. */
  affiliation: string | null;
  launchedAt: string | null;
  reviewStartedAt: string | null;
  decisionReleasedAt: string | null;
  review: ApplicationListReviewSummary | null;
}

export interface ApplicationListPage {
  items: ApplicationListItem[];
  /** Total matching applications across all pages. */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  filters: ApplicationListFilters;
}

export interface OrganizerOverview {
  totalApplications: number;
  draftCount: number;
  /** Every non-draft application. */
  submittedCount: number;
  /** Status submitted (no review started yet). */
  awaitingReviewCount: number;
  inReviewCount: number;
  /** Submitted or in review without a completed review. */
  needsReviewCount: number;
  reviewsCompletedCount: number;
  /** In review with a completed review and no decision yet. */
  readyForDecisionCount: number;
  acceptedCount: number;
  waitlistedCount: number;
  decisionsMadeCount: number;
}

export interface StatusBreakdownEntry {
  type: ApplicationType;
  total: number;
  counts: Record<ApplicationStatus, number>;
}

export interface ExpertiseCoverageEntry {
  expertise: JudgeExpertiseArea;
  /** Non-draft Judge applications listing this expertise. */
  judgeCount: number;
}

export interface OrganizerDashboard {
  overview: OrganizerOverview;
  queueProgress: ReviewQueueProgress;
  statusBreakdown: StatusBreakdownEntry[];
  /** Every expertise category (including zero counts), highest coverage first. */
  expertiseCoverage: ExpertiseCoverageEntry[];
  /** Expertise categories with no submitted Judge. */
  expertiseGaps: JudgeExpertiseArea[];
  submittedJudgeCount: number;
  /** Five most recently submitted applications. */
  recentSubmissions: ApplicationListItem[];
  nextUnreviewedApplicationId: string | null;
}
