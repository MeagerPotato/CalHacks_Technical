import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
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
