"use server";

import { revalidatePath } from "next/cache";

import { failFromDatabase, logServerError } from "@/lib/actions/errors";
import { fail, ok, type ActionFailure, type ActionResult } from "@/lib/actions/result";
import type { IdentityData, NextApplicationData, ReviewSaveData, ReviewSubmitData } from "@/lib/actions/types";
import { authorizeOrganizerAction, type Authorized } from "@/lib/auth/authorize";
import type { OrganizerViewer } from "@/lib/auth/types";
import { DataAccessError } from "@/lib/data/errors";
import { REVIEW_SELECT, toReviewRecord, toStoredScores } from "@/lib/data/mappers";
import { fetchApplicantIdentity, fetchNextUnreviewedApplicationId, fetchQueueProgress } from "@/lib/data/organizer";
import { isDecisionStatus } from "@/lib/domain/enums";
import { ROUTES } from "@/lib/routes";
import { toFieldErrors, toFormErrors } from "@/lib/validation/errors";
import { applicationIdSchema } from "@/lib/validation/organizer";
import { REVIEW_SCHEMAS, compactRubricScores } from "@/lib/validation/review";
import type { Json } from "@/types/database";

type ReviewMode = "draft" | "complete";

/** Read-merge-write attempts before a save that keeps losing races returns "conflict". */
const MAX_WRITE_ATTEMPTS = 3;

function fromDataAccessError(context: string, error: unknown): ActionFailure {
  if (error instanceof DataAccessError) {
    return fail(error.code);
  }
  logServerError(context, error);
  return fail("unexpected_error");
}

async function writeReview(
  auth: Authorized<OrganizerViewer>,
  mode: ReviewMode,
  applicationId: string,
  payload: unknown,
): Promise<ActionResult<ReviewSaveData>> {
  const { supabase, viewer } = auth;

  if (!applicationIdSchema.safeParse(applicationId).success) {
    return fail("not_found");
  }

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    const { data: application, error: loadError } = await supabase
      .from("applications")
      .select(
        "id, application_type, status, review:reviews!reviews_application_id_fkey(id, reviewer_id, rubric_scores, notes, recommendation, completed_at, updated_at)",
      )
      .eq("id", applicationId)
      .maybeSingle();

    if (loadError) {
      return failFromDatabase(`${mode}Review:load`, loadError);
    }
    if (!application) {
      return fail("not_found");
    }
    if (application.status === "draft") {
      return fail("invalid_status_transition");
    }
    if (isDecisionStatus(application.status)) {
      return fail("review_locked");
    }

    const existing = application.review;
    if (existing && existing.reviewer_id !== viewer.userId) {
      return fail("review_owned_by_another_organizer");
    }
    if (mode === "draft" && existing?.completed_at) {
      return fail("review_already_completed");
    }

    const schemas = REVIEW_SCHEMAS[application.application_type];
    const parsed = (mode === "draft" ? schemas.draft : schemas.submission).safeParse(payload);
    if (!parsed.success) {
      return fail("validation_failed", {
        fieldErrors: toFieldErrors(parsed.error, 2),
        formErrors: toFormErrors(parsed.error),
      });
    }

    // Drafts merge into the saved review (null clears a score); completion replaces the scores.
    const scores =
      mode === "draft"
        ? compactRubricScores({ ...toStoredScores(existing?.rubric_scores), ...(parsed.data.scores ?? {}) })
        : compactRubricScores(parsed.data.scores ?? {});
    const notes = parsed.data.notes ?? existing?.notes ?? "";
    const recommendation =
      parsed.data.recommendation !== undefined ? parsed.data.recommendation : (existing?.recommendation ?? null);

    const values = {
      rubric_scores: scores as Json,
      notes,
      recommendation,
      // The database replaces this with its own timestamp and keeps the first completion time.
      completed_at: mode === "complete" ? new Date().toISOString() : null,
    };

    // Updates match updated_at, so a write that landed after the read above makes this one miss.
    const saved = existing
      ? await supabase
          .from("reviews")
          .update(values)
          .eq("id", existing.id)
          .eq("updated_at", existing.updated_at)
          .select(REVIEW_SELECT)
          .maybeSingle()
      : await supabase
          .from("reviews")
          .insert({ application_id: applicationId, reviewer_id: viewer.userId, ...values })
          .select(REVIEW_SELECT)
          .maybeSingle();

    if (saved.error) {
      if (!existing && saved.error.code === "23505") {
        continue; // Another request created the review first: reload to check ownership and merge.
      }
      return failFromDatabase(`${mode}Review:${existing ? "update" : "insert"}`, saved.error);
    }
    if (!saved.data) {
      continue; // The review changed after it was read: reload and merge again.
    }

    const { data: updatedApplication, error: statusError } = await supabase
      .from("applications")
      .select("id, status, review_started_at")
      .eq("id", applicationId)
      .single();

    if (statusError) {
      return failFromDatabase(`${mode}Review:reload`, statusError);
    }

    revalidatePath(ROUTES.organizer, "layout");
    revalidatePath(ROUTES.portal, "layout");

    return ok({
      review: toReviewRecord(saved.data, viewer.userId),
      application: {
        id: updatedApplication.id,
        status: updatedApplication.status,
        reviewStartedAt: updatedApplication.review_started_at,
      },
    });
  }

  return fail("conflict");
}

/**
 * Saves a draft review (partial scores allowed; omitted fields keep saved values, a null score
 * clears it). The first save moves a submitted application to in_review. Does not change the
 * official decision. Fails once the review is completed.
 */
export async function saveReview(applicationId: string, rubricPayload: unknown): Promise<ActionResult<ReviewSaveData>> {
  const auth = await authorizeOrganizerAction();
  if (!auth.ok) {
    return auth;
  }
  return writeReview(auth, "draft", applicationId, rubricPayload);
}

/**
 * Completes the review: every rubric dimension and a recommendation are required. Returns the
 * next unreviewed application for "Save review and continue". Can be called again to amend a
 * completed review until a decision is released. Does not change the official decision.
 */
export async function submitReview(
  applicationId: string,
  rubricPayload: unknown,
): Promise<ActionResult<ReviewSubmitData>> {
  const auth = await authorizeOrganizerAction();
  if (!auth.ok) {
    return auth;
  }

  const result = await writeReview(auth, "complete", applicationId, rubricPayload);
  if (!result.ok) {
    return result;
  }

  // The review is already saved, so queue lookups degrade to null instead of failing the action.
  const [next, progress] = await Promise.allSettled([
    fetchNextUnreviewedApplicationId(auth.supabase, applicationId),
    fetchQueueProgress(auth.supabase),
  ]);
  if (next.status === "rejected") {
    logServerError("submitReview:nextApplication", next.reason);
  }
  if (progress.status === "rejected") {
    logServerError("submitReview:queueProgress", progress.reason);
  }

  return ok({
    ...result.data,
    nextApplicationId: next.status === "fulfilled" ? next.value : null,
    queueProgress: progress.status === "fulfilled" ? progress.value : null,
  });
}

/** Organizer only: returns identifying details hidden by blind review. */
export async function revealApplicantIdentity(applicationId: string): Promise<ActionResult<IdentityData>> {
  const auth = await authorizeOrganizerAction();
  if (!auth.ok) {
    return auth;
  }

  try {
    const identity = await fetchApplicantIdentity(auth.supabase, applicationId);
    return identity ? ok(identity) : fail("not_found");
  } catch (error) {
    return fromDataAccessError("revealApplicantIdentity", error);
  }
}

/** Organizer only: the next application needing review, optionally after a given application. */
export async function findNextUnreviewedApplication(
  afterApplicationId?: string | null,
): Promise<ActionResult<NextApplicationData>> {
  const auth = await authorizeOrganizerAction();
  if (!auth.ok) {
    return auth;
  }

  try {
    return ok({ applicationId: await fetchNextUnreviewedApplicationId(auth.supabase, afterApplicationId) });
  } catch (error) {
    return fromDataAccessError("findNextUnreviewedApplication", error);
  }
}
