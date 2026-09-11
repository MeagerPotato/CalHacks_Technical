import { ExpertiseRadar } from "@/components/organizer/ExpertiseRadar";
import { Sticker } from "@/components/art/Sticker";
import { KpiCards } from "@/components/organizer/KpiCards";
import { QueueProgressCard } from "@/components/organizer/QueueProgressCard";
import { RecentSubmissions } from "@/components/organizer/RecentSubmissions";
import { StatusBreakdown } from "@/components/organizer/StatusBreakdown";
import { AppLink } from "@/components/ui/AppLink";
import { Notice } from "@/components/ui/Notice";
import type { DashboardView } from "@/lib/view-models/organizer-types";

export interface MissionControlDashboardProps {
  view: DashboardView;
}

/**
 * The Mission Control dashboard page content: the `h1`, the Start reviewing link when an application needs review,
 * an empty-state notice before any submission, then the key numbers, queue progress, status breakdown, Expertise
 * Radar, and recent submissions. The root carries `data-empty`.
 */
export function MissionControlDashboard({ view }: MissionControlDashboardProps) {
  return (
    <div data-testid="organizer-dashboard" data-empty={view.empty ? "true" : "false"} className="flex w-full flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-5 rounded-card border-2 border-border bg-dark p-5 text-on-dark shadow-card sm:p-7" data-surface="dark">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-4xl font-extrabold sm:text-5xl">{view.heading}</h1>
          <p>{view.intro}</p>
          <span aria-hidden="true" className="mt-1"><Sticker name="antenna" /></span>
        </div>
        {view.queue.startReviewing ? (
          <AppLink href={view.queue.startReviewing.href} variant="primary" data-testid="start-reviewing">
            {view.queue.startReviewing.label}
          </AppLink>
        ) : null}
      </div>
      {view.empty ? (
        <Notice id="dashboard-empty" tone="info" title={view.empty.title}>
          {view.empty.body}
        </Notice>
      ) : null}
      <KpiCards title={view.kpisTitle} kpis={view.kpis} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <QueueProgressCard title={view.queue.title} progress={view.queue.progress} emptyText={view.queue.emptyText} />
        <StatusBreakdown title={view.breakdown.title} types={view.breakdown.types} />
      </div>
      <ExpertiseRadar radar={view.radar} />
      <RecentSubmissions
        title={view.recent.title}
        rows={view.recent.rows}
        emptyText={view.recent.emptyText}
        viewAll={view.recent.viewAll}
      />
    </div>
  );
}
