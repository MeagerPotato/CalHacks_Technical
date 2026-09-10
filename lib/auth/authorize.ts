import "server-only";

import { logServerError } from "@/lib/actions/errors";
import { fail, type ActionFailure } from "@/lib/actions/result";
import { loadViewer } from "@/lib/auth/dal";
import {
  isApplicantViewer,
  isOrganizerViewer,
  type ApplicantViewer,
  type OrganizerViewer,
  type Viewer,
} from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/supabase/types";

export interface Authorized<V extends Viewer> {
  ok: true;
  supabase: TypedSupabaseClient;
  viewer: V;
}

/**
 * Server Action authorization. Every action calls one of these first because each action is
 * a public POST endpoint; route guards and layouts are not a security boundary.
 */
export async function authorizeAction(): Promise<Authorized<Viewer> | ActionFailure> {
  try {
    const supabase = await createClient();
    const viewer = await loadViewer(supabase);
    if (!viewer) {
      return fail("unauthenticated");
    }
    return { ok: true, supabase, viewer };
  } catch (error) {
    logServerError("authorizeAction", error);
    return fail("unexpected_error");
  }
}

export async function authorizeApplicantAction(): Promise<Authorized<ApplicantViewer> | ActionFailure> {
  const result = await authorizeAction();
  if (!result.ok) {
    return result;
  }
  if (!isApplicantViewer(result.viewer)) {
    return fail("forbidden");
  }
  return { ok: true, supabase: result.supabase, viewer: result.viewer };
}

export async function authorizeOrganizerAction(): Promise<Authorized<OrganizerViewer> | ActionFailure> {
  const result = await authorizeAction();
  if (!result.ok) {
    return result;
  }
  if (!isOrganizerViewer(result.viewer)) {
    return fail("forbidden");
  }
  return { ok: true, supabase: result.supabase, viewer: result.viewer };
}
