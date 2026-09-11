import type { ApplicationType, DecisionStatus } from "@/lib/domain/enums";

import { completeHackerRubric, completeJudgeRubric } from "../../tests/fixtures/reviews";
import type { E2EUser } from "./accounts";

// Organizer workflow writes go through the organizer's own publishable-key client, so RLS and the database
// workflow guards run exactly as they will for the Phase 3 organizer pages.

/** Starts a review as the organizer. Saving the first review moves the application to in_review. */
export async function startReview(organizer: E2EUser, applicationId: string): Promise<void> {
  const { error } = await organizer.client
    .from("reviews")
    .insert({ application_id: applicationId, reviewer_id: organizer.userId });
  if (error) {
    throw new Error(`E2E review insert failed: ${error.code} ${error.message}`);
  }
}

/**
 * Completes the organizer's review with a full rubric, then releases the decision. The database computes the
 * overall score, stamps completed_at, and sets decision_released_at.
 */
export async function completeReviewAndDecide(
  organizer: E2EUser,
  applicationId: string,
  type: ApplicationType,
  decision: DecisionStatus,
): Promise<void> {
  const rubric = type === "hacker" ? completeHackerRubric : completeJudgeRubric;
  const review = await organizer.client
    .from("reviews")
    .update({
      rubric_scores: { ...rubric.scores },
      notes: "notes" in rubric ? rubric.notes : "",
      recommendation: rubric.recommendation,
      completed_at: new Date().toISOString(),
    })
    .eq("application_id", applicationId)
    .eq("reviewer_id", organizer.userId)
    .select("id");
  if (review.error || review.data.length !== 1) {
    throw new Error(`E2E review completion failed: ${review.error ? review.error.code : "no review updated"}`);
  }

  const application = await organizer.client
    .from("applications")
    .update({ status: decision })
    .eq("id", applicationId)
    .select("id");
  if (application.error || application.data.length !== 1) {
    throw new Error(`E2E decision failed: ${application.error ? application.error.code : "no application updated"}`);
  }
}
