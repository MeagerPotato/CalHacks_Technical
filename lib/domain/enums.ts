import type { Database } from "@/types/database";

type DatabaseEnums = Database["public"]["Enums"];

/** System authorization roles. */
export const ACCOUNT_ROLES = ["hacker", "judge", "organizer"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/** Roles a public signup may request. Organizer is never self-selectable. */
export const PUBLIC_ACCOUNT_ROLES = ["hacker", "judge"] as const;
export type PublicAccountRole = (typeof PUBLIC_ACCOUNT_ROLES)[number];

/** Application forms. An applicant's type always equals their account role. */
export const APPLICATION_TYPES = ["hacker", "judge"] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

/** draft -> submitted -> in_review -> accepted | waitlisted */
export const APPLICATION_STATUSES = ["draft", "submitted", "in_review", "accepted", "waitlisted"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Official outcomes an organizer can release. There is no rejected state. */
export const DECISION_STATUSES = ["accepted", "waitlisted"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** Reviewer recommendation. Distinct from the official decision. */
export const RECOMMENDATIONS = ["strong_yes", "yes", "maybe", "no"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export function isApplicantRole(role: AccountRole): role is PublicAccountRole {
  return role === "hacker" || role === "judge";
}

export function isDecisionStatus(status: ApplicationStatus): status is DecisionStatus {
  return status === "accepted" || status === "waitlisted";
}

// Compile-time drift guard: the unions above must equal the generated database enums.
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type EnumDriftGuard = [
  Assert<Exact<AccountRole, DatabaseEnums["account_role"]>>,
  Assert<Exact<ApplicationType, DatabaseEnums["application_type"]>>,
  Assert<Exact<ApplicationStatus, DatabaseEnums["application_status"]>>,
  Assert<Exact<Recommendation, DatabaseEnums["recommendation"]>>,
];
