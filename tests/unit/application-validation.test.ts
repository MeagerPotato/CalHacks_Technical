import { describe, expect, it } from "vitest";

import {
  getApplicationFieldKeys,
  getRequiredApplicationFieldKeys,
  hackerApplicationDraftSchema,
  hackerApplicationSchema,
  isHttpLink,
  judgeApplicationDraftSchema,
  judgeApplicationSchema,
  mergeApplicationResponses,
  parseStoredResponses,
} from "@/lib/validation/application";
import { toFieldErrors } from "@/lib/validation/errors";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";

describe("hacker submission schema", () => {
  it("accepts a complete application", () => {
    expect(hackerApplicationSchema.safeParse(validHackerResponses).success).toBe(true);
  });

  it("reports every missing required field and nothing else", () => {
    const result = hackerApplicationSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;

    const errors = toFieldErrors(result.error);
    expect(Object.keys(errors).sort()).toEqual(getRequiredApplicationFieldKeys("hacker").sort());
    expect(errors.preferredName).toEqual(["This field is required."]);
    expect(errors.links).toBeUndefined();
  });

  it("trims text and rejects whitespace-only answers", () => {
    const trimmed = hackerApplicationSchema.parse({ ...validHackerResponses, preferredName: "  Maya  " });
    expect(trimmed.preferredName).toBe("Maya");

    const blank = hackerApplicationSchema.safeParse({ ...validHackerResponses, bio: "   " });
    expect(blank.success).toBe(false);
  });

  it("enforces maximum lengths", () => {
    const result = hackerApplicationSchema.safeParse({ ...validHackerResponses, buildGoals: "x".repeat(1501) });
    expect(result.success).toBe(false);
  });

  it("requires the code of conduct to be accepted", () => {
    expect(hackerApplicationSchema.safeParse({ ...validHackerResponses, codeOfConductAccepted: false }).success).toBe(
      false,
    );
  });

  it("rejects unknown option values, duplicates, and empty selections", () => {
    expect(hackerApplicationSchema.safeParse({ ...validHackerResponses, skills: ["web", "cooking"] }).success).toBe(
      false,
    );
    expect(hackerApplicationSchema.safeParse({ ...validHackerResponses, skills: ["web", "web"] }).success).toBe(false);
    expect(hackerApplicationSchema.safeParse({ ...validHackerResponses, skills: [] }).success).toBe(false);
    expect(
      hackerApplicationSchema.safeParse({ ...validHackerResponses, experienceLevel: "expert" }).success,
    ).toBe(false);
  });

  it("only accepts http and https links with a domain name", () => {
    const withLinks = (links: string[]) => hackerApplicationSchema.safeParse({ ...validHackerResponses, links });
    expect(withLinks(["https://example.com/me"]).success).toBe(true);
    expect(withLinks(["http://example.com:8080/path?x=1#top"]).success).toBe(true);
    expect(withLinks(["javascript:alert(1)"]).success).toBe(false);
    expect(withLinks(["ftp://example.com/file"]).success).toBe(false);
    expect(withLinks(["https://localhost:3000"]).success).toBe(false);
    expect(withLinks(["https://example.com/a b"]).success).toBe(false);
    expect(withLinks(Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`)).success).toBe(false);
  });

  it("exposes the submission link rule for safely rendering stored links", () => {
    expect(isHttpLink("https://example.com")).toBe(true);
    expect(isHttpLink("javascript:alert(1)")).toBe(false);
    expect(isHttpLink(`https://example.com/${"p".repeat(300)}`)).toBe(false);
    expect(isHttpLink(42)).toBe(false);
  });

  it("rejects non-integer, string, and out-of-range numbers", () => {
    const withYear = (graduationYear: unknown) =>
      hackerApplicationSchema.safeParse({ ...validHackerResponses, graduationYear });
    expect(withYear(2027.5).success).toBe(false);
    expect(withYear("2027").success).toBe(false);
    expect(withYear(1999).success).toBe(false);
    expect(withYear(2041).success).toBe(false);
  });

  it("strips unknown keys", () => {
    const parsed = hackerApplicationSchema.parse({ ...validHackerResponses, isOrganizer: true });
    expect(parsed).not.toHaveProperty("isOrganizer");
  });
});

describe("judge submission schema", () => {
  it("accepts a complete application", () => {
    expect(judgeApplicationSchema.safeParse(validJudgeResponses).success).toBe(true);
  });

  it("allows the optional company and conflicts of interest to be blank or absent", () => {
    const withoutOptional: Record<string, unknown> = { ...validJudgeResponses };
    delete withoutOptional.company;
    delete withoutOptional.conflictsOfInterest;
    expect(judgeApplicationSchema.safeParse(withoutOptional).success).toBe(true);
    expect(judgeApplicationSchema.safeParse({ ...validJudgeResponses, company: "" }).success).toBe(true);
  });

  it("has genuinely different questions from the hacker form", () => {
    expect(judgeApplicationSchema.safeParse(validHackerResponses).success).toBe(false);
    expect(hackerApplicationSchema.safeParse(validJudgeResponses).success).toBe(false);

    const hackerRequired = getRequiredApplicationFieldKeys("hacker");
    const judgeRequired = getRequiredApplicationFieldKeys("judge");
    expect(hackerRequired).toHaveLength(12);
    expect(judgeRequired).toHaveLength(12);
    expect(hackerRequired.filter((key) => !judgeRequired.includes(key))).toEqual(
      expect.arrayContaining(["school", "major", "graduationYear", "skills", "buildGoals"]),
    );
    expect(judgeRequired.filter((key) => !hackerRequired.includes(key))).toEqual(
      expect.arrayContaining(["roleTitle", "expertiseAreas", "availability", "evaluationApproach"]),
    );
  });
});

describe("draft schemas", () => {
  it("accept partial answers and strip unknown keys", () => {
    const result = hackerApplicationDraftSchema.safeParse({ school: "Example University", isOrganizer: true });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ school: "Example University" });
  });

  it("accept null to clear an answer and false for an unchecked agreement", () => {
    expect(judgeApplicationDraftSchema.safeParse({ expertiseAreas: null, codeOfConductAccepted: false }).success).toBe(
      true,
    );
  });

  it("still enforce types, option values, and limits", () => {
    expect(hackerApplicationDraftSchema.safeParse({ graduationYear: "2027" }).success).toBe(false);
    expect(hackerApplicationDraftSchema.safeParse({ skills: ["cooking"] }).success).toBe(false);
    expect(hackerApplicationDraftSchema.safeParse({ bio: "x".repeat(601) }).success).toBe(false);
    expect(judgeApplicationDraftSchema.safeParse({ links: "https://example.com" }).success).toBe(false);
  });
});

describe("mergeApplicationResponses", () => {
  it("keeps stored answers, applies the patch, clears null/blank values, and drops unknown keys", () => {
    const merged = mergeApplicationResponses(
      "hacker",
      { preferredName: "Maya", bio: "Builder", legacyField: "remove me" },
      { bio: null, school: "Example University", location: "   ", notAField: "ignored" },
    );
    expect(merged).toEqual({ preferredName: "Maya", school: "Example University" });
  });

  it("ignores undefined patch values", () => {
    expect(mergeApplicationResponses("judge", { roleTitle: "Engineer" }, { roleTitle: undefined })).toEqual({
      roleTitle: "Engineer",
    });
  });
});

describe("parseStoredResponses", () => {
  it("returns only valid known answers", () => {
    expect(
      parseStoredResponses("hacker", {
        school: "Example University",
        graduationYear: "not a number",
        skills: ["web", "not-an-option"],
        unknown: "x",
      }),
    ).toEqual({ school: "Example University" });
  });

  it("handles non-object input", () => {
    expect(parseStoredResponses("judge", null)).toEqual({});
    expect(parseStoredResponses("judge", ["a"])).toEqual({});
  });
});

describe("field keys", () => {
  it("lists every schema key exactly once in form order", () => {
    for (const [type, schema] of [
      ["hacker", hackerApplicationSchema],
      ["judge", judgeApplicationSchema],
    ] as const) {
      const keys = getApplicationFieldKeys(type);
      expect(new Set(keys).size).toBe(keys.length);
      expect([...keys].sort()).toEqual(Object.keys(schema.shape).sort());
    }
  });
});
