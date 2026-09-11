import type { ReactNode } from "react";

import { BrandMark } from "@/components/art/BrandMark";
import { AppLink } from "@/components/ui/AppLink";

export interface OrganizerShellProps {
  /** Where the brand wordmark links: the Mission Control dashboard. */
  homeHref: string;
  /** Organizer navigation, usually `OrganizerNav`. */
  nav: ReactNode;
  /** Header controls, for example the sign-out button. */
  actions: ReactNode;
  children: ReactNode;
}

/**
 * Frame for every organizer page: a header with the home link, the organizer navigation, and the actions, then the
 * page's single `main#main`. The content container is wider than the portal's so the table and the two-column review
 * workspace fit. Pages render their own `h1`.
 */
export function OrganizerShell({ homeHref, nav, actions, children }: OrganizerShellProps) {
  return (
    <>
      <header data-testid="organizer-header" className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <AppLink href={homeHref} variant="plain">
            <BrandMark />
          </AppLink>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {nav}
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="mx-auto w-full max-w-7xl px-4 py-8">{children}</div>
      </main>
    </>
  );
}
