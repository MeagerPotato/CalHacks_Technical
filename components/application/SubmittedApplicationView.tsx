import type { ReactNode } from "react";

import { AnswerSummary } from "@/components/application/AnswerSummary";
import { AppLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/Badge";
import { Timestamp } from "@/components/ui/Timestamp";
import type { ApplicationStatus } from "@/lib/domain/enums";
import type { AnswerSectionView, TimestampView } from "@/lib/view-models/types";

export interface SubmittedApplicationViewProps {
  heading: string;
  status: ApplicationStatus;
  /** Status display text, usually from `APPLICATION_STATUS_LABELS`. */
  statusLabel: string;
  /** Server-formatted submission time. Nothing renders when it is null. */
  launched: TimestampView | null;
  /** Text before the submission time, for example "Launched". */
  launchedPrefix: string;
  trackLabel: string;
  trackHref: string;
  /** Answer sections. Edit links are always dropped, because this view is read-only. */
  sections: readonly AnswerSectionView[];
  /** Optional notice slot, for example the locked notice raised by a save that arrived after submission. */
  notice?: ReactNode;
}

/**
 * The read-only submitted application: heading, status, launch time, a link to the mission tracker, and every
 * answer.
 */
export function SubmittedApplicationView({
  heading,
  status,
  statusLabel,
  launched,
  launchedPrefix,
  trackLabel,
  trackHref,
  sections,
  notice,
}: SubmittedApplicationViewProps) {
  // Read-only whatever the caller passes: a submitted application never offers edit links.
  const readOnlySections = sections.map((section) => ({ ...section, editLabel: null, editHref: null }));

  return (
    <div data-testid="submitted-application" className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-3xl font-bold">{heading}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusBadge status={status} label={statusLabel} />
          {launched ? <Timestamp value={launched} prefix={launchedPrefix} fallback="" /> : null}
        </div>
      </div>
      {notice}
      <div>
        <AppLink href={trackHref} variant="primary">
          {trackLabel}
        </AppLink>
      </div>
      {/* Section headings are h2 here because they sit directly under the page h1. */}
      <AnswerSummary sections={readOnlySections} headingLevel={2} />
    </div>
  );
}
