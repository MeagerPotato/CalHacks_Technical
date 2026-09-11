import "server-only";

import { cache } from "react";

import { requireApplicant } from "@/lib/auth/dal";
import { primaryApplicationType } from "@/lib/auth/types";
import { toDataAccessError } from "@/lib/data/errors";
import { APPLICATION_SELECT, toApplicantApplication } from "@/lib/data/mappers";
import type { ApplicantApplication } from "@/lib/data/types";
import type { ApplicationType } from "@/lib/domain/enums";
import { createClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Query helpers (take an explicit client; RLS applies to every query)
// ---------------------------------------------------------------------------

/** The user's application of one type. An account holds at most one per type. */
export function fetchApplicationRowForUser(supabase: TypedSupabaseClient, userId: string, type: ApplicationType) {
  return supabase
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("user_id", userId)
    .eq("application_type", type)
    .maybeSingle();
}

/** Every application the user owns, in form order (the enum orders Hacker before Judge). */
export function fetchApplicationRowsForUser(supabase: TypedSupabaseClient, userId: string) {
  return supabase.from("applications").select(APPLICATION_SELECT).eq("user_id", userId).order("application_type");
}

export function fetchApplicationRowById(supabase: TypedSupabaseClient, applicationId: string) {
  return supabase.from("applications").select(APPLICATION_SELECT).eq("id", applicationId).maybeSingle();
}

// ---------------------------------------------------------------------------
// Server Component reads
// ---------------------------------------------------------------------------

/**
 * Every application the signed-in applicant owns, with completion and mission state, in form order. Empty before
 * onboarding creates them. Redirects signed-out users and organizers.
 */
export const getMyApplications = cache(async (): Promise<ApplicantApplication[]> => {
  const viewer = await requireApplicant();
  const supabase = await createClient();
  const { data, error } = await fetchApplicationRowsForUser(supabase, viewer.userId);

  if (error) {
    throw toDataAccessError("getMyApplications", error);
  }

  return data.map((row) => toApplicantApplication(row));
});

/**
 * The signed-in applicant's application of one type, or null when they have not created it yet. Without a type it is
 * their first application type. Redirects signed-out users and organizers.
 */
export async function getMyApplication(type?: ApplicationType): Promise<ApplicantApplication | null> {
  const viewer = await requireApplicant();
  const target = type ?? primaryApplicationType(viewer);
  return (await getMyApplications()).find((application) => application.type === target) ?? null;
}
