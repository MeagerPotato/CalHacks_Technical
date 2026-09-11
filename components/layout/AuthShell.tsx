import type { ReactNode } from "react";

import { LaunchpadMark } from "@/components/art/LaunchpadMark";
import { AppLink } from "@/components/ui/AppLink";
import { ROUTES } from "@/lib/routes";

export interface AuthShellProps {
  /** The page `h1`. */
  title: string;
  description?: string;
  children: ReactNode;
  /** Shown under the page content, for example a link to the other auth page. */
  footer?: ReactNode;
  /** Header controls, for example the sign-out button on onboarding. */
  actions?: ReactNode;
}

/**
 * Frame for the sign-in, sign-up, and onboarding pages: a header with the Launchpad home link and optional actions,
 * then the page's single `main#main` with its `h1`.
 */
export function AuthShell({ title, description, children, footer, actions }: AuthShellProps) {
  return (
    <>
      <header className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <AppLink href={ROUTES.home} variant="plain">
            <LaunchpadMark />
          </AppLink>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="flex flex-col gap-6">{children}</div>
        {footer ? <div className="border-t-2 border-border pt-6">{footer}</div> : null}
      </main>
    </>
  );
}
