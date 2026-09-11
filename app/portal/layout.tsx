import { SignOutButton } from "@/app/_components/SignOutButton";
import { PortalShell } from "@/components/layout/PortalShell";
import { NavigationGuardProvider } from "@/lib/client/navigation-guard";
import { ROUTES } from "@/lib/routes";

/**
 * Portal frame. It performs no data reads: every page loads its own data, so a failed read renders the portal
 * error boundary inside this shell instead of replacing it. The guard provider lets internal links and sign-out
 * save a dirty application editor before leaving.
 */
export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <NavigationGuardProvider>
      <PortalShell homeHref={ROUTES.portal} actions={<SignOutButton />}>
        {children}
      </PortalShell>
    </NavigationGuardProvider>
  );
}
