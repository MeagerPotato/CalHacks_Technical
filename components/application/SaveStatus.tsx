import { Check, CircleAlert, CircleDot, Info, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";

import { Timestamp } from "@/components/ui/Timestamp";
import type { SaveStatusState, SaveStatusView, TimestampView } from "@/lib/view-models/types";

/** State icons. They are decorative: the state is always in the visible text. */
const STATE_ICONS = {
  saved: Check,
  saving: LoaderCircle,
  dirty: CircleDot,
  invalid: CircleAlert,
  error: TriangleAlert,
  blocked: Info,
} as const satisfies Record<SaveStatusState, LucideIcon>;

export interface SaveStatusProps {
  view: SaveStatusView;
  /** Server-formatted time of the last save. Shown only in the saved state. */
  lastSaved: TimestampView | null;
  /** Text before the time, for example "Last saved". */
  lastSavedPrefix: string;
}

/**
 * The visible save indicator, with `data-state`. It is deliberately not a live region: `LiveStatus` announces saves,
 * so screen readers never hear the same change twice.
 */
export function SaveStatus({ view, lastSaved, lastSavedPrefix }: SaveStatusProps) {
  const Icon = STATE_ICONS[view.state];
  const showLastSaved = view.state === "saved" && lastSaved !== null;

  return (
    <p
      data-testid="save-status"
      data-state={view.state}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink"
    >
      {/* The spinner turns only when motion is allowed; under reduced motion it stays still. */}
      <Icon
        aria-hidden="true"
        className={view.state === "saving" ? "size-4 shrink-0 motion-safe:animate-spin" : "size-4 shrink-0"}
      />
      <span className="font-semibold">{view.text}</span>
      {showLastSaved ? (
        <>
          {" "}
          <Timestamp value={lastSaved} prefix={lastSavedPrefix} fallback="" />
        </>
      ) : null}
    </p>
  );
}
