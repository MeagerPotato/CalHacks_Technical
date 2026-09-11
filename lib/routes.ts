import type { AccountRole, ApplicationType } from "@/lib/domain/enums";

/** Route paths from PROJECT_PLAN.md section 4. Pages are implemented in the frontend phase. */
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  authCallback: "/auth/callback",
  onboarding: "/onboarding",
  portal: "/portal",
  portalApplication: "/portal/application",
  portalMission: "/portal/mission",
  organizer: "/organizer",
  organizerApplications: "/organizer/applications",
} as const;

export function organizerApplicationRoute(applicationId: string): string {
  return `${ROUTES.organizerApplications}/${encodeURIComponent(applicationId)}`;
}

/** Search parameter naming which of an applicant's applications a portal page shows. */
export const APPLICATION_TYPE_PARAM = "type";

/** Portal dashboard for one application: `/portal?type=<type>`. */
export function portalRoute(type: ApplicationType): string {
  return `${ROUTES.portal}?${APPLICATION_TYPE_PARAM}=${type}`;
}

/** Editor, or the read-only submitted application, for one application: `/portal/application?type=<type>`. */
export function portalApplicationRoute(type: ApplicationType): string {
  return `${ROUTES.portalApplication}?${APPLICATION_TYPE_PARAM}=${type}`;
}

/** Rocket Mission Tracker for one application: `/portal/mission?type=<type>`. */
export function portalMissionRoute(type: ApplicationType): string {
  return `${ROUTES.portalMission}?${APPLICATION_TYPE_PARAM}=${type}`;
}

export interface ResolvedApplicationType {
  type: ApplicationType;
  /** False when the URL named something other than one of the account's applications, so the page should redirect. */
  canonical: boolean;
}

/**
 * Chooses the application a portal page shows from its raw `type` search parameter.
 *
 * - Missing: the account's first application type.
 * - Exactly one of the account's application types: that type.
 * - Anything else (an unknown type, a type the account does not apply for, or a repeated parameter): the first type,
 *   marked non-canonical.
 *
 * Returns null when the account applies for nothing, as organizers do. Membership is checked against the list, never
 * with an object-key lookup.
 */
export function resolveApplicationType(
  applicationTypes: readonly ApplicationType[],
  raw: unknown,
): ResolvedApplicationType | null {
  const [first] = applicationTypes;
  if (first === undefined) {
    return null;
  }
  if (raw === undefined) {
    return { type: first, canonical: true };
  }
  const match = typeof raw === "string" ? applicationTypes.find((type) => type === raw) : undefined;
  return match === undefined ? { type: first, canonical: false } : { type: match, canonical: true };
}

/** Where a signed-in user should land by default. */
export function getHomeRouteForRole(role: AccountRole): string {
  return role === "organizer" ? ROUTES.organizer : ROUTES.portal;
}

/** Paths that require a session. Used by proxy.ts for an optimistic redirect only. */
export const PROTECTED_ROUTE_PREFIXES = [ROUTES.onboarding, ROUTES.portal, ROUTES.organizer] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a same-origin relative path, or the fallback. Prevents open redirects through
 * user-controlled "next" parameters (rejects absolute URLs, protocol-relative "//" and "/\",
 * backslashes, and control characters).
 */
export function getSafeRedirectPath(candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 2048) {
    return fallback;
  }
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  if (hasControlCharacters(candidate)) {
    return fallback;
  }
  return candidate;
}
