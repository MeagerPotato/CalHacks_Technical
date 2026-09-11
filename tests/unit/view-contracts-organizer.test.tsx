import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationFilters } from "@/components/organizer/ApplicationFilters";
import { ApplicationsView } from "@/components/organizer/ApplicationsView";
import { DecisionRelease } from "@/components/organizer/DecisionRelease";
import { IdentityPanel } from "@/components/organizer/IdentityPanel";
import { MissionControlDashboard } from "@/components/organizer/MissionControlDashboard";
import { NarrativePanel } from "@/components/organizer/NarrativePanel";
import { OrganizerNav } from "@/components/organizer/OrganizerNav";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { ReviewWorkspaceLayout } from "@/components/organizer/ReviewWorkspaceLayout";
import { RubricScoreField } from "@/components/organizer/RubricScoreField";
import { Scorecard } from "@/components/organizer/Scorecard";
import { WorkspaceHeader } from "@/components/organizer/WorkspaceHeader";
import { Button } from "@/components/ui/Button";
import { Form } from "@/components/ui/Form";
import { NoticeFromView } from "@/components/ui/Notice";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { ORGANIZER_COPY, ORGANIZER_LOCKED } from "@/content/copy";
import { organizerApplicationRoute } from "@/lib/routes";
import { toFieldErrors } from "@/lib/validation/errors";
import { REVIEW_SCHEMAS } from "@/lib/validation/review";
import { toApplicationsPageView } from "@/lib/view-models/organizer-applications";
import { toDashboardView } from "@/lib/view-models/organizer-dashboard";
import { toReviewWorkspaceView } from "@/lib/view-models/organizer-review";
import { toOrganizerNavItems } from "@/lib/view-models/organizer-routes";
import { overallScoreText, toReviewErrorState, toScorecardValues } from "@/lib/view-models/organizer-scorecard";
import type { ReviewWorkspaceView, ScorecardValues } from "@/lib/view-models/organizer-types";
import {
  OTHER_REVIEWER_ID,
  applicationListPage,
  draftReviewRecord,
  emptyOrganizerDashboard,
  fixtureApplicationId,
  organizerDashboard,
  reviewRecord,
  reviewWorkspace,
  sampleListItems,
} from "@/tests/fixtures/organizer";

// GuardedLink needs the App Router; a plain anchor marked data-guarded proves AppLink chose it.
vi.mock("@/lib/client/navigation-guard", async () => {
  const { createElement } = await import("react");
  return {
    GuardedLink: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
      createElement("a", { ...props, "data-guarded": "true" }, children),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Tag {
  name: string;
  attrs: Record<string, string>;
}

type AnyElement = ReactElement<Record<string, unknown>>;

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseTags(html: string): Tag[] {
  const tags: Tag[] = [];
  for (const match of html.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const attribute of match[2].matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) {
      attrs[attribute[1].toLowerCase()] = decodeEntities(attribute[2] ?? "");
    }
    tags.push({ name: match[1].toLowerCase(), attrs });
  }
  return tags;
}

function tagsNamed(html: string, name: string): Tag[] {
  return parseTags(html).filter((tag) => tag.name === name);
}

function onlyTag(html: string, name: string): Tag {
  const tags = tagsNamed(html, name);
  expect(tags, `exactly one <${name}>`).toHaveLength(1);
  return tags[0];
}

function tagById(html: string, id: string): Tag {
  const tags = parseTags(html).filter((tag) => tag.attrs.id === id);
  expect(tags, `exactly one #${id}`).toHaveLength(1);
  return tags[0];
}

function tagsByTestId(html: string, testId: string): Tag[] {
  return parseTags(html).filter((tag) => tag.attrs["data-testid"] === testId);
}

function tagByTestId(html: string, testId: string): Tag {
  const tags = tagsByTestId(html, testId);
  expect(tags, `exactly one [data-testid=${testId}]`).toHaveLength(1);
  return tags[0];
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ""));
}

/** Outer markup of every `<name>` element. Use only for elements that never nest inside themselves. */
function markupOf(html: string, name: string): string[] {
  const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, "g");
  return [...html.matchAll(pattern)].map((match) => match[0]);
}

function slotOrder(html: string): string[] {
  return parseTags(html).flatMap((tag) => (tag.attrs["data-slot"] ? [tag.attrs["data-slot"]] : []));
}

function collectElements(node: ReactNode, found: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectElements(child, found);
    }
  } else if (isValidElement<Record<string, unknown>>(node)) {
    found.push(node);
    collectElements(node.props.children as ReactNode, found);
  }
  return found;
}

function elementsOfType(node: ReactNode, type: unknown): AnyElement[] {
  return collectElements(node).filter((element) => element.type === type);
}

function byTestId(elements: AnyElement[], testId: string): AnyElement {
  const element = elements.find((candidate) => candidate.props["data-testid"] === testId);
  expect(element, `element [data-testid=${testId}]`).toBeDefined();
  return element as AnyElement;
}

function expectUniqueIds(html: string): void {
  const ids = parseTags(html).flatMap((tag) => (tag.attrs.id ? [tag.attrs.id] : []));
  expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
}

function expectReferencesResolve(html: string): void {
  const tags = parseTags(html);
  const ids = new Set(tags.flatMap((tag) => (tag.attrs.id ? [tag.attrs.id] : [])));
  const missing: string[] = [];
  for (const tag of tags) {
    for (const attribute of ["aria-labelledby", "aria-describedby", "aria-controls", "for"]) {
      for (const id of (tag.attrs[attribute] ?? "").split(/\s+/).filter(Boolean)) {
        if (!ids.has(id)) {
          missing.push(`<${tag.name} ${attribute}> -> #${id}`);
        }
      }
    }
    if (tag.name === "a" && tag.attrs.href?.startsWith("#") && !ids.has(tag.attrs.href.slice(1))) {
      missing.push(`<a href> -> ${tag.attrs.href}`);
    }
  }
  expect(missing).toEqual([]);
}

function expectHeadingOutline(html: string, firstLevel: number): void {
  const levels = parseTags(html)
    .filter((tag) => /^h[1-6]$/.test(tag.name))
    .map((tag) => Number(tag.name.slice(1)));
  expect(levels[0]).toBe(firstLevel);
  levels.forEach((level, index) => {
    if (index > 0) {
      expect(level, `heading ${index} skips a level`).toBeLessThanOrEqual(levels[index - 1] + 1);
    }
  });
}

function expectSvgsNamedOrHidden(html: string): void {
  for (const svg of tagsNamed(html, "svg")) {
    const named = svg.attrs.role === "img" && Boolean(svg.attrs["aria-labelledby"] || svg.attrs["aria-label"]);
    expect(named || svg.attrs["aria-hidden"] === "true").toBe(true);
  }
}

function expectSoundDom(html: string): void {
  expectUniqueIds(html);
  expectReferencesResolve(html);
  expectSvgsNamedOrHidden(html);
}

const consoleErrors: unknown[][] = [];

beforeEach(() => {
  consoleErrors.length = 0;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  expect(consoleErrors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Shell and navigation
// ---------------------------------------------------------------------------

describe("OrganizerShell", () => {
  it("renders the header slots before the single main landmark", () => {
    const html = renderToStaticMarkup(
      <OrganizerShell homeHref="/organizer" nav={<i data-slot="nav" />} actions={<i data-slot="actions" />}>
        <i data-slot="content" />
      </OrganizerShell>,
    );
    expect(onlyTag(html, "main").attrs).toMatchObject({ id: "main", tabindex: "-1" });
    expect(onlyTag(html, "header").attrs["data-testid"]).toBe("organizer-header");
    expect(slotOrder(html)).toEqual(["nav", "actions", "content"]);
    expect(tagsNamed(html, "a")[0].attrs).toMatchObject({ href: "/organizer", "data-guarded": "true" });
  });
});

describe("OrganizerNav", () => {
  it("names the landmark and marks the current section", () => {
    const html = renderToStaticMarkup(
      <OrganizerNav
        label={ORGANIZER_COPY.nav.label}
        items={toOrganizerNavItems(organizerApplicationRoute(fixtureApplicationId(1)))}
      />,
    );
    expect(onlyTag(html, "nav").attrs["aria-label"]).toBe(ORGANIZER_COPY.nav.label);
    const links = tagsNamed(html, "a");
    expect(links.map((link) => [link.attrs["data-testid"], link.attrs.href, link.attrs["aria-current"]])).toEqual([
      ["organizer-nav-dashboard", "/organizer", undefined],
      ["organizer-nav-applications", "/organizer/applications", "true"],
    ]);
    expect(tagsNamed(html, "li").map((item) => item.attrs["data-current"])).toEqual(["false", "true"]);
  });

  it("uses aria-current=page on the current page", () => {
    const html = renderToStaticMarkup(<OrganizerNav label="Organizer" items={toOrganizerNavItems("/organizer")} />);
    expect(tagsNamed(html, "a")[0].attrs["aria-current"]).toBe("page");
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

describe("MissionControlDashboard", () => {
  const view = toDashboardView(organizerDashboard());
  const html = renderToStaticMarkup(<MissionControlDashboard view={view} />);

  it("keeps a sound DOM and heading outline", () => {
    expectSoundDom(html);
    expectHeadingOutline(html, 1);
    expect(markupOf(html, "h1")[0]).toContain(ORGANIZER_LOCKED.dashboard.heading);
    expect(tagByTestId(html, "organizer-dashboard").attrs["data-empty"]).toBe("false");
  });

  it("renders each KPI as a labelled description", () => {
    expect(tagByTestId(html, "kpi-cards").attrs["aria-labelledby"]).toBe("kpis-title");
    expect(markupOf(html, "dt").slice(0, 4).map(textOf)).toEqual([
      "Submitted",
      "Needs review",
      "Reviews complete",
      "Decisions made",
    ]);
    expect(markupOf(html, "dd").slice(0, 4).map(textOf)).toEqual(["7", "4", "3", "2"]);
    expect(tagByTestId(html, "kpi-needs-review").attrs["data-kpi"]).toBe("needs-review");
  });

  it("links Start reviewing and shows queue progress", () => {
    expect(tagByTestId(html, "start-reviewing").attrs.href).toBe(organizerApplicationRoute(fixtureApplicationId(2)));
    expect(tagById(html, "queue-progress").attrs).toMatchObject({
      role: "progressbar",
      "aria-valuenow": "43",
      "aria-valuetext": "3 of 7 reviewed",
    });
  });

  it("draws decorative breakdown bars next to their text", () => {
    const rows = tagsNamed(html, "li").filter((tag) => tag.attrs["data-status"] && !tag.attrs["data-testid"]);
    expect(rows).toHaveLength(10);
    expect(textOf(html)).toContain("2 of 5");
  });

  it("names the Expertise Radar chart and pairs it with a table of the same numbers", () => {
    const chart = tagByTestId(html, "expertise-radar-chart");
    expect(chart.attrs).toMatchObject({ role: "img", "aria-labelledby": "expertise-radar-image-title" });
    expect(tagById(html, "expertise-radar-image-title").name).toBe("title");
    expect(textOf(markupOf(html, "title")[0])).toBe(view.radar.imageLabel);
    expect(tagsNamed(html, "text")).toHaveLength(view.radar.axes.length);

    const table = markupOf(html, "table")[0];
    expect(textOf(markupOf(table, "caption")[0])).toBe(view.radar.tableCaption);
    expect(tagsNamed(table, "th").filter((cell) => cell.attrs.scope === "col")).toHaveLength(2);
    expect(tagsNamed(table, "th").filter((cell) => cell.attrs.scope === "row")).toHaveLength(view.radar.axes.length);
    const gapRows = tagsNamed(table, "tr").filter((row) => row.attrs["data-gap"] === "true");
    expect(gapRows.map((row) => row.attrs["data-expertise"])).toEqual([
      "mobile",
      "hardware",
      "developer_tools",
      "health",
      "climate",
      "fintech",
      "education",
    ]);
    expect(tagByTestId(html, "coverage-gap").attrs["data-gap-count"]).toBe("7");
  });

  it("links recent submissions by blind reference", () => {
    for (const row of view.recent.rows) {
      expect(tagByTestId(html, `recent-submission-${row.id}`).attrs["data-status"]).toBe(row.status);
    }
    expect(textOf(html)).toContain("Applicant H-1001");
    expect(textOf(html)).not.toContain("Test Hacker 1");
  });

  it("shows the empty state without a Start reviewing link", () => {
    const empty = renderToStaticMarkup(<MissionControlDashboard view={toDashboardView(emptyOrganizerDashboard())} />);
    expectSoundDom(empty);
    expect(tagByTestId(empty, "organizer-dashboard").attrs["data-empty"]).toBe("true");
    expect(tagByTestId(empty, "notice-dashboard-empty").attrs["data-tone"]).toBe("info");
    expect(tagsByTestId(empty, "start-reviewing")).toHaveLength(0);
    expect(textOf(empty)).toContain(ORGANIZER_COPY.dashboard.recentEmpty);
    expect(textOf(empty)).toContain(ORGANIZER_COPY.dashboard.noJudges);
  });
});

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

describe("ApplicationsView", () => {
  const view = toApplicationsPageView(applicationListPage(sampleListItems(), { page: 2, pageSize: 4 }, 12));
  const html = renderToStaticMarkup(<ApplicationsView view={view} />);

  it("keeps a sound DOM and heading outline", () => {
    expectSoundDom(html);
    expectHeadingOutline(html, 1);
  });

  it("renders a GET search form whose control names are the query-string keys", () => {
    expect(onlyTag(html, "form").attrs).toMatchObject({
      method: "get",
      action: "/organizer/applications",
      role: "search",
      "aria-labelledby": "application-filters-title",
    });
    const search = tagById(html, "filter-search");
    expect(search.attrs).toMatchObject({ type: "search", name: "search", value: "" });
    expect(tagsNamed(html, "select").map((select) => select.attrs.name)).toEqual(["type", "status", "reviewState", "sort"]);
    for (const select of tagsNamed(html, "select")) {
      expect(tagsNamed(html, "label").some((label) => label.attrs.for === select.attrs.id)).toBe(true);
    }
    expect(tagsNamed(html, "input").filter((input) => input.attrs.type === "hidden")).toEqual([
      { name: "input", attrs: { type: "hidden", name: "pageSize", value: "4" } },
    ]);
    const selected = tagsNamed(html, "option").filter((option) => "selected" in option.attrs);
    expect(selected.map((option) => option.attrs.value)).toEqual(["", "", "", "submitted_desc"]);
    expect(tagByTestId(html, "apply-filters").attrs.type).toBe("submit");
    expect(tagsByTestId(html, "clear-filters")).toHaveLength(0);
  });

  it("renders a captioned table with scoped headers and aria-sort on the sorted column", () => {
    expect(tagByTestId(html, "application-results").attrs["data-state"]).toBe("results");
    const table = markupOf(html, "table")[0];
    expect(textOf(markupOf(table, "caption")[0])).toBe("Applications (Newest submitted first)");
    const columns = tagsNamed(table, "th").filter((cell) => cell.attrs.scope === "col");
    expect(columns.map((cell) => [cell.attrs["data-column"], cell.attrs["aria-sort"], cell.attrs["data-sorted"]])).toEqual([
      ["applicant", undefined, undefined],
      ["reference", undefined, undefined],
      ["type", undefined, undefined],
      ["status", undefined, undefined],
      ["submitted", "descending", "descending"],
      ["score", undefined, "none"],
      ["review", undefined, undefined],
    ]);
    expect(tagsNamed(table, "th").filter((cell) => cell.attrs.scope === "row")).toHaveLength(4);
    const sortLink = markupOf(html, "a").find((link) => link.includes('data-testid="sort-submitted"')) ?? "";
    expect(textOf(sortLink)).toBe("Submitted (sort: Oldest submitted first)");
  });

  it("repeats every row as a stacked card with the same links", () => {
    const rowIds = tagsNamed(html, "tr").flatMap((row) =>
      row.attrs["data-testid"]?.startsWith("application-row-") ? [row.attrs["data-testid"].slice("application-row-".length)] : [],
    );
    const cardIds = tagsNamed(html, "li").flatMap((card) =>
      card.attrs["data-testid"]?.startsWith("application-card-") ? [card.attrs["data-testid"].slice("application-card-".length)] : [],
    );
    expect(cardIds).toEqual(rowIds);
    expect(rowIds).toEqual(view.results.rows.map((row) => row.id));
    const hrefs = tagsNamed(html, "a").map((link) => link.attrs.href);
    for (const row of view.results.rows) {
      expect(hrefs.filter((href) => href === row.href)).toHaveLength(2);
    }
  });

  it("paginates in a named navigation region", () => {
    expect(tagByTestId(html, "pagination").attrs["aria-label"]).toBe("Pages");
    expect(tagByTestId(html, "pagination-previous").attrs.href).toBe("/organizer/applications?pageSize=4");
    expect(tagByTestId(html, "pagination-next").attrs.href).toBe("/organizer/applications?page=3&pageSize=4");
    expect(textOf(html)).toContain("Page 2 of 3");
  });

  it.each([
    ["no-results", applicationListPage([], { search: "nobody" }), ORGANIZER_COPY.applications.noResultsTitle],
    ["empty", applicationListPage([]), ORGANIZER_COPY.applications.emptyTitle],
    ["past-end", applicationListPage([], { page: 9 }, 12), ORGANIZER_COPY.applications.pastEndTitle],
  ] as const)("renders the %s state without a table", (state, page, title) => {
    const stateHtml = renderToStaticMarkup(<ApplicationsView view={toApplicationsPageView(page)} />);
    expectSoundDom(stateHtml);
    expectHeadingOutline(stateHtml, 1);
    expect(tagByTestId(stateHtml, "application-results").attrs["data-state"]).toBe(state);
    expect(tagsNamed(stateHtml, "table")).toHaveLength(0);
    expect(textOf(markupOf(stateHtml, "h3")[0])).toBe(title);
  });

  it("offers Clear filters in the form and the no-results message while filters are active", () => {
    const filtered = renderToStaticMarkup(
      <ApplicationsView view={toApplicationsPageView(applicationListPage([], { search: "nobody", type: "judge" }))} />,
    );
    expect(tagByTestId(filtered, "clear-filters").attrs.href).toBe("/organizer/applications");
    expect(tagById(filtered, "filter-search").attrs.value).toBe("nobody");
    expect(tagsNamed(filtered, "a").filter((link) => link.attrs.href === "/organizer/applications")).toHaveLength(2);
  });

  it("attaches the submit handler and pending state only when provided", () => {
    const onSubmit = vi.fn();
    const enhanced = ApplicationFilters({ filters: view.filters, onSubmit, pending: true });
    expect(elementsOfType(enhanced, "form")[0].props.onSubmit).toBe(onSubmit);
    expect(elementsOfType(enhanced, Button)[0].props.pending).toBe(true);
    expect(elementsOfType(ApplicationFilters({ filters: view.filters }), "form")[0].props.onSubmit).toBeUndefined();
  });

  it("uses the filter slot when a container provides one", () => {
    const slotted = renderToStaticMarkup(<ApplicationsView view={view} filters={<i data-slot="filters" />} />);
    expect(slotOrder(slotted)).toEqual(["filters"]);
    expect(tagsNamed(slotted, "form")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Review workspace
// ---------------------------------------------------------------------------

function renderWorkspace(
  view: ReviewWorkspaceView,
  options: { values?: ScorecardValues; step?: "choose" | "confirm"; choice?: string } = {},
): string {
  const values = options.values ?? view.scorecard.initialValues;
  return renderToStaticMarkup(
    <ReviewWorkspaceLayout
      isBlind={view.blind.isBlind}
      access={view.scorecard.access}
      header={<WorkspaceHeader header={view.header} blind={view.blind} />}
      notices={
        view.notices.length > 0 ? view.notices.map((notice) => <NoticeFromView key={notice.id} view={notice} />) : undefined
      }
      identity={view.identity ? <IdentityPanel identity={view.identity} /> : undefined}
      narrative={<NarrativePanel title={view.narrative.title} sections={view.narrative.sections} />}
      scorecard={<Scorecard view={view.scorecard} values={values} overallText={overallScoreText(view.type, values.scores)} />}
      decision={view.decision ? <DecisionRelease view={view.decision} step={options.step} choice={options.choice} /> : undefined}
    />,
  );
}

const WORKSPACES: [string, () => ReviewWorkspaceView][] = [
  ["blind", () => toReviewWorkspaceView(reviewWorkspace({ status: "submitted" }))],
  ["revealed with a draft review", () => toReviewWorkspaceView(reviewWorkspace({ revealIdentity: true, review: draftReviewRecord("hacker") }))],
  ["a revealed Judge", () => toReviewWorkspaceView(reviewWorkspace({ type: "judge", revealIdentity: true }))],
  ["complete", () => toReviewWorkspaceView(reviewWorkspace({ review: reviewRecord("hacker") }))],
  [
    "owned by another organizer",
    () => toReviewWorkspaceView(reviewWorkspace({ review: reviewRecord("hacker", { isMine: false, reviewerId: OTHER_REVIEWER_ID }) })),
  ],
  ["not submitted", () => toReviewWorkspaceView(reviewWorkspace({ status: "draft" }))],
  ["decided", () => toReviewWorkspaceView(reviewWorkspace({ status: "accepted", review: reviewRecord("hacker") }))],
  ["arrived after Save review and continue", () => toReviewWorkspaceView(reviewWorkspace(), { reviewedReference: "J-1002" })],
];

describe("review workspace composition", () => {
  it.each(WORKSPACES)("keeps a sound DOM and heading outline when %s", (_label, build) => {
    const html = renderWorkspace(build());
    expectSoundDom(html);
    expectHeadingOutline(html, 1);
    expect(tagsNamed(html, "h1")).toHaveLength(1);
  });

  it("withholds identifying details in blind mode and shows them once revealed", () => {
    const secrets = ["Test Hacker", "applicant-1@example.com", "Example University", "https://example.com/test-hacker"];
    const blind = renderWorkspace(toReviewWorkspaceView(reviewWorkspace({ status: "submitted" })));
    expect(tagByTestId(blind, "review-workspace").attrs["data-blind"]).toBe("true");
    expect(tagsByTestId(blind, "identity-panel")).toHaveLength(0);
    for (const secret of secrets) {
      expect(textOf(blind)).not.toContain(secret);
    }

    const revealed = renderWorkspace(toReviewWorkspaceView(reviewWorkspace({ status: "submitted", revealIdentity: true })));
    expect(tagByTestId(revealed, "review-workspace").attrs["data-blind"]).toBe("false");
    for (const secret of secrets) {
      expect(textOf(revealed)).toContain(secret);
    }
  });

  it("orders the layout slots and exposes blind and access state", () => {
    const html = renderToStaticMarkup(
      <ReviewWorkspaceLayout
        isBlind
        access="owned_by_another_organizer"
        header={<i data-slot="header" />}
        notices={<i data-slot="notices" />}
        identity={<i data-slot="identity" />}
        narrative={<i data-slot="narrative" />}
        scorecard={<i data-slot="scorecard" />}
        decision={<i data-slot="decision" />}
        status={<i data-slot="status" />}
      />,
    );
    expect(slotOrder(html)).toEqual(["header", "notices", "identity", "narrative", "scorecard", "decision", "status"]);
    expect(tagByTestId(html, "review-workspace").attrs).toMatchObject({
      "data-blind": "true",
      "data-access": "owned_by_another_organizer",
    });
    const bare = renderToStaticMarkup(
      <ReviewWorkspaceLayout isBlind={false} access="editable" header={null} narrative={null} scorecard={null} />,
    );
    expect(tagsByTestId(bare, "workspace-notices")).toHaveLength(0);
  });
});

describe("WorkspaceHeader", () => {
  const view = toReviewWorkspaceView(reviewWorkspace());

  it("renders the focusable heading, navigation links, queue meter, and blind-mode bar", () => {
    const html = renderToStaticMarkup(<WorkspaceHeader header={view.header} blind={view.blind} />);
    expectSoundDom(html);
    expect(tagById(html, "workspace-heading").attrs.tabindex).toBe("-1");
    expect(textOf(markupOf(html, "h1")[0])).toBe("Applicant H-1001");
    expect(tagByTestId(html, "back-to-applications").attrs.href).toBe("/organizer/applications");
    expect(tagByTestId(html, "next-application").attrs.href).toBe(view.header.next?.href);
    expect(tagById(html, "workspace-queue-progress").attrs.role).toBe("progressbar");
    expect(tagByTestId(html, "blind-mode").attrs["data-blind"]).toBe("true");
    expect(tagByTestId(html, "identity-toggle")).toEqual({
      name: "a",
      attrs: expect.objectContaining({ href: view.blind.toggleHref, "aria-describedby": "blind-mode-status" }),
    });
  });

  it("renders the toggle as a button when a container handles it", () => {
    const onToggleIdentity = vi.fn();
    const tree = WorkspaceHeader({ header: view.header, blind: view.blind, onToggleIdentity, identityPending: true });
    const toggle = byTestId(elementsOfType(tree, Button), "identity-toggle");
    expect(toggle.props.pending).toBe(true);
    (toggle.props.onClick as () => void)();
    expect(onToggleIdentity).toHaveBeenCalledTimes(1);
  });
});

describe("IdentityPanel", () => {
  it("lists identifying details with external links that open in a new tab", () => {
    const identity = toReviewWorkspaceView(reviewWorkspace({ revealIdentity: true })).identity;
    expect(identity).not.toBeNull();
    const html = renderToStaticMarkup(<IdentityPanel identity={identity!} />);
    expectSoundDom(html);
    expect(tagById(html, "identity-panel").attrs).toMatchObject({ tabindex: "-1", "aria-labelledby": "identity-panel-title" });
    expect(markupOf(html, "dt").map(textOf)).toEqual([
      "Name",
      "Email",
      "Birthdate",
      "Country of residence",
      "City of residence",
      "School",
      "Links",
    ]);
    expect(onlyTag(html, "a").attrs).toMatchObject({
      href: "https://example.com/test-hacker",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("shows the missing text for absent details", () => {
    const identity = toReviewWorkspaceView(reviewWorkspace({ type: "judge", revealIdentity: true })).identity!;
    const html = renderToStaticMarkup(<IdentityPanel identity={identity} />);
    expect(markupOf(html, "dd").map(textOf)[6]).toBe(ORGANIZER_COPY.workspace.identity.notProvided);
  });
});

describe("NarrativePanel", () => {
  it("renders the answers under a named region with section subheadings", () => {
    const { narrative } = toReviewWorkspaceView(reviewWorkspace());
    const html = renderToStaticMarkup(<NarrativePanel title={narrative.title} sections={narrative.sections} />);
    expectSoundDom(html);
    expectHeadingOutline(html, 2);
    expect(onlyTag(html, "section").attrs["aria-labelledby"]).toBe("narrative-title");
    expect(tagsNamed(html, "h3")).toHaveLength(narrative.sections.length);
    expect(tagByTestId(html, "answer-summary").name).toBe("div");
  });
});

describe("Scorecard", () => {
  const draftView = toReviewWorkspaceView(reviewWorkspace({ review: draftReviewRecord("hacker") }));

  it("renders an editable form with a radio group per rubric dimension", () => {
    const { scorecard } = draftView;
    const values = scorecard.initialValues;
    const html = renderToStaticMarkup(
      <Scorecard
        view={scorecard}
        values={values}
        overallText={overallScoreText("hacker", values.scores)}
        notesCounter={{ current: 0, max: 5000, text: "0 of 5000 characters" }}
      />,
    );
    expectSoundDom(html);
    expectHeadingOutline(html, 2);
    expect(tagByTestId(html, "scorecard").attrs).toMatchObject({ "data-access": "editable", "data-completed": "false" });
    const form = onlyTag(html, "form");
    expect(form.attrs.id).toBe("review-form");
    expect("novalidate" in form.attrs).toBe(true);
    expect(tagsNamed(html, "fieldset")).toHaveLength(scorecard.dimensions.length + 1);

    const radios = tagsNamed(html, "input").filter((input) => input.attrs.type === "radio");
    expect(radios).toHaveLength(scorecard.dimensions.length * 5 + 4);
    expect(radios.slice(0, 5).map((radio) => [radio.attrs.id, radio.attrs.name, radio.attrs.value])).toEqual([
      ["review-score-motivation", "score-motivation", "1"],
      ["review-score-motivation-2", "score-motivation", "2"],
      ["review-score-motivation-3", "score-motivation", "3"],
      ["review-score-motivation-4", "score-motivation", "4"],
      ["review-score-motivation-5", "score-motivation", "5"],
    ]);
    expect(radios.filter((radio) => "checked" in radio.attrs).map((radio) => radio.attrs.id)).toEqual([
      "review-score-motivation-4",
    ]);
    expect(radios[0].attrs["aria-describedby"]).toBe("review-score-motivation-anchor");
    expect(radios[1].attrs["aria-describedby"]).toBeUndefined();
    expect(tagById(html, "review-recommendation").attrs).toMatchObject({ type: "radio", value: "strong_yes" });
    expect(tagById(html, "review-notes").name).toBe("textarea");
    expect(tagById(html, "review-notes").attrs["aria-describedby"]).toBe("review-notes-hint review-notes-counter");
    expect(textOf(markupOf(html, "p").find((paragraph) => paragraph.includes('data-testid="overall-score"')) ?? "")).toBe(
      ORGANIZER_COPY.workspace.scorecard.overallPending,
    );
    expect(tagsNamed(html, "button").map((button) => [button.attrs["data-testid"], button.attrs.type])).toEqual([
      ["save-review-and-continue", "button"],
      ["save-review", "button"],
      ["save-draft", "button"],
    ]);
  });

  it("shows inline errors and an error summary whose links reach the controls", () => {
    const parsed = REVIEW_SCHEMAS.hacker.submission.safeParse({ scores: { motivation: 4 }, notes: "", recommendation: null });
    const state = toReviewErrorState("hacker", parsed.success ? undefined : toFieldErrors(parsed.error, 2));
    const values = draftView.scorecard.initialValues;
    const html = renderToStaticMarkup(
      <Scorecard
        view={draftView.scorecard}
        values={values}
        overallText={overallScoreText("hacker", values.scores)}
        errors={state.errors}
        summaryItems={state.summary}
      />,
    );
    expectSoundDom(html);
    expect(tagByTestId(html, "error-summary").attrs["aria-labelledby"]).toBe("scorecard-error-summary-title");
    expect(tagsNamed(html, "a").map((link) => link.attrs.href)).toEqual([
      "#review-score-initiative",
      "#review-score-growth",
      "#review-score-community",
      "#review-recommendation",
    ]);
    expect(tagByTestId(html, "rubric-initiative").attrs["data-invalid"]).toBe("true");
    expect(tagByTestId(html, "rubric-motivation").attrs["data-invalid"]).toBe("false");
    expect(tagById(html, "review-score-initiative-error").name).toBe("p");
  });

  it("hides Save draft once the review is complete and shows the live overall score", () => {
    const view = toReviewWorkspaceView(reviewWorkspace({ review: reviewRecord("hacker") }));
    const values = view.scorecard.initialValues;
    const html = renderToStaticMarkup(
      <Scorecard view={view.scorecard} values={values} overallText={overallScoreText("hacker", values.scores)} />,
    );
    expect(tagByTestId(html, "scorecard").attrs["data-completed"]).toBe("true");
    expect(tagsByTestId(html, "save-draft")).toHaveLength(0);
    expect(textOf(html)).toContain("4.00 out of 5");
  });

  it.each([
    ["owned_by_another_organizer", reviewWorkspace({ review: reviewRecord("hacker", { isMine: false, reviewerId: OTHER_REVIEWER_ID }) })],
    ["locked", reviewWorkspace({ status: "waitlisted", review: reviewRecord("hacker") })],
  ] as const)("renders a read-only review when access is %s", (access, workspace) => {
    const view = toReviewWorkspaceView(workspace);
    const values = view.scorecard.initialValues;
    const html = renderToStaticMarkup(
      <Scorecard view={view.scorecard} values={values} overallText={overallScoreText("hacker", values.scores)} />,
    );
    expectSoundDom(html);
    expect(tagByTestId(html, "scorecard").attrs["data-access"]).toBe(access);
    expect(tagsNamed(html, "form")).toHaveLength(0);
    expect(tagsNamed(html, "input")).toHaveLength(0);
    expect(tagByTestId(html, "scorecard-read-only").name).toBe("dl");
    expect(textOf(html)).toContain("Strong yes");
    expect(textOf(html)).toContain("Strong fit.");
  });

  it("wires value changes and the three save actions to the container", () => {
    const handlers = {
      onScoreChange: vi.fn(),
      onNotesChange: vi.fn(),
      onRecommendationChange: vi.fn(),
      onSaveDraft: vi.fn(),
      onSaveReview: vi.fn(),
      onSaveAndContinue: vi.fn(),
    };
    const values = toScorecardValues("hacker", null);
    const tree = Scorecard({ view: draftView.scorecard, values, overallText: "", ...handlers });

    const fields = elementsOfType(tree, RubricScoreField);
    (fields[1].props.onValueChange as (score: number) => void)(3);
    expect(handlers.onScoreChange).toHaveBeenCalledWith("initiative", 3);
    expect(elementsOfType(tree, RadioGroup)[0].props.onValueChange).toBe(handlers.onRecommendationChange);

    const event = { preventDefault: vi.fn() };
    (elementsOfType(tree, Form)[0].props.onSubmit as (event: unknown) => void)(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(handlers.onSaveAndContinue).toHaveBeenCalledTimes(1);

    const buttons = elementsOfType(tree, Button);
    expect(byTestId(buttons, "save-review-and-continue").props.type).toBe("submit");
    (byTestId(buttons, "save-review").props.onClick as () => void)();
    (byTestId(buttons, "save-draft").props.onClick as () => void)();
    expect(handlers.onSaveReview).toHaveBeenCalledTimes(1);
    expect(handlers.onSaveDraft).toHaveBeenCalledTimes(1);
  });
});

describe("RubricScoreField", () => {
  const [dimension] = toReviewWorkspaceView(reviewWorkspace()).scorecard.dimensions;

  it("reports the chosen score as a number", () => {
    const onValueChange = vi.fn();
    const inputs = elementsOfType(RubricScoreField({ dimension, value: null, onValueChange }), "input");
    expect(inputs).toHaveLength(5);
    (inputs[2].props.onChange as () => void)();
    expect(onValueChange).toHaveBeenCalledWith(3);
  });

  it("is read-only without a change handler", () => {
    const inputs = elementsOfType(RubricScoreField({ dimension, value: 5 }), "input");
    expect(inputs.every((input) => input.props.onChange === undefined && input.props.readOnly === true)).toBe(true);
    expect(inputs.map((input) => input.props.checked)).toEqual([false, false, false, false, true]);
  });
});

describe("DecisionRelease", () => {
  const available = toReviewWorkspaceView(reviewWorkspace({ review: reviewRecord("hacker") })).decision!;

  it("offers the decisions and Release decision while choosing", () => {
    const html = renderToStaticMarkup(<DecisionRelease view={available} error={ORGANIZER_COPY.workspace.decision.chooseError} />);
    expectSoundDom(html);
    expectHeadingOutline(html, 2);
    expect(tagByTestId(html, "decision-release").attrs).toMatchObject({ "data-state": "available", "data-step": "choose" });
    expect(tagById(html, "decision-release-title").attrs.tabindex).toBe("-1");
    const radios = tagsNamed(html, "input").filter((input) => input.attrs.type === "radio");
    expect(radios.map((radio) => [radio.attrs.id, radio.attrs.value])).toEqual([
      ["decision-choice", "accepted"],
      ["decision-choice-waitlisted", "waitlisted"],
    ]);
    expect(tagById(html, "decision-choice-error").name).toBe("p");
    expect(tagByTestId(html, "release-decision").name).toBe("button");
    expect(tagsByTestId(html, "decision-confirm")).toHaveLength(0);
  });

  it("asks for confirmation in a focusable group", () => {
    const html = renderToStaticMarkup(<DecisionRelease view={available} step="confirm" choice="accepted" pending />);
    expectSoundDom(html);
    expect(tagByTestId(html, "decision-release").attrs["data-step"]).toBe("confirm");
    expect(tagById(html, "decision-confirm").attrs).toMatchObject({
      role: "group",
      tabindex: "-1",
      "aria-labelledby": "decision-confirm-title",
      "aria-describedby": "decision-confirm-body",
      "data-decision": "accepted",
    });
    expect(textOf(markupOf(html, "p").find((paragraph) => paragraph.includes("decision-confirm-title")) ?? "")).toBe(
      "Release the Accepted decision?",
    );
    expect(tagByTestId(html, "confirm-decision").attrs["aria-disabled"]).toBe("true");
    expect(tagByTestId(html, "cancel-decision").name).toBe("button");
    expect(tagsNamed(html, "input")).toHaveLength(0);
  });

  it("falls back to choosing when the confirmation has no valid decision", () => {
    const html = renderToStaticMarkup(<DecisionRelease view={available} step="confirm" choice="rejected" />);
    expect(tagByTestId(html, "decision-release").attrs["data-step"]).toBe("choose");
  });

  it("explains an unavailable release and shows a released decision", () => {
    const unavailable = toReviewWorkspaceView(reviewWorkspace({ status: "submitted" })).decision!;
    const unavailableHtml = renderToStaticMarkup(<DecisionRelease view={unavailable} />);
    expect(tagByTestId(unavailableHtml, "decision-release").attrs["data-state"]).toBe("unavailable");
    expect(tagByTestId(unavailableHtml, "decision-release").attrs["data-step"]).toBeUndefined();
    expect(tagsNamed(unavailableHtml, "button")).toHaveLength(0);

    const released = toReviewWorkspaceView(reviewWorkspace({ status: "accepted", review: reviewRecord("hacker") })).decision!;
    const releasedHtml = renderToStaticMarkup(<DecisionRelease view={released} />);
    expectSoundDom(releasedHtml);
    expect(tagByTestId(releasedHtml, "decision-released").attrs["data-decision"]).toBe("accepted");
    expect(onlyTag(releasedHtml, "time").attrs.datetime).toBe(released.released?.time?.iso);
    expect(textOf(releasedHtml)).toContain("Decision released: Accepted");
  });

  it("wires the choice, release, confirm, and cancel callbacks", () => {
    const handlers = { onChoiceChange: vi.fn(), onRelease: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() };
    const choosing = DecisionRelease({ view: available, ...handlers });
    expect(elementsOfType(choosing, RadioGroup)[0].props.onValueChange).toBe(handlers.onChoiceChange);
    (byTestId(elementsOfType(choosing, Button), "release-decision").props.onClick as () => void)();
    expect(handlers.onRelease).toHaveBeenCalledTimes(1);

    const confirming = DecisionRelease({ view: available, step: "confirm", choice: "waitlisted", ...handlers });
    const buttons = elementsOfType(confirming, Button);
    (byTestId(buttons, "confirm-decision").props.onClick as () => void)();
    (byTestId(buttons, "cancel-decision").props.onClick as () => void)();
    expect(handlers.onConfirm).toHaveBeenCalledTimes(1);
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });
});
