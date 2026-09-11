import type { MouseEvent } from "react";

export interface SkipLinkProps {
  /** Id of the page's main landmark ("main" on every page). */
  targetId: string;
  label: string;
  /**
   * Handles activation in the browser. The root layout moves focus itself, so the link adds no fragment history entry.
   * Without a handler the link is a plain fragment link.
   */
  onActivate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/** The first focusable element on every page. It stays off screen until focused, then jumps to the main landmark. */
export function SkipLink({ targetId, label, onActivate }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      onClick={onActivate}
      className="fixed top-0 left-4 z-50 -translate-y-full rounded-control border-2 border-border bg-surface px-4 py-2 font-semibold text-ink focus:translate-y-4"
    >
      {label}
    </a>
  );
}
