import { LOCKED } from "@/content/copy";

/**
 * The Launchpad wordmark placeholder. The brand text stays visible and accessible, so a link wrapping the mark is
 * named "Launchpad". Astra replaces the decorative badge.
 */
export function LaunchpadMark() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-xl font-bold text-ink">
      <span
        aria-hidden="true"
        className="pointer-events-none inline-block aspect-square size-6 shrink-0 rounded-full border-2 border-border bg-action"
      />
      {LOCKED.brand}
    </span>
  );
}
