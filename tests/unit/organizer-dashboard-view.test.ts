import { describe, expect, it } from "vitest";

import { ORGANIZER_COPY, ORGANIZER_LOCKED } from "@/content/copy";
import { JUDGE_EXPERTISE_OPTIONS } from "@/lib/application-config";
import type { JudgeExpertiseArea } from "@/lib/validation/application";
import { APPLICATION_STATUSES } from "@/lib/domain/enums";
import { ROUTES, organizerApplicationRoute } from "@/lib/routes";
import { toDashboardView, toExpertiseRadarView } from "@/lib/view-models/organizer-dashboard";
import { emptyOrganizerDashboard, fixtureApplicationId, organizerDashboard } from "@/tests/fixtures/organizer";

describe("toDashboardView", () => {
  it("shows the four plan KPIs from the overview", () => {
    const view = toDashboardView(organizerDashboard());
    expect(view.heading).toBe("Mission Control");
    expect(view.intro).toBe(ORGANIZER_COPY.dashboard.intro);
    expect(view.kpisTitle).toBe(ORGANIZER_COPY.dashboard.kpisTitle);
    expect(view.kpis).toEqual([
      { id: "submitted", label: "Submitted", value: "7" },
      { id: "needs-review", label: "Needs review", value: "4" },
      { id: "reviews-complete", label: "Reviews complete", value: "3" },
      { id: "decisions-made", label: "Decisions made", value: "2" },
    ]);
    expect(view.empty).toBeNull();
  });

  it("formats large counts with separators and treats invalid counts as zero", () => {
    const dashboard = organizerDashboard();
    const view = toDashboardView({
      ...dashboard,
      overview: { ...dashboard.overview, submittedCount: 1204, needsReviewCount: -3, reviewsCompletedCount: Number.NaN },
    });
    expect(view.kpis.map((kpi) => kpi.value)).toEqual(["1,204", "0", "0", "2"]);
  });

  it("links Start reviewing to the next unreviewed application and shows queue progress", () => {
    const view = toDashboardView(organizerDashboard());
    expect(view.queue.title).toBe(ORGANIZER_COPY.dashboard.queueTitle);
    expect(view.queue.startReviewing).toEqual({
      label: ORGANIZER_LOCKED.dashboard.startReviewing,
      href: organizerApplicationRoute(fixtureApplicationId(2)),
    });
    expect(view.queue.emptyText).toBeNull();
    expect(view.queue.progress).toEqual({
      label: "Review queue",
      percent: 43,
      valueText: "3 of 7 reviewed",
      remainingText: "4 applications need review",
    });
  });

  it("replaces Start reviewing with empty text when nothing needs review", () => {
    const view = toDashboardView(organizerDashboard({ nextUnreviewedApplicationId: null }));
    expect(view.queue.startReviewing).toBeNull();
    expect(view.queue.emptyText).toBe(ORGANIZER_COPY.dashboard.queueEmpty);
  });

  it("breaks each type down by every status with shares of the type total", () => {
    const view = toDashboardView(organizerDashboard());
    expect(view.breakdown.title).toBe(ORGANIZER_COPY.dashboard.breakdownTitle);
    const [hacker, judge] = view.breakdown.types;
    expect(hacker.label).toBe("Hacker");
    expect(hacker.totalText).toBe("5 applications");
    expect(hacker.rows.map((row) => row.status)).toEqual([...APPLICATION_STATUSES]);
    expect(hacker.rows.find((row) => row.status === "in_review")).toEqual({
      status: "in_review",
      label: "Under review",
      count: 2,
      countText: "2 of 5",
      percent: 40,
    });
    expect(judge.rows.find((row) => row.status === "waitlisted")).toMatchObject({ count: 1, percent: 25 });
  });

  it("lists recent submissions by blind reference", () => {
    const view = toDashboardView(organizerDashboard());
    expect(view.recent.title).toBe(ORGANIZER_COPY.dashboard.recentTitle);
    expect(view.recent.rows).toHaveLength(4);
    expect(view.recent.rows[0]).toMatchObject({
      reference: "H-1001",
      referenceLabel: "Applicant H-1001",
      href: organizerApplicationRoute(fixtureApplicationId(1)),
    });
    expect(view.recent.emptyText).toBeNull();
    expect(view.recent.viewAll).toEqual({ label: ORGANIZER_COPY.dashboard.viewAll, href: ROUTES.organizerApplications });
  });

  it("marks an empty dashboard and keeps every section renderable", () => {
    const view = toDashboardView(emptyOrganizerDashboard());
    expect(view.empty).toEqual({
      title: ORGANIZER_COPY.dashboard.emptyTitle,
      body: ORGANIZER_COPY.dashboard.emptyBody,
      action: null,
    });
    expect(view.kpis.map((kpi) => kpi.value)).toEqual(["0", "0", "0", "0"]);
    expect(view.queue.progress).toMatchObject({ percent: 0, valueText: ORGANIZER_COPY.queue.value(0, 0) });
    expect(view.queue.startReviewing).toBeNull();
    expect(view.breakdown.types.flatMap((type) => type.rows).every((row) => row.percent === 0)).toBe(true);
    expect(view.recent.rows).toEqual([]);
    expect(view.recent.emptyText).toBe(ORGANIZER_COPY.dashboard.recentEmpty);
    expect(view.radar.axes).toHaveLength(JUDGE_EXPERTISE_OPTIONS.length);
  });
});

describe("toExpertiseRadarView", () => {
  it("includes every expertise category in config order, zero counts included", () => {
    const radar = toExpertiseRadarView(organizerDashboard());
    expect(radar.axes.map((axis) => axis.key)).toEqual(JUDGE_EXPERTISE_OPTIONS.map((option) => option.value));
    expect(radar.axes.map((axis) => axis.label)).toEqual(JUDGE_EXPERTISE_OPTIONS.map((option) => option.label));
    expect(radar.axes.find((axis) => axis.key === "web")).toMatchObject({ count: 3, fraction: 1 });
    expect(radar.axes.find((axis) => axis.key === "security")?.fraction).toBeCloseTo(2 / 3);
    expect(radar.axes.find((axis) => axis.key === "mobile")).toMatchObject({ count: 0, fraction: 0 });
  });

  it("names the chart and its table alternative", () => {
    const radar = toExpertiseRadarView(organizerDashboard());
    expect(radar.title).toBe("Expertise Radar");
    expect(radar.intro).toBe(ORGANIZER_COPY.dashboard.radarIntro);
    expect(radar.imageLabel).toBe(ORGANIZER_COPY.dashboard.radarImageLabel(JUDGE_EXPERTISE_OPTIONS.length, 3));
    expect(radar.tableCaption).toBe(ORGANIZER_COPY.dashboard.radarTableCaption);
    expect(radar.columns).toEqual({ area: "Area of expertise", judges: "Judges" });
  });

  it("lists coverage gaps in radar order", () => {
    const radar = toExpertiseRadarView(organizerDashboard());
    expect(radar.gap).toEqual({
      title: "Coverage gap",
      body: ORGANIZER_COPY.dashboard.gapBody,
      items: ["Mobile", "Hardware", "Developer tools", "Health", "Climate", "Fintech", "Education"],
    });
  });

  it("says so when every category is covered", () => {
    const dashboard = organizerDashboard();
    const radar = toExpertiseRadarView({
      ...dashboard,
      expertiseCoverage: JUDGE_EXPERTISE_OPTIONS.map((option) => ({ expertise: option.value, judgeCount: 2 })),
      expertiseGaps: [],
    });
    expect(radar.gap).toMatchObject({ body: ORGANIZER_COPY.dashboard.noGaps, items: [] });
    expect(radar.axes.every((axis) => axis.fraction === 1)).toBe(true);
  });

  it("explains an empty radar before any Judge submits", () => {
    const radar = toExpertiseRadarView(emptyOrganizerDashboard());
    expect(radar.gap.body).toBe(ORGANIZER_COPY.dashboard.noJudges);
    expect(radar.gap.items).toEqual(JUDGE_EXPERTISE_OPTIONS.map((option) => option.label));
    expect(radar.axes.every((axis) => axis.count === 0 && axis.fraction === 0)).toBe(true);
    expect(radar.imageLabel).toBe(ORGANIZER_COPY.dashboard.radarImageLabel(JUDGE_EXPERTISE_OPTIONS.length, 0));
  });

  it("ignores stored categories the config does not list", () => {
    const dashboard = organizerDashboard();
    const radar = toExpertiseRadarView({
      ...dashboard,
      expertiseCoverage: [
        { expertise: "robotics" as JudgeExpertiseArea, judgeCount: 9 },
        ...dashboard.expertiseCoverage,
      ],
    });
    expect(radar.axes.map((axis) => axis.key)).not.toContain("robotics");
    expect(radar.axes.find((axis) => axis.key === "web")?.fraction).toBe(1);
  });
});
