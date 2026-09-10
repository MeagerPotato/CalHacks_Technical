"use server";

import { revalidatePath } from "next/cache";

import { failFromAuth, failFromDatabase, logServerError } from "@/lib/actions/errors";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { ProfileUpdateData, SignInData, SignOutData, SignUpData } from "@/lib/actions/types";
import { authorizeAction } from "@/lib/auth/authorize";
import { loadViewer } from "@/lib/auth/dal";
import type { Viewer } from "@/lib/auth/types";
import { ROUTES, getHomeRouteForRole, getSafeRedirectPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import {
  profileUpdateSchema,
  signInSchema,
  signUpSchema,
  type ProfileUpdateInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation/auth";
import { toFieldErrors, toFormErrors } from "@/lib/validation/errors";
import { toPlainInput } from "@/lib/validation/form-data";

function isPathAllowedForRole(path: string, viewer: Viewer): boolean {
  const pathname = path.split(/[?#]/)[0];
  const isOrganizerPath = pathname === ROUTES.organizer || pathname.startsWith(`${ROUTES.organizer}/`);
  return viewer.isOrganizer ? !pathname.startsWith(ROUTES.portal) && pathname !== ROUTES.onboarding : !isOrganizerPath;
}

/**
 * Creates a Hacker or Judge account with email and password.
 * Organizer can never be requested: Zod rejects it here and the database signup trigger
 * rejects it for any client that bypasses this action.
 */
export async function signUp(input: SignUpInput | FormData): Promise<ActionResult<SignUpData>> {
  const parsed = signUpSchema.safeParse(toPlainInput(input));
  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: toFieldErrors(parsed.error),
      formErrors: toFormErrors(parsed.error),
    });
  }

  const { email, password, accountRole, displayName } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        account_role: accountRole,
        ...(displayName ? { display_name: displayName } : {}),
      },
    },
  });

  if (error) {
    return failFromAuth("signUp", error);
  }

  if (!data.session) {
    // Email confirmation is enabled for this project; the user must confirm before signing in.
    return ok({ viewer: null, requiresEmailConfirmation: true, redirectTo: ROUTES.login });
  }

  try {
    const viewer = await loadViewer(supabase);
    if (!viewer) {
      return fail("unexpected_error");
    }
    revalidatePath("/", "layout");
    return ok({ viewer, requiresEmailConfirmation: false, redirectTo: ROUTES.onboarding });
  } catch (loadError) {
    logServerError("signUp:loadViewer", loadError);
    return fail("unexpected_error");
  }
}

/** Signs in with email and password. `next` is honored only for safe, role-appropriate paths. */
export async function signIn(input: SignInInput | FormData): Promise<ActionResult<SignInData>> {
  const parsed = signInSchema.safeParse(toPlainInput(input));
  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: toFieldErrors(parsed.error),
      formErrors: toFormErrors(parsed.error),
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return failFromAuth("signIn", error);
  }

  try {
    const viewer = await loadViewer(supabase);
    if (!viewer) {
      await supabase.auth.signOut();
      return fail("unexpected_error");
    }

    const home = getHomeRouteForRole(viewer.accountRole);
    const requested = getSafeRedirectPath(parsed.data.next, home);

    revalidatePath("/", "layout");
    return ok({ viewer, redirectTo: isPathAllowedForRole(requested, viewer) ? requested : home });
  } catch (loadError) {
    logServerError("signIn:loadViewer", loadError);
    return fail("unexpected_error");
  }
}

/** Signs out this browser session (other devices stay signed in). */
export async function signOut(): Promise<ActionResult<SignOutData>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    return failFromAuth("signOut", error);
  }

  revalidatePath("/", "layout");
  return ok({ redirectTo: ROUTES.login });
}

/** Updates the signed-in user's display name (the only client-editable profile field). */
export async function updateProfile(input: ProfileUpdateInput | FormData): Promise<ActionResult<ProfileUpdateData>> {
  const auth = await authorizeAction();
  if (!auth.ok) {
    return auth;
  }

  const parsed = profileUpdateSchema.safeParse(toPlainInput(input));
  if (!parsed.success) {
    return fail("validation_failed", {
      fieldErrors: toFieldErrors(parsed.error),
      formErrors: toFormErrors(parsed.error),
    });
  }

  const { data, error } = await auth.supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", auth.viewer.userId)
    .select("display_name")
    .maybeSingle();

  if (error) {
    return failFromDatabase("updateProfile", error);
  }
  if (!data) {
    return fail("not_found");
  }

  revalidatePath("/", "layout");
  return ok({ viewer: { ...auth.viewer, displayName: data.display_name } });
}
