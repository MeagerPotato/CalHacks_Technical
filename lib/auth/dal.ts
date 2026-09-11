import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import {
  isApplicantViewer,
  isOrganizerViewer,
  type ApplicantViewer,
  type OrganizerViewer,
  type Viewer,
} from "@/lib/auth/types";
import { toDataAccessError } from "@/lib/data/errors";
import { ROUTES, getHomeRouteForRole } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/supabase/types";

/**
 * Resolves the signed-in user for a Supabase client.
 *
 * - Identity comes from getClaims(), which verifies the session JWT (locally with asymmetric
 *   signing keys, or with the Auth server for symmetric keys).
 * - The role is read from public.profiles, never from user-editable auth metadata.
 *
 * Returns null when signed out. Throws DataAccessError when the profile query fails.
 */
export async function loadViewer(supabase: TypedSupabaseClient): Promise<Viewer | null> {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, account_role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw toDataAccessError("loadViewer", error);
  }

  if (!profile) {
    return null;
  }

  return {
    userId: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    accountRole: profile.account_role,
    isOrganizer: profile.account_role === "organizer",
  };
}

/** Current viewer for Server Components, deduplicated per request. Null when signed out. */
export const getViewer = cache(async (): Promise<Viewer | null> => loadViewer(await createClient()));

/** Server Component guard: redirects to /login when signed out. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(ROUTES.login);
  }
  return viewer;
}

/** Server Component guard for Hacker/Judge pages. Organizers are sent to their home. */
export async function requireApplicant(): Promise<ApplicantViewer> {
  const viewer = await requireViewer();
  if (!isApplicantViewer(viewer)) {
    redirect(getHomeRouteForRole(viewer.accountRole));
  }
  return viewer;
}

/** Server Component guard for organizer pages. Applicants are sent to their home. */
export async function requireOrganizer(): Promise<OrganizerViewer> {
  const viewer = await requireViewer();
  if (!isOrganizerViewer(viewer)) {
    redirect(getHomeRouteForRole(viewer.accountRole));
  }
  return viewer;
}
