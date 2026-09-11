import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  decisionSchema,
  parseApplicationListFilters,
  toApplicationListSearchParams,
} from "@/lib/validation/organizer";

describe("parseApplicationListFilters", () => {
  it("returns defaults for empty input", () => {
    expect(parseApplicationListFilters()).toEqual({
      search: undefined,
      type: undefined,
      status: undefined,
      reviewState: undefined,
      sort: "submitted_desc",
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("parses Next.js searchParams and takes the first repeated value", () => {
    expect(
      parseApplicationListFilters({
        search: ["  maya ", "ignored"],
        type: "hacker",
        status: "submitted",
        reviewState: "unreviewed",
        sort: "score_desc",
        page: "3",
        pageSize: "10",
      }),
    ).toEqual({
      search: "maya",
      type: "hacker",
      status: "submitted",
      reviewState: "unreviewed",
      sort: "score_desc",
      page: 3,
      pageSize: 10,
    });
  });

  it("falls back to defaults for invalid values instead of throwing", () => {
    expect(
      parseApplicationListFilters(
        new URLSearchParams("type=organizer&status=rejected&reviewState=maybe&sort=name&page=-2&pageSize=1000"),
      ),
    ).toMatchObject({
      type: undefined,
      status: undefined,
      reviewState: undefined,
      sort: "submitted_desc",
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("falls back to page 1 when the page would overflow the database offset", () => {
    expect(parseApplicationListFilters({ page: String(MAX_PAGE) }).page).toBe(MAX_PAGE);
    expect(parseApplicationListFilters({ page: String(MAX_PAGE + 1) }).page).toBe(1);
    expect(parseApplicationListFilters(new URLSearchParams("page=99999999999")).page).toBe(1);
    expect((MAX_PAGE - 1) * MAX_PAGE_SIZE).toBeLessThanOrEqual(2_147_483_647);
  });

  it("removes NUL characters from the search, which the database cannot store", () => {
    const nul = String.fromCharCode(0);
    expect(parseApplicationListFilters(new URLSearchParams("search=%00")).search).toBeUndefined();
    expect(parseApplicationListFilters(new URLSearchParams("search=maya%00")).search).toBe("maya");
    expect(parseApplicationListFilters({ search: ` ma${nul}ya ${nul}` }).search).toBe("maya");
  });

  it("round-trips through query-string params, omitting defaults", () => {
    const filters = parseApplicationListFilters({ type: "judge", sort: "score_asc", page: "2" });
    const params = toApplicationListSearchParams(filters);
    expect(params.toString()).toBe("type=judge&sort=score_asc&page=2");
    expect(parseApplicationListFilters(params)).toEqual(filters);
  });
});

describe("decisionSchema", () => {
  it("allows only accepted or waitlisted", () => {
    expect(decisionSchema.safeParse("accepted").success).toBe(true);
    expect(decisionSchema.safeParse("waitlisted").success).toBe(true);
    for (const status of ["rejected", "draft", "submitted", "in_review", ""]) {
      expect(decisionSchema.safeParse(status).success).toBe(false);
    }
  });
});
