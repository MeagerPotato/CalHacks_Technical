import type { AccountRole, PublicAccountRole } from "@/lib/domain/enums";

/** The signed-in user as seen by the application. Role comes from public.profiles only. */
export interface Viewer {
  userId: string;
  email: string;
  displayName: string | null;
  accountRole: AccountRole;
  isOrganizer: boolean;
}

export interface ApplicantViewer extends Viewer {
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
