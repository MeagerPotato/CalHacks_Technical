import { SignOutButton } from "@/app/_components/SignOutButton";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { requireOrganizer } from "@/lib/auth/dal";
import { NavigationGuardProvider } from "@/lib/client/navigation-guard";
import { ROUTES } from "@/lib/routes";

import { OrganizerNavigation } from "./_components/OrganizerNavigation";

/**
 * Organizer frame. The guard runs here as well as in every page, so a signed-out visitor is sent to sign in and an
 * applicant to the portal before any organizer markup is sent. The layout reads no organizer data: each page loads
 * its own, so a failed read renders the organizer error boundary inside this shell. The guard provider lets internal
 * links and sign-out save a dirty review before leaving.
 */
export default async function OrganizerLayout({ children }: LayoutProps<"/organizer">) {
  await requireOrganizer();

  return (
    <NavigationGuardProvider>
      <OrganizerShell homeHref={ROUTES.organizer} nav={<OrganizerNavigation />} actions={<SignOutButton />}>
        {children}
      </OrganizerShell>
    </NavigationGuardProvider>
  );
}
