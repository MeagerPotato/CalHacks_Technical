import type { Ref } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import { Timestamp } from "@/components/ui/Timestamp";
import type { BlindModeView, WorkspaceHeaderView } from "@/lib/view-models/organizer-types";

export interface WorkspaceHeaderProps {
  header: WorkspaceHeaderView;
  blind: BlindModeView;
  /** Toggles blind mode in place. Without it the toggle is a link to `blind.toggleHref`. */
  onToggleIdentity?: () => void;
  /** Marks the toggle pending while identity loads or hides. */
  identityPending?: boolean;
  /** The `h1`, focusable with `tabIndex={-1}` for arrival focus. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/**
 * Review workspace header: back-to-list and Next application links, the `h1#workspace-heading` with type, status, and
 * submitted time, the review queue meter, and the blind-mode bar (`data-testid="blind-mode"`, `data-blind`) with its
 * status text (`#blind-mode-status`) and a reversible toggle described by that text.
 */
export function WorkspaceHeader({ header, blind, onToggleIdentity, identityPending = false, headingRef }: WorkspaceHeaderProps) {
  return (
    <div data-testid="workspace-header" className="flex flex-col gap-5 rounded-card border-2 border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AppLink href={header.back.href} data-testid="back-to-applications">
          {header.back.label}
        </AppLink>
        {header.next ? (
          <AppLink href={header.next.href} variant="secondary" data-testid="next-application">
            {header.next.label}
          </AppLink>
        ) : null}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 id="workspace-heading" ref={headingRef} tabIndex={-1} className="text-4xl font-extrabold sm:text-5xl">
            {header.heading}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{header.typeLabel}</Badge>
            <StatusBadge status={header.status} label={header.statusLabel} />
            <span className="text-sm">
              <Timestamp value={header.submitted} prefix={header.submittedPrefix} fallback={header.notSubmittedText} />
            </span>
          </div>
        </div>
        <div data-testid="workspace-queue" className="flex w-full max-w-sm flex-col gap-1">
          <ProgressMeter
            id="workspace-queue-progress"
            value={header.queue.percent}
            label={header.queue.label}
            valueText={header.queue.valueText}
          />
          <p className="text-sm">{header.queue.remainingText}</p>
        </div>
      </div>
      <div
        data-testid="blind-mode"
        data-blind={blind.isBlind ? "true" : "false"}
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-border p-4 data-[blind=false]:bg-highlight data-[blind=false]:text-ink data-[blind=true]:bg-dark data-[blind=true]:text-on-dark data-[blind=true]:[&_:focus-visible]:outline-focus-on-dark"
      >
        <p id="blind-mode-status" className="font-semibold">
          {blind.statusText}
        </p>
        {onToggleIdentity ? (
          <Button
            variant="secondary"
            pending={identityPending}
            onClick={() => onToggleIdentity()}
            aria-describedby="blind-mode-status"
            data-testid="identity-toggle"
          >
            {blind.toggleLabel}
          </Button>
        ) : (
          <AppLink
            href={blind.toggleHref}
            variant="secondary"
            aria-describedby="blind-mode-status"
            data-testid="identity-toggle"
          >
            {blind.toggleLabel}
          </AppLink>
        )}
      </div>
    </div>
  );
}
