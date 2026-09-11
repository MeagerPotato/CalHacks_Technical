import { Card } from "@/components/ui/Card";
import type { BreakdownTypeView } from "@/lib/view-models/organizer-types";

export interface StatusBreakdownProps {
  title: string;
  types: readonly BreakdownTypeView[];
}

/**
 * Applications per type and status as text with simple bars (no chart library). Each row reads as its status label
 * and "count of total"; the bar is decorative (`aria-hidden`) and its width is the share of the type's total.
 */
export function StatusBreakdown({ title, types }: StatusBreakdownProps) {
  return (
    <Card labelledBy="status-breakdown-title" data-testid="status-breakdown">
      <div className="flex flex-col gap-5">
        <h2 id="status-breakdown-title" className="text-xl font-bold">
          {title}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {types.map((entry) => (
            <div key={entry.type} data-type={entry.type} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="text-lg font-bold">{entry.label}</h3>
                <p className="text-sm">{entry.totalText}</p>
              </div>
              <ul role="list" className="flex flex-col gap-3">
                {entry.rows.map((row) => (
                  <li key={row.status} data-status={row.status} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-semibold">{row.label}</span>
                      <span className="text-sm">{row.countText}</span>
                    </div>
                    <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded-full border-2 border-border bg-surface">
                      <div className="h-full bg-success" style={{ width: `${row.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
