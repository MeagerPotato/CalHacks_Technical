import type { ReactNode } from "react";

import type { ReviewAccess } from "@/lib/data/types";

export interface ReviewWorkspaceLayoutProps {
  isBlind: boolean;
  access: ReviewAccess;
  /** `WorkspaceHeader`. */
  header: ReactNode;
  /** Page notices; the wrapper renders only when present. */
  notices?: ReactNode;
  /** `IdentityPanel` while identity is revealed. */
  identity?: ReactNode;
  /** `NarrativePanel`. */
  narrative: ReactNode;
  /** `Scorecard`. */
  scorecard: ReactNode;
  /** `DecisionRelease`. */
  decision?: ReactNode;
  /** A `LiveStatus` region, kept mounted by the container. */
  status?: ReactNode;
}

/**
 * Review workspace frame: `div[data-testid=review-workspace]` with `data-blind` and `data-access`, the header, the
 * notices, then a wide left column (identity and narrative) and a right column (scorecard and decision) that sticks
 * to the top of the viewport from the `lg` breakpoint. Below `lg` the columns stack in that order.
 */
export function ReviewWorkspaceLayout({
  isBlind,
  access,
  header,
  notices,
  identity,
  narrative,
  scorecard,
  decision,
  status,
}: ReviewWorkspaceLayoutProps) {
  return (
    <div
      data-testid="review-workspace"
      data-blind={isBlind ? "true" : "false"}
      data-access={access}
      className="flex w-full flex-col gap-6"
    >
      {header}
      {notices ? (
        <div data-testid="workspace-notices" className="flex flex-col gap-3">
          {notices}
        </div>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div data-testid="workspace-narrative-column" className="flex min-w-0 flex-col gap-6">
          {identity}
          {narrative}
        </div>
        <div data-testid="workspace-scorecard-column" className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-4">
          {scorecard}
          {decision}
        </div>
      </div>
      {status}
    </div>
  );
}
