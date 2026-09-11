import { ORGANIZER_COPY, ORGANIZER_LOCKED } from "@/content/copy";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  JUDGE_EXPERTISE_OPTIONS,
} from "@/lib/application-config";
import type { OrganizerDashboard } from "@/lib/data/types";
import { APPLICATION_STATUSES } from "@/lib/domain/enums";
import { ROUTES, organizerApplicationRoute } from "@/lib/routes";
import {
  formatCount,
  toApplicationRowView,
  toCount,
  toPercent,
  toQueueProgressView,
} from "@/lib/view-models/organizer-shared";
import type {
  BreakdownTypeView,
  DashboardView,
  ExpertiseRadarView,
  KpiView,
} from "@/lib/view-models/organizer-types";

// =============================================================================
// Mission Control dashboard view model.
//
// Only server code may call this (the dashboard page): recent submissions carry server-formatted timestamps.
// =============================================================================

function toKpis(dashboard: OrganizerDashboard): KpiView[] {
  const { overview } = dashboard;
  const labels = ORGANIZER_LOCKED.dashboard.kpis;
  return [
    { id: "submitted", label: labels.submitted, value: formatCount(overview.submittedCount) },
    { id: "needs-review", label: labels.needsReview, value: formatCount(overview.needsReviewCount) },
    { id: "reviews-complete", label: labels.reviewsComplete, value: formatCount(overview.reviewsCompletedCount) },
    { id: "decisions-made", label: labels.decisionsMade, value: formatCount(overview.decisionsMadeCount) },
  ];
}

function toBreakdown(dashboard: OrganizerDashboard): BreakdownTypeView[] {
  const copy = ORGANIZER_COPY.dashboard;
  return dashboard.statusBreakdown.map((entry) => {
    const total = toCount(entry.total);
    return {
      type: entry.type,
      label: APPLICATION_TYPE_LABELS[entry.type],
      totalText: copy.breakdownTotal(total),
      rows: APPLICATION_STATUSES.map((status) => {
        const count = toCount(entry.counts[status]);
        return {
          status,
          label: APPLICATION_STATUS_LABELS[status],
          count,
          countText: copy.breakdownCount(count, total),
          percent: toPercent(count, total),
        };
      }),
    };
  });
}

/**
 * Every category in `JUDGE_EXPERTISE_OPTIONS` order (the data layer sorts by count; the chart needs a stable order),
 * including categories no Judge listed. Gaps come from the data layer and keep the same order.
 */
export function toExpertiseRadarView(dashboard: OrganizerDashboard): ExpertiseRadarView {
  const copy = ORGANIZER_COPY.dashboard;
  const locked = ORGANIZER_LOCKED.dashboard;
  const counts = new Map<string, number>(
    dashboard.expertiseCoverage.map((entry) => [entry.expertise, toCount(entry.judgeCount)]),
  );
  const largest = Math.max(0, ...counts.values());
  const axes = JUDGE_EXPERTISE_OPTIONS.map((option) => {
    const count = counts.get(option.value) ?? 0;
    return { key: option.value, label: option.label, count, fraction: largest === 0 ? 0 : count / largest };
  });

  const gapKeys = new Set<string>(dashboard.expertiseGaps);
  const gapItems = JUDGE_EXPERTISE_OPTIONS.filter((option) => gapKeys.has(option.value)).map((option) => option.label);
  const judgeCount = toCount(dashboard.submittedJudgeCount);

  let gapBody: string = copy.gapBody;
  if (judgeCount === 0) {
    gapBody = copy.noJudges;
  } else if (gapItems.length === 0) {
    gapBody = copy.noGaps;
  }

  return {
    title: locked.expertiseRadar,
    intro: copy.radarIntro,
    imageLabel: copy.radarImageLabel(axes.length, judgeCount),
    tableCaption: copy.radarTableCaption,
    columns: { area: copy.radarColumns.area, judges: copy.radarColumns.judges },
    axes,
    gap: { title: locked.coverageGap, body: gapBody, items: gapItems },
  };
}

/**
 * The Mission Control dashboard: the four plan KPIs, review queue progress with a Start reviewing link to the next
 * unreviewed application (or empty text), per-type status breakdown bars, the Expertise Radar with its coverage gap,
 * and the five most recent submissions. `empty` is set while nothing has been submitted.
 */
export function toDashboardView(dashboard: OrganizerDashboard): DashboardView {
  const copy = ORGANIZER_COPY.dashboard;
  const locked = ORGANIZER_LOCKED.dashboard;
  const next = dashboard.nextUnreviewedApplicationId;
  const recentRows = dashboard.recentSubmissions.map(toApplicationRowView);

  return {
    heading: locked.heading,
    intro: copy.intro,
    empty:
      toCount(dashboard.overview.submittedCount) === 0
        ? { title: copy.emptyTitle, body: copy.emptyBody, action: null }
        : null,
    kpisTitle: copy.kpisTitle,
    kpis: toKpis(dashboard),
    queue: {
      title: copy.queueTitle,
      progress: toQueueProgressView(dashboard.queueProgress),
      startReviewing: next ? { label: locked.startReviewing, href: organizerApplicationRoute(next) } : null,
      emptyText: next ? null : copy.queueEmpty,
    },
    breakdown: { title: copy.breakdownTitle, types: toBreakdown(dashboard) },
    radar: toExpertiseRadarView(dashboard),
    recent: {
      title: copy.recentTitle,
      rows: recentRows,
      emptyText: recentRows.length === 0 ? copy.recentEmpty : null,
      viewAll: { label: copy.viewAll, href: ROUTES.organizerApplications },
    },
  };
}
