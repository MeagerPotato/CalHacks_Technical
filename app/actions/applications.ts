"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { failFromDatabase } from "@/lib/actions/errors";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { ApplicationData, DecisionData } from "@/lib/actions/types";
import { authorizeApplicantAction, authorizeOrganizerAction } from "@/lib/auth/authorize";
import { primaryApplicationType, type ApplicantViewer } from "@/lib/auth/types";
import { fetchApplicationRowById, fetchApplicationRowForUser } from "@/lib/data/applications";
import { APPLICATION_SELECT, toApplicantApplication } from "@/lib/data/mappers";
import { APPLICATION_TYPES, isDecisionStatus, type ApplicationType, type DecisionStatus } from "@/lib/domain/enums";
import { ROUTES } from "@/lib/routes";
import type { TypedSupabaseClient } from "@/lib/supabase/types";
import {
  getApplicationDraftSchema,
  getApplicationSubmissionSchema,
  mergeApplicationResponses,
} from "@/lib/validation/application";
import { calculateApplicationCompletion } from "@/lib/validation/completion";
import { toFieldErrors, toFormErrors } from "@/lib/validation/errors";
import { applicationIdSchema, decisionSchema } from "@/lib/validation/organizer";
import type { Json } from "@/types/database";

const applicationTypeSchema = z.enum(APPLICATION_TYPES, { error: "Application type must be hacker or judge." });

/** Read-merge-write attempts before a save that keeps losing races returns "conflict". */
const MAX_WRITE_ATTEMPTS = 3;

function revalidateApplicantRoutes() {
  revalidatePath(ROUTES.onboarding);
  revalidatePath(ROUTES.portal, "layout");
}

function revalidateOrganizerRoutes() {
  revalidatePath(ROUTES.organizer, "layout");
}

interface EnsuredApplication {
  application: ApplicationData;
  /** True when this call inserted the draft. */
  created: boolean;
}

/** Returns the viewer's application of one type, creating the draft first when it does not exist. */
async function ensureApplication(
  supabase: TypedSupabaseClient,
  viewer: ApplicantViewer,
  type: ApplicationType,
): Promise<ActionResult<EnsuredApplication>> {
  const existing = await fetchApplicationRowForUser(supabase, viewer.userId, type);
  if (existing.error) {
    return failFromDatabase("createApplication:load", existing.error);
  }
  if (existing.data) {
    return ok({ application: toApplicantApplication(existing.data), created: false });
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({ user_id: viewer.userId, application_type: type })
    .select(APPLICATION_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      // A concurrent request created it first.
      const retry = await fetchApplicationRowForUser(supabase, viewer.userId, type);
      if (retry.data) {
        return ok({ application: toApplicantApplication(retry.data), created: false });
      }
    }
    return failFromDatabase("createApplication:insert", error);
  }

  return ok({ application: toApplicantApplication(data), created: true });
}

/**
 * Creates the signed-in applicant's draft of one type (idempotent: returns the existing one). The type defaults to the
 * account's first application type; a type the account does not apply for returns `application_type_mismatch`.
 */
export async function createApplication(type?: ApplicationType): Promise<ActionResult<ApplicationData>> {
  const auth = await authorizeApplicantAction();
  if (!auth.ok) {
    return auth;
  }
  const { supabase, viewer } = auth;

  let target = primaryApplicationType(viewer);
  if (type !== undefined) {
    const parsedType = applicationTypeSchema.safeParse(type);
    if (!parsedType.success) {
      return fail("validation_failed", { formErrors: toFormErrors(parsedType.error) });
    }
    if (!viewer.applicationTypes.includes(parsedType.data)) {
      return fail("application_type_mismatch");
    }
    target = parsedType.data;
  }

  const result = await ensureApplication(supabase, viewer, target);
  if (!result.ok) {
    return result;
  }
  if (result.data.created) {
    revalidateApplicantRoutes();
  }
  return ok(result.data.application);
}

/**
 * Creates a draft for every application type the signed-in account applies for (idempotent) and returns them in form
 * order. Onboarding calls it, so an account that applies as a Hacker and a Judge starts with both drafts.
 */
export async function createApplications(): Promise<ActionResult<ApplicationData[]>> {
  const auth = await authorizeApplicantAction();
  if (!auth.ok) {
    return auth;
  }
  const { supabase, viewer } = auth;

  const applications: ApplicationData[] = [];
  let created = false;
  for (const type of viewer.applicationTypes) {
    const result = await ensureApplication(supabase, viewer, type);
    if (!result.ok) {
      if (created) {
        revalidateApplicantRoutes();
      }
      return result;
    }
    applications.push(result.data.application);
    created ||= result.data.created;
  }

  if (created) {
    revalidateApplicantRoutes();
  }
  return ok(applications);
}

/**
 * Saves draft answers. The payload is a partial response object for the application's type:
 * provided keys are merged into the saved draft, null or blank values clear an answer, and
 * unknown keys are ignored. Only the owner's draft can be saved. Overlapping saves are merged
 * rather than overwriting each other.
 */
export async function saveApplication(applicationId: string, payload: unknown): Promise<ActionResult<ApplicationData>> {
  const auth = await authorizeApplicantAction();
  if (!auth.ok) {
    return auth;
  }
  const { supabase, viewer } = auth;

  if (!applicationIdSchema.safeParse(applicationId).success) {
    return fail("not_found");
  }

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    const current = await fetchApplicationRowById(supabase, applicationId);
    if (current.error) {
      return failFromDatabase("saveApplication:load", current.error);
    }
    if (!current.data || current.data.user_id !== viewer.userId) {
      return fail("not_found");
    }
    if (current.data.status !== "draft") {
      return fail("application_locked");
    }

    const type = current.data.application_type;
    const parsed = getApplicationDraftSchema(type).safeParse(payload);
    if (!parsed.success) {
      return fail("validation_failed", {
        fieldErrors: toFieldErrors(parsed.error),
        formErrors: toFormErrors(parsed.error),
      });
    }

    const responses = mergeApplicationResponses(type, current.data.responses, parsed.data);
    const completion = calculateApplicationCompletion(type, responses);

    // Matching updated_at makes this write miss if another write landed after the read above.
    const { data, error } = await supabase
      .from("applications")
      .update({ responses: responses as Json, completion_percent: completion.percent })
      .eq("id", applicationId)
      .eq("status", "draft")
      .eq("updated_at", current.data.updated_at)
      .select(APPLICATION_SELECT)
      .maybeSingle();

    if (error) {
      return failFromDatabase("saveApplication:update", error);
    }
    if (data) {
      revalidateApplicantRoutes();
      return ok(toApplicantApplication(data));
    }
    // The row changed after it was read (another save or a submission): reload and merge again.
  }

  return fail("conflict");
}

/**
 * Submits (launches) the owner's draft after validating the saved answers against the full
 * role-specific schema. Sets status = submitted; the database sets launched_at. Irreversible.
 */
export async function submitApplication(applicationId: string): Promise<ActionResult<ApplicationData>> {
  const auth = await authorizeApplicantAction();
  if (!auth.ok) {
    return auth;
  }
  const { supabase, viewer } = auth;

  if (!applicationIdSchema.safeParse(applicationId).success) {
    return fail("not_found");
  }

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    const current = await fetchApplicationRowById(supabase, applicationId);
    if (current.error) {
      return failFromDatabase("submitApplication:load", current.error);
    }
    if (!current.data || current.data.user_id !== viewer.userId) {
      return fail("not_found");
    }
    if (current.data.status !== "draft") {
      return fail("application_locked");
    }

    const submission = getApplicationSubmissionSchema(current.data.application_type).safeParse(current.data.responses);
    if (!submission.success) {
      return fail("application_incomplete", {
        fieldErrors: toFieldErrors(submission.error),
        formErrors: toFormErrors(submission.error),
      });
    }

    // Matching updated_at guarantees the answers validated above are the ones submitted.
    const { data, error } = await supabase
      .from("applications")
      .update({ responses: submission.data as Json, status: "submitted" })
      .eq("id", applicationId)
      .eq("status", "draft")
      .eq("updated_at", current.data.updated_at)
      .select(APPLICATION_SELECT)
      .maybeSingle();

    if (error) {
      return failFromDatabase("submitApplication:update", error);
    }
    if (data) {
      revalidateApplicantRoutes();
      revalidateOrganizerRoutes();
      return ok(toApplicantApplication(data));
    }
    // The row changed after it was read: reload and validate again.
  }

  return fail("conflict");
}

/**
 * Organizer only: releases the official decision. Only "accepted" or "waitlisted" are valid,
 * the application must have a completed review, and a released decision is final.
 */
export async function updateApplicationStatus(
  applicationId: string,
  status: DecisionStatus,
): Promise<ActionResult<DecisionData>> {
  const auth = await authorizeOrganizerAction();
  if (!auth.ok) {
    return auth;
  }
  const { supabase } = auth;

  if (!applicationIdSchema.safeParse(applicationId).success) {
    return fail("not_found");
  }

  const decision = decisionSchema.safeParse(status);
  if (!decision.success) {
    return fail("validation_failed", { fieldErrors: { status: [decision.error.issues[0].message] } });
  }

  const current = await supabase
    .from("applications")
    .select("id, status, review:reviews!reviews_application_id_fkey(completed_at)")
    .eq("id", applicationId)
    .maybeSingle();

  if (current.error) {
    return failFromDatabase("updateApplicationStatus:load", current.error);
  }
  if (!current.data) {
    return fail("not_found");
  }
  if (current.data.status === "draft" || isDecisionStatus(current.data.status)) {
    return fail("invalid_status_transition");
  }
  if (!current.data.review?.completed_at) {
    return fail("review_not_completed");
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ status: decision.data })
    .eq("id", applicationId)
    .in("status", ["submitted", "in_review"])
    .select("id, status, decision_released_at")
    .maybeSingle();

  if (error) {
    return failFromDatabase("updateApplicationStatus:update", error);
  }
  if (!data || !isDecisionStatus(data.status) || !data.decision_released_at) {
    return fail("invalid_status_transition");
  }

  revalidateOrganizerRoutes();
  revalidatePath(ROUTES.portal, "layout");
  return ok({ applicationId: data.id, status: data.status, decisionReleasedAt: data.decision_released_at });
}
