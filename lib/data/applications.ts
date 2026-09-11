import "server-only";

import { cache } from "react";

import { requireApplicant } from "@/lib/auth/dal";
import { toDataAccessError } from "@/lib/data/errors";
import { APPLICATION_SELECT, toApplicantApplication } from "@/lib/data/mappers";
import type { ApplicantApplication } from "@/lib/data/types";
import { createClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Query helpers (take an explicit client; RLS applies to every query)
// ---------------------------------------------------------------------------

export function fetchApplicationRowForUser(supabase: TypedSupabaseClient, userId: string) {
  return supabase.from("applications").select(APPLICATION_SELECT).eq("user_id", userId).maybeSingle();
}

export function fetchApplicationRowById(supabase: TypedSupabaseClient, applicationId: string) {
  return supabase.from("applications").select(APPLICATION_SELECT).eq("id", applicationId).maybeSingle();
}

// ---------------------------------------------------------------------------
// Server Component reads
// ---------------------------------------------------------------------------

/**
 * The signed-in applicant's application with completion and mission state, or null when
 * they have not created one yet. Redirects signed-out users and organizers.
 */
export const getMyApplication = cache(async (): Promise<ApplicantApplication | null> => {
  const viewer = await requireApplicant();
  const supabase = await createClient();
  const { data, error } = await fetchApplicationRowForUser(supabase, viewer.userId);

  if (error) {
    throw toDataAccessError("getMyApplication", error);
  }

  return data ? toApplicantApplication(data) : null;
});
