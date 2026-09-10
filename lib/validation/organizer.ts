import { z } from "zod";

import { APPLICATION_STATUSES, APPLICATION_TYPES, DECISION_STATUSES } from "@/lib/domain/enums";

export const REVIEW_STATE_FILTERS = ["reviewed", "unreviewed"] as const;
export type ReviewStateFilter = (typeof REVIEW_STATE_FILTERS)[number];

export const APPLICATION_SORTS = ["submitted_desc", "submitted_asc", "score_desc", "score_asc"] as const;
export type ApplicationSort = (typeof APPLICATION_SORTS)[number];

export const DEFAULT_APPLICATION_SORT: ApplicationSort = "submitted_desc";
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const SEARCH_MAX_LENGTH = 100;

export const applicationIdSchema = z.uuid({ error: "Invalid application id." });

/**
 * Organizer list filters. Lenient: invalid values fall back to defaults so that
 * query-string-backed filters never throw on a malformed URL.
 */
export const applicationListFiltersSchema = z.object({
  search: z.string().trim().max(SEARCH_MAX_LENGTH).optional().catch(undefined),
  type: z.enum(APPLICATION_TYPES).optional().catch(undefined),
  status: z.enum(APPLICATION_STATUSES).optional().catch(undefined),
  reviewState: z.enum(REVIEW_STATE_FILTERS).optional().catch(undefined),
  sort: z.enum(APPLICATION_SORTS).catch(DEFAULT_APPLICATION_SORT),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
});

export type ApplicationListFilters = z.output<typeof applicationListFiltersSchema>;
export type ApplicationListFiltersInput = Partial<{
  search: string;
  type: string;
  status: string;
  reviewState: string;
  sort: string;
  page: number | string;
  pageSize: number | string;
}>;

type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

const FILTER_KEYS = ["search", "type", "status", "reviewState", "sort", "page", "pageSize"] as const;

/** Parses Next.js searchParams (or URLSearchParams) into validated list filters. */
export function parseApplicationListFilters(input: SearchParamsLike | ApplicationListFiltersInput = {}): ApplicationListFilters {
  const raw: Record<string, unknown> = {};

  for (const key of FILTER_KEYS) {
    let value: unknown;
    if (input instanceof URLSearchParams) {
      value = input.get(key) ?? undefined;
    } else {
      const candidate = (input as Record<string, unknown>)[key];
      value = Array.isArray(candidate) ? candidate[0] : candidate;
    }
    if (typeof value === "string" && value.trim() === "") {
      value = undefined;
    }
    raw[key] = value;
  }

  const filters = applicationListFiltersSchema.parse(raw);
  return { ...filters, search: filters.search ? filters.search : undefined };
}

/** Serializes filters into query-string params, omitting defaults, for shareable URLs. */
export function toApplicationListSearchParams(filters: Partial<ApplicationListFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.reviewState) params.set("reviewState", filters.reviewState);
  if (filters.sort && filters.sort !== DEFAULT_APPLICATION_SORT) params.set("sort", filters.sort);
  if (filters.page && filters.page !== 1) params.set("page", String(filters.page));
  if (filters.pageSize && filters.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(filters.pageSize));
  return params;
}

export const decisionSchema = z.enum(DECISION_STATUSES, { error: "Decision must be accepted or waitlisted." });
