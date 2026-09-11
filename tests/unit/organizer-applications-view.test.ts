import { describe, expect, it } from "vitest";

import { ORGANIZER_COPY } from "@/content/copy";
import { toTimestampView } from "@/lib/format/datetime";
import { ROUTES, organizerApplicationRoute } from "@/lib/routes";
import { parseApplicationListFilters } from "@/lib/validation/organizer";
import {
  APPLICATION_FILTER_IDS,
  hasActiveFilters,
  toApplicationsPageView,
} from "@/lib/view-models/organizer-applications";
import {
  ORGANIZER_TIMES,
  applicationListPage,
  fixtureApplicationId,
  listItem,
  sampleListItems,
} from "@/tests/fixtures/organizer";

const LIST = ROUTES.organizerApplications;

describe("toApplicationsPageView filters", () => {
  it("reflects the parsed filters in the GET form", () => {
    const view = toApplicationsPageView(
      applicationListPage([], {
        search: "ada",
        type: "judge",
        status: "in_review",
        reviewState: "unreviewed",
        sort: "score_asc",
      }),
    );
    expect(view.heading).toBe(ORGANIZER_COPY.applications.heading);
    expect(view.filters.action).toBe(LIST);
    expect(view.filters.search).toEqual({
      id: APPLICATION_FILTER_IDS.search,
      name: "search",
      label: "Search",
      hint: ORGANIZER_COPY.applications.searchHint,
      value: "ada",
    });
    expect(view.filters.selects.map((select) => [select.id, select.name, select.value])).toEqual([
      [APPLICATION_FILTER_IDS.type, "type", "judge"],
      [APPLICATION_FILTER_IDS.status, "status", "in_review"],
      [APPLICATION_FILTER_IDS.reviewState, "reviewState", "unreviewed"],
      [APPLICATION_FILTER_IDS.sort, "sort", "score_asc"],
    ]);
    expect(view.filters.submitLabel).toBe(ORGANIZER_COPY.applications.apply);
    expect(view.filters.clear).toEqual({ label: "Clear filters", href: `${LIST}?sort=score_asc` });
  });

  it("offers an all option first for type, status, and review state, and every sort order", () => {
    const [type, status, reviewState, sort] = toApplicationsPageView(applicationListPage([])).filters.selects;
    expect(type.options).toEqual([
      { value: "", label: "All types" },
      { value: "hacker", label: "Hacker" },
      { value: "judge", label: "Judge" },
    ]);
    expect(status.options[0]).toEqual({ value: "", label: ORGANIZER_COPY.applications.anyStatus });
    expect(status.options.slice(1).map((option) => option.value)).toEqual([
      "draft",
      "submitted",
      "in_review",
      "accepted",
      "waitlisted",
    ]);
    expect(reviewState.options).toEqual([
      { value: "", label: ORGANIZER_COPY.applications.anyReviewState },
      { value: "reviewed", label: "Reviewed" },
      { value: "unreviewed", label: "Not reviewed" },
    ]);
    expect(sort.options.map((option) => option.value)).toEqual([
      "submitted_desc",
      "submitted_asc",
      "score_desc",
      "score_asc",
    ]);
    expect(sort.value).toBe("submitted_desc");
  });

  it("has no clear link and no hidden fields with default filters", () => {
    const { filters } = toApplicationsPageView(applicationListPage([]));
    expect(filters.search.value).toBe("");
    expect(filters.clear).toBeNull();
    expect(filters.hidden).toEqual([]);
  });

  it("keeps a non-default page size in a hidden field", () => {
    const { filters } = toApplicationsPageView(applicationListPage([], { pageSize: 50 }));
    expect(filters.hidden).toEqual([{ name: "pageSize", value: "50" }]);
  });

  it("treats only search, type, status, and review state as active filters", () => {
    expect(hasActiveFilters(parseApplicationListFilters({ sort: "score_desc", page: 3, pageSize: 10 }))).toBe(false);
    expect(hasActiveFilters(parseApplicationListFilters({ search: "  " }))).toBe(false);
    expect(hasActiveFilters(parseApplicationListFilters({ reviewState: "reviewed" }))).toBe(true);
    expect(hasActiveFilters(parseApplicationListFilters({ status: "draft" }))).toBe(true);
  });
});

describe("toApplicationsPageView results", () => {
  it("builds display-ready rows", () => {
    const view = toApplicationsPageView(applicationListPage(sampleListItems()));
    expect(view.results.state).toBe("results");
    expect(view.results.countText).toBe("4 applications");
    expect(view.results.rangeText).toBe("Showing 1 to 4 of 4");
    expect(view.results.message).toBeNull();
    expect(view.results.cardLabels).toEqual({
      email: ORGANIZER_COPY.applications.email,
      affiliation: ORGANIZER_COPY.applications.affiliation,
    });

    const [reviewed, unreviewed, inProgress, accepted] = view.results.rows;
    expect(reviewed).toEqual({
      id: fixtureApplicationId(1),
      reference: "H-1001",
      referenceLabel: "Applicant H-1001",
      href: organizerApplicationRoute(fixtureApplicationId(1)),
      name: "Test Hacker 1",
      email: "applicant-1@example.com",
      affiliation: "Example University",
      type: "hacker",
      typeLabel: "Hacker",
      status: "in_review",
      statusLabel: "Under review",
      submitted: toTimestampView(ORGANIZER_TIMES.launched),
      submittedFallback: "Not submitted",
      scoreText: "4.00",
      reviewState: "complete",
      reviewStateLabel: "Review complete",
      recommendationLabel: "Strong yes",
    });
    expect(unreviewed).toMatchObject({
      typeLabel: "Judge",
      affiliation: "Example Labs",
      scoreText: "Not scored",
      reviewState: "none",
      reviewStateLabel: "Not reviewed",
      recommendationLabel: null,
    });
    expect(inProgress).toMatchObject({ reviewState: "in-progress", reviewStateLabel: "Review in progress" });
    expect(accepted).toMatchObject({ statusLabel: "Accepted", scoreText: "4.25", recommendationLabel: "Yes" });
  });

  it("falls back to the blind reference for a blank name and hides a blank affiliation", () => {
    const [row] = toApplicationsPageView(
      applicationListPage([listItem({ index: 5, name: "   ", affiliation: " " })]),
    ).results.rows;
    expect(row.name).toBe("H-1005");
    expect(row.affiliation).toBeNull();
  });

  it("shows the not-submitted fallback for a draft", () => {
    const [row] = toApplicationsPageView(
      applicationListPage([listItem({ index: 6, status: "draft" })], { status: "draft" }),
    ).results.rows;
    expect(row.submitted).toBeNull();
    expect(row.statusLabel).toBe("Draft");
  });

  it("marks the sorted column and links sortable columns to their next order on page 1", () => {
    const view = toApplicationsPageView(
      applicationListPage(sampleListItems(), { sort: "submitted_desc", page: 2, type: "hacker" }, 60),
    );
    const columns = new Map(view.results.columns.map((column) => [column.key, column]));
    expect(columns.get("submitted")?.sort).toEqual({
      direction: "descending",
      href: `${LIST}?type=hacker&sort=submitted_asc`,
      actionText: "(sort: Oldest submitted first)",
    });
    expect(columns.get("score")?.sort).toEqual({
      direction: null,
      href: `${LIST}?type=hacker&sort=score_desc`,
      actionText: "(sort: Highest score first)",
    });
    expect(view.results.columns.filter((column) => column.sort === null).map((column) => column.key)).toEqual([
      "applicant",
      "reference",
      "type",
      "status",
      "review",
    ]);
    expect(view.results.caption).toBe("Applications (Newest submitted first)");
  });

  it("toggles an ascending sort back to descending", () => {
    const view = toApplicationsPageView(applicationListPage(sampleListItems(), { sort: "score_asc" }));
    const columns = new Map(view.results.columns.map((column) => [column.key, column]));
    expect(columns.get("score")?.sort).toMatchObject({ direction: "ascending", href: `${LIST}?sort=score_desc` });
    expect(columns.get("submitted")?.sort).toMatchObject({ direction: null, href: LIST });
  });

  it("paginates with links that keep the filters", () => {
    const view = toApplicationsPageView(
      applicationListPage(sampleListItems(), { page: 2, pageSize: 4, status: "in_review" }, 12),
    );
    expect(view.results.rangeText).toBe("Showing 5 to 8 of 12");
    expect(view.results.pagination).toEqual({
      label: "Pages",
      statusText: "Page 2 of 3",
      previous: { label: "Previous page", href: `${LIST}?status=in_review&pageSize=4` },
      next: { label: "Next page", href: `${LIST}?status=in_review&page=3&pageSize=4` },
    });
  });

  it("omits pagination for a single page and links only in available directions", () => {
    expect(toApplicationsPageView(applicationListPage(sampleListItems())).results.pagination).toBeNull();
    const first = toApplicationsPageView(applicationListPage(sampleListItems(), { pageSize: 4 }, 8)).results.pagination;
    expect(first?.previous).toBeNull();
    expect(first?.next?.href).toBe(`${LIST}?page=2&pageSize=4`);
  });

  it("distinguishes the empty, no-results, and past-end states", () => {
    const empty = toApplicationsPageView(applicationListPage([])).results;
    expect(empty).toMatchObject({ state: "empty", countText: "0 applications", rangeText: null, rows: [], pagination: null });
    expect(empty.message).toEqual({
      title: ORGANIZER_COPY.applications.emptyTitle,
      body: ORGANIZER_COPY.applications.emptyBody,
      action: null,
    });

    const noResults = toApplicationsPageView(applicationListPage([], { search: "nobody", sort: "score_desc" })).results;
    expect(noResults.state).toBe("no-results");
    expect(noResults.message).toEqual({
      title: ORGANIZER_COPY.applications.noResultsTitle,
      body: ORGANIZER_COPY.applications.noResultsBody,
      action: { label: "Clear filters", href: `${LIST}?sort=score_desc` },
    });

    const pastEnd = toApplicationsPageView(applicationListPage([], { page: 9, pageSize: 5, type: "judge" }, 12)).results;
    expect(pastEnd.state).toBe("past-end");
    expect(pastEnd.countText).toBe("12 applications");
    expect(pastEnd.message?.action).toEqual({ label: "Go to the last page", href: `${LIST}?type=judge&page=3&pageSize=5` });
  });

  it("counts a single application in the singular", () => {
    expect(toApplicationsPageView(applicationListPage(sampleListItems().slice(0, 1))).results.countText).toBe(
      "1 application",
    );
  });
});
