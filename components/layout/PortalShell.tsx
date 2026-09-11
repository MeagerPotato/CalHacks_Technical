import type { ReactNode } from "react";

import { LaunchpadMark } from "@/components/art/LaunchpadMark";
import { AppLink } from "@/components/ui/AppLink";

export interface PortalShellProps {
  /** Where the Launchpad wordmark links, usually the portal dashboard. */
  homeHref: string;
  /** Header controls, for example the sign-out button. */
  actions: ReactNode;
  children: ReactNode;
}

/**
 * Frame for every applicant portal page: a header with the Launchpad home link and the actions, then the page's
 * single `main#main` wrapping the page content in a centered container. Pages render their own `h1`.
 */
export function PortalShell({ homeHref, actions, children }: PortalShellProps) {
  return (
    <>
      <header className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <AppLink href={homeHref} variant="plain">
            <LaunchpadMark />
          </AppLink>
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="mx-auto w-full max-w-5xl px-4 py-8">{children}</div>
      </main>
    </>
  );
}
