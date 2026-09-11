import type { Viewer } from "@/lib/auth/types";
import type {
  ApplicantApplication,
  ApplicantIdentity,
  ReviewQueueProgress,
  ReviewRecord,
} from "@/lib/data/types";
import type { ApplicationStatus, DecisionStatus } from "@/lib/domain/enums";

// Success payloads for each Server Action (wrapped in ActionResult<T>).

export interface SignUpData {
  /** Null when email confirmation is required before the first sign-in. */
  viewer: Viewer | null;
  requiresEmailConfirmation: boolean;
  /** Suggested next route (onboarding after signup, or login when confirmation is required). */
  redirectTo: string;
}

export interface SignInData {
  viewer: Viewer;
  /** Safe same-origin path: the requested `next` path when allowed for the role, else the role home. */
  redirectTo: string;
}

export interface SignOutData {
  redirectTo: string;
}

export interface ProfileUpdateData {
  viewer: Viewer;
}

export type ApplicationData = ApplicantApplication;

export interface DecisionData {
  applicationId: string;
  status: DecisionStatus;
  decisionReleasedAt: string;
}

export interface ReviewSaveData {
  review: ReviewRecord;
  application: {
    id: string;
    status: ApplicationStatus;
    reviewStartedAt: string | null;
  };
}

export interface ReviewSubmitData extends ReviewSaveData {
  /** Next application needing review after this one. Null when the queue is empty (or could not be loaded). */
  nextApplicationId: string | null;
  /** Queue totals after this review, or null if they could not be loaded. The review is saved either way. */
  queueProgress: ReviewQueueProgress | null;
}

export type IdentityData = ApplicantIdentity;

export interface NextApplicationData {
  applicationId: string | null;
}
