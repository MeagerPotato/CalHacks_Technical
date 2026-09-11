import { ORGANIZER_COPY } from "@/content/copy";
import { ROUTES, organizerApplicationRoute } from "@/lib/routes";
import { toApplicationListSearchParams, type ApplicationListFilters } from "@/lib/validation/organizer";
import type { NavCurrent, OrganizerNavItemView } from "@/lib/view-models/organizer-types";

// =============================================================================
// Organizer navigation and URLs (client-safe, pure).
//
// The applications table keeps its filters in the query string, and the review workspace keeps blind mode and the
// "just reviewed" arrival notice in the query string, so reload, back, and shared links reproduce the same view.
// =============================================================================

/** `?identity=revealed` shows identifying details; any other value, or none, keeps blind review on. */
export const IDENTITY_QUERY_PARAM = "identity";
export const IDENTITY_REVEALED_VALUE = "revealed";

/** `?reviewed=H-1042` names the application reviewed just before arriving through Save review and continue. */
export const REVIEWED_QUERY_PARAM = "reviewed";

type SearchParamValue = string | string[] | undefined;

// Blind references are a type letter and the reference number (see lib/domain/applicant-identity.ts).
const APPLICANT_REFERENCE_PATTERN = /^[HJ]-\d{1,12}$/;

function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function currentFor(pathname: string, href: string, includeChildren: boolean): NavCurrent {
  const path = normalizePath(pathname);
  if (path === href) {
    return "page";
  }
  return includeChildren && path.startsWith(`${href}/`) ? "true" : null;
}

/**
 * Organizer navigation entries for the current path. The dashboard is current only on its own page; Applications is
 * the current page on the list and `aria-current="true"` inside a review workspace.
 */
export function toOrganizerNavItems(pathname: string | null): OrganizerNavItemView[] {
  const path = pathname ?? "";
  return [
    {
      id: "dashboard",
      label: ORGANIZER_COPY.nav.dashboard,
      href: ROUTES.organizer,
      current: currentFor(path, ROUTES.organizer, false),
    },
    {
      id: "applications",
      label: ORGANIZER_COPY.nav.applications,
      href: ROUTES.organizerApplications,
      current: currentFor(path, ROUTES.organizerApplications, true),
    },
  ];
}

/** The applications list URL for `filters`, omitting defaults (the same query string the page parses). */
export function applicationsHref(filters: Partial<ApplicationListFilters>): string {
  const query = toApplicationListSearchParams(filters).toString();
  return query ? `${ROUTES.organizerApplications}?${query}` : ROUTES.organizerApplications;
}

/** A review workspace URL, blind unless `revealIdentity` is true. */
export function reviewWorkspaceHref(
  applicationId: string,
  options: { revealIdentity?: boolean; reviewedReference?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (options.revealIdentity) {
    params.set(IDENTITY_QUERY_PARAM, IDENTITY_REVEALED_VALUE);
  }
  if (options.reviewedReference) {
    params.set(REVIEWED_QUERY_PARAM, options.reviewedReference);
  }
  const query = params.toString();
  const path = organizerApplicationRoute(applicationId);
  return query ? `${path}?${query}` : path;
}

/** True only for exactly `identity=revealed` (the first value when repeated). */
export function isIdentityRevealed(value: SearchParamValue): boolean {
  return firstValue(value) === IDENTITY_REVEALED_VALUE;
}

/** A well-formed blind reference from `?reviewed=`, or null. The value is only ever displayed, never looked up. */
export function parseReviewedReference(value: SearchParamValue): string | null {
  const candidate = firstValue(value);
  return typeof candidate === "string" && APPLICANT_REFERENCE_PATTERN.test(candidate) ? candidate : null;
}
