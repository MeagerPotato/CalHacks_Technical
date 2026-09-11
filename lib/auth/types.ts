import type { AccountRole, ApplicationType, PublicAccountRole } from "@/lib/domain/enums";

/** The signed-in user as seen by the application. Role and application types come from public.profiles only. */
export interface Viewer {
  userId: string;
  email: string;
  displayName: string | null;
  accountRole: AccountRole;
  /** Applications the account applies for, in form order (Hacker before Judge). Empty for organizers. */
  applicationTypes: readonly ApplicationType[];
  isOrganizer: boolean;
}

export interface ApplicantViewer extends Viewer {
  /** Always the first of `applicationTypes`. */
  accountRole: PublicAccountRole;
  isOrganizer: false;
}

export interface OrganizerViewer extends Viewer {
  accountRole: "organizer";
  isOrganizer: true;
}

export function isApplicantViewer(viewer: Viewer): viewer is ApplicantViewer {
  return viewer.accountRole === "hacker" || viewer.accountRole === "judge";
}

export function isOrganizerViewer(viewer: Viewer): viewer is OrganizerViewer {
  return viewer.accountRole === "organizer";
}

/** The application portal pages show when none is chosen: the applicant's first application type. */
export function primaryApplicationType(viewer: ApplicantViewer): ApplicationType {
  return viewer.applicationTypes[0] ?? viewer.accountRole;
}
