import { AppLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Timestamp } from "@/components/ui/Timestamp";
import type { LinkView } from "@/lib/view-models/types";
import type { ApplicationRowView } from "@/lib/view-models/organizer-types";

export interface RecentSubmissionsProps {
  title: string;
  rows: readonly ApplicationRowView[];
  /** Shown instead of the list when nothing has been submitted. */
  emptyText: string | null;
  viewAll: LinkView;
}

/**
 * The most recent submissions. Each entry links to its review workspace by blind reference (no applicant name on the
 * dashboard) and shows the type, status badge, and submitted time.
 */
export function RecentSubmissions({ title, rows, emptyText, viewAll }: RecentSubmissionsProps) {
  return (
    <Card labelledBy="recent-submissions-title" data-testid="recent-submissions">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="recent-submissions-title" className="text-xl font-bold">
            {title}
          </h2>
          <AppLink href={viewAll.href}>{viewAll.label}</AppLink>
        </div>
        {rows.length > 0 ? (
          <ul role="list" className="flex flex-col divide-y-2 divide-border">
            {rows.map((row) => (
              <li
                key={row.id}
                data-testid={`recent-submission-${row.id}`}
                data-status={row.status}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
              >
                <div className="flex flex-col">
                  <AppLink href={row.href}>{row.referenceLabel}</AppLink>
                  <span className="text-sm">{row.typeLabel}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={row.status} label={row.statusLabel} />
                  <span className="text-sm">
                    <Timestamp value={row.submitted} fallback={row.submittedFallback} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>{emptyText}</p>
        )}
      </div>
    </Card>
  );
}
