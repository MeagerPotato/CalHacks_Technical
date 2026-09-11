import type { AccountRole } from "@/lib/domain/enums";

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
