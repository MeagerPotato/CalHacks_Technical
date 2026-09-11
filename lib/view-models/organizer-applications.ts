import { ORGANIZER_COPY } from "@/content/copy";
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import type { ApplicationListPage } from "@/lib/data/types";
import { APPLICATION_STATUSES, APPLICATION_TYPES } from "@/lib/domain/enums";
import { ROUTES } from "@/lib/routes";
import {
  APPLICATION_SORTS,
  DEFAULT_PAGE_SIZE,
  REVIEW_STATE_FILTERS,
  type ApplicationListFilters,
  type ApplicationSort,
} from "@/lib/validation/organizer";
import { applicationsHref } from "@/lib/view-models/organizer-routes";
import { toApplicationRowView } from "@/lib/view-models/organizer-shared";
import type {
  ApplicationFiltersView,
  ApplicationsPageView,
  ApplicationsResultState,
  ApplicationsResultsView,
  MessageView,
  PaginationView,
  SortDirection,
  TableColumnView,
} from "@/lib/view-models/organizer-types";

// =============================================================================
// Applications table view model.
//
// Only server code may call this (the applications page): rows carry server-formatted timestamps. Filters arrive
// already parsed by lib/validation/organizer.ts, and every link is built from them, so the query string stays the
// single source of the table's state.
// =============================================================================

/** Ids of the filter controls. */
export const APPLICATION_FILTER_IDS = {
  search: "filter-search",
  type: "filter-type",
  status: "filter-status",
  reviewState: "filter-review-state",
  sort: "filter-sort",
} as const;

const SORTABLE_COLUMNS = {
  submitted: { descending: "submitted_desc", ascending: "submitted_asc" },
  score: { descending: "score_desc", ascending: "score_asc" },
} as const satisfies Record<string, Record<SortDirection, ApplicationSort>>;

/** True while a search, type, status, or review-state filter narrows the list. Sort and page size do not. */
export function hasActiveFilters(filters: ApplicationListFilters): boolean {
  return Boolean(filters.search || filters.type || filters.status || filters.reviewState);
}

function clearFiltersHref(filters: ApplicationListFilters): string {
  return applicationsHref({ sort: filters.sort, pageSize: filters.pageSize });
}

function toFiltersView(filters: ApplicationListFilters): ApplicationFiltersView {
  const copy = ORGANIZER_COPY.applications;
  return {
    title: copy.filtersTitle,
    action: ROUTES.organizerApplications,
    search: {
      id: APPLICATION_FILTER_IDS.search,
      name: "search",
      label: copy.search,
      hint: copy.searchHint,
      value: filters.search ?? "",
    },
    selects: [
      {
        id: APPLICATION_FILTER_IDS.type,
        name: "type",
        label: copy.type,
        value: filters.type ?? "",
        options: [
          { value: "", label: copy.anyType },
          ...APPLICATION_TYPES.map((type) => ({ value: type, label: APPLICATION_TYPE_LABELS[type] })),
        ],
      },
      {
        id: APPLICATION_FILTER_IDS.status,
        name: "status",
        label: copy.status,
        value: filters.status ?? "",
        options: [
          { value: "", label: copy.anyStatus },
          ...APPLICATION_STATUSES.map((status) => ({ value: status, label: APPLICATION_STATUS_LABELS[status] })),
        ],
      },
      {
        id: APPLICATION_FILTER_IDS.reviewState,
        name: "reviewState",
        label: copy.reviewState,
        value: filters.reviewState ?? "",
        options: [
          { value: "", label: copy.anyReviewState },
          ...REVIEW_STATE_FILTERS.map((state) => ({ value: state, label: copy.reviewStateOptions[state] })),
        ],
      },
      {
        id: APPLICATION_FILTER_IDS.sort,
        name: "sort",
        label: copy.sort,
        value: filters.sort,
        options: APPLICATION_SORTS.map((sort) => ({ value: sort, label: copy.sortOptions[sort] })),
      },
    ],
    hidden: filters.pageSize === DEFAULT_PAGE_SIZE ? [] : [{ name: "pageSize", value: String(filters.pageSize) }],
    submitLabel: copy.apply,
    clear: hasActiveFilters(filters) ? { label: copy.clear, href: clearFiltersHref(filters) } : null,
  };
}

function toSort(column: keyof typeof SORTABLE_COLUMNS, filters: ApplicationListFilters): TableColumnView["sort"] {
  const orders = SORTABLE_COLUMNS[column];
  let direction: SortDirection | null = null;
  if (filters.sort === orders.descending) {
    direction = "descending";
  } else if (filters.sort === orders.ascending) {
    direction = "ascending";
  }
  // A column sorts descending first (newest, highest), then toggles.
  const nextSort = direction === "descending" ? orders.ascending : orders.descending;
  return {
    direction,
    href: applicationsHref({ ...filters, sort: nextSort, page: 1 }),
    actionText: ORGANIZER_COPY.applications.sortAction(ORGANIZER_COPY.applications.sortOptions[nextSort]),
  };
}

function toColumns(filters: ApplicationListFilters): TableColumnView[] {
  const labels = ORGANIZER_COPY.applications.columns;
  return [
    { key: "applicant", label: labels.applicant, sort: null },
    { key: "reference", label: labels.reference, sort: null },
    { key: "type", label: labels.type, sort: null },
    { key: "status", label: labels.status, sort: null },
    { key: "submitted", label: labels.submitted, sort: toSort("submitted", filters) },
    { key: "score", label: labels.score, sort: toSort("score", filters) },
    { key: "review", label: labels.review, sort: null },
  ];
}

function toResultState(page: ApplicationListPage): ApplicationsResultState {
  if (page.items.length > 0) {
    return "results";
  }
  if (page.total > 0) {
    return "past-end";
  }
  return hasActiveFilters(page.filters) ? "no-results" : "empty";
}

function toMessage(state: ApplicationsResultState, page: ApplicationListPage): MessageView | null {
  const copy = ORGANIZER_COPY.applications;
  switch (state) {
    case "results":
      return null;
    case "empty":
      return { title: copy.emptyTitle, body: copy.emptyBody, action: null };
    case "no-results":
      return {
        title: copy.noResultsTitle,
        body: copy.noResultsBody,
        action: { label: copy.clear, href: clearFiltersHref(page.filters) },
      };
    case "past-end":
      return {
        title: copy.pastEndTitle,
        body: copy.pastEndBody,
        action: { label: copy.lastPage, href: applicationsHref({ ...page.filters, page: page.pageCount }) },
      };
  }
}

function toPagination(state: ApplicationsResultState, page: ApplicationListPage): PaginationView | null {
  if (state !== "results" || page.pageCount <= 1) {
    return null;
  }
  const copy = ORGANIZER_COPY.applications;
  return {
    label: copy.paginationLabel,
    statusText: copy.pageStatus(page.page, page.pageCount),
    previous:
      page.page > 1 ? { label: copy.previousPage, href: applicationsHref({ ...page.filters, page: page.page - 1 }) } : null,
    next:
      page.page < page.pageCount
        ? { label: copy.nextPage, href: applicationsHref({ ...page.filters, page: page.page + 1 }) }
        : null,
  };
}

function toResultsView(page: ApplicationListPage): ApplicationsResultsView {
  const copy = ORGANIZER_COPY.applications;
  const state = toResultState(page);
  const rows = page.items.map(toApplicationRowView);
  const first = (page.page - 1) * page.pageSize + 1;

  return {
    state,
    countText: copy.resultCount(page.total),
    rangeText:
      rows.length > 0 ? copy.range(first, first + rows.length - 1, page.total) : null,
    caption: copy.caption(copy.sortOptions[page.filters.sort]),
    columns: toColumns(page.filters),
    rows,
    cardLabels: { email: copy.email, affiliation: copy.affiliation },
    message: toMessage(state, page),
    pagination: toPagination(state, page),
  };
}

/**
 * The applications page: the GET filter form (search, type, status, review state, sort) with its current values, and
 * the results. Results are `results`, `empty` (nothing submitted and no filters), `no-results` (filters match
 * nothing), or `past-end` (a page number beyond the last page, with a link to the last page). Sortable columns
 * (submitted, score) carry their current direction for `aria-sort` and a link that toggles it and returns to page 1.
 */
export function toApplicationsPageView(page: ApplicationListPage): ApplicationsPageView {
  return {
    heading: ORGANIZER_COPY.applications.heading,
    intro: ORGANIZER_COPY.applications.intro,
    filters: toFiltersView(page.filters),
    results: toResultsView(page),
  };
}
