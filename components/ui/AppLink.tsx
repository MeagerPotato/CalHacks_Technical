import { ExternalLink } from "lucide-react";
import type { AnchorHTMLAttributes, MouseEventHandler, ReactNode } from "react";

import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { COPY } from "@/content/copy";
import { GuardedLink } from "@/lib/client/navigation-guard";

export type AppLinkVariant = "inline" | "primary" | "secondary" | "quiet" | "plain";

const BUTTON_LIKE_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border-2 px-4 py-2 font-semibold no-underline";

/** Link styles. Astra may restyle them but must keep the keys and the contrast rules (navy text on coral). */
export const LINK_VARIANT_CLASSES = {
  inline: "font-semibold text-ink underline underline-offset-4",
  primary: `${BUTTON_LIKE_CLASSES} border-border bg-action text-on-action`,
  secondary: `${BUTTON_LIKE_CLASSES} border-border bg-surface text-ink`,
  quiet: "inline-flex min-h-11 items-center gap-2 font-semibold text-ink underline underline-offset-4",
  // A 44px target with no underline, for links whose content is not text, such as the header wordmark.
  plain: "inline-flex min-h-11 items-center gap-2 text-ink no-underline",
} as const satisfies Record<AppLinkVariant, string>;

export interface AppLinkProps {
  href: string;
  children: ReactNode;
  variant?: AppLinkVariant;
  /** Opens in a new tab with `rel="noopener noreferrer"` and an announced "(opens in a new tab)" suffix. */
  newTab?: boolean;
  id?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  "aria-current"?: AnchorHTMLAttributes<HTMLAnchorElement>["aria-current"];
  "aria-describedby"?: string;
  "data-testid"?: string;
}

// Protocol-relative URLs ("//host") leave the site, so only single-slash paths count as internal.
function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/**
 * A real anchor. Internal paths use `GuardedLink`, so they respect the unsaved-changes guard inside a
 * `NavigationGuardProvider`; other hrefs render a plain `<a>`.
 */
export function AppLink({
  href,
  children,
  variant = "inline",
  newTab = false,
  id,
  onClick,
  "aria-current": ariaCurrent,
  "aria-describedby": describedBy,
  "data-testid": testId,
}: AppLinkProps) {
  const shared = {
    id,
    onClick,
    className: LINK_VARIANT_CLASSES[variant],
    "aria-current": ariaCurrent,
    "aria-describedby": describedBy,
    "data-testid": testId,
  };

  if (newTab) {
    return (
      <a {...shared} href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink aria-hidden="true" className="inline-block size-4 shrink-0" />
        <VisuallyHidden>{` ${COPY.common.opensInNewTab}`}</VisuallyHidden>
      </a>
    );
  }

  if (isInternalHref(href)) {
    return (
      <GuardedLink {...shared} href={href}>
        {children}
      </GuardedLink>
    );
  }

  return (
    <a {...shared} href={href}>
      {children}
    </a>
  );
}
