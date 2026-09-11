import { describe, expect, it } from "vitest";

import {
  APPLICATION_LIMITS,
  COUNTRY_CODES,
  getApplicationFieldKeys,
  getRequiredApplicationFieldKeys,
  hackerApplicationDraftSchema,
  hackerApplicationSchema,
  isCalendarDate,
  isProfileLink,
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
    expect(errors.fullName).toEqual(["This field is required."]);
    expect(errors.birthdate).toEqual(["This field is required."]);
    expect(errors.countryOfResidence).toEqual(["This field is required."]);
    for (const optional of ["bio", "linkedinUrl", "githubUrl", "devpostUrl"]) {
      expect(errors[optional], optional).toBeUndefined();
    }
  });

  it("trims text and rejects whitespace-only required answers", () => {
    const trimmed = hackerApplicationSchema.parse({ ...validHackerResponses, fullName: "  Maya  " });
    expect(trimmed.fullName).toBe("Maya");

    expect(hackerApplicationSchema.safeParse({ ...validHackerResponses, cityOfResidence: "   " }).success).toBe(false);
    // The short biography is optional, so a blank one is allowed.
    expect(hackerApplicationSchema.safeParse({ ...validHackerResponses, bio: "   " }).success).toBe(true);
  });

  it("enforces maximum lengths", () => {
    expect(hackerApplicationSchema.safeParse({ ...validHackerResponses, buildGoals: "x".repeat(1501) }).success).toBe(
      false,
    );
    expect(hackerApplicationSchema.safeParse({ ...validHackerResponses, fullName: "x".repeat(121) }).success).toBe(
      false,
    );
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

  it("accepts only real birthdates within the allowed range", () => {
    const withBirthdate = (birthdate: unknown) =>
      hackerApplicationSchema.safeParse({ ...validHackerResponses, birthdate }).success;
    expect(withBirthdate("2004-02-29")).toBe(true);
    expect(withBirthdate(APPLICATION_LIMITS.birthdate.min)).toBe(true);
    expect(withBirthdate(APPLICATION_LIMITS.birthdate.max)).toBe(true);
    expect(withBirthdate("2005-02-29")).toBe(false);
    expect(withBirthdate("2005-13-01")).toBe(false);
    expect(withBirthdate("2005-04-31")).toBe(false);
    expect(withBirthdate("1899-12-31")).toBe(false);
    expect(withBirthdate("2026-09-21")).toBe(false);
    expect(withBirthdate("2005-4-12")).toBe(false);
    expect(withBirthdate("04/12/2005")).toBe(false);
    expect(withBirthdate(" 2005-04-12")).toBe(false);
    expect(withBirthdate(20050412)).toBe(false);

    const message = hackerApplicationSchema.safeParse({ ...validHackerResponses, birthdate: "2005-02-30" });
    expect(message.success ? [] : toFieldErrors(message.error).birthdate).toEqual([
      "Enter a real date from January 1, 1900 to September 20, 2026.",
    ]);
  });

  it("recognizes real calendar dates", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2023-02-29")).toBe(false);
    expect(isCalendarDate("0050-01-01")).toBe(false);
    expect(isCalendarDate("2024-00-10")).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
  });

  it("accepts only listed country codes, with the United States first", () => {
    const withCountry = (countryOfResidence: unknown) =>
      hackerApplicationSchema.safeParse({ ...validHackerResponses, countryOfResidence }).success;
    expect(COUNTRY_CODES[0]).toBe("US");
    expect(withCountry("CA")).toBe(true);
    expect(withCountry("us")).toBe(false);
    expect(withCountry("United States")).toBe(false);
    expect(withCountry("EU")).toBe(false);
  });

  it("accepts only profile links on each field's own site", () => {
    const withLink = (key: string, value: unknown) =>
      hackerApplicationSchema.safeParse({ ...validHackerResponses, [key]: value }).success;

    expect(withLink("linkedinUrl", "https://www.linkedin.com/in/maya-chen")).toBe(true);
    expect(withLink("linkedinUrl", "https://linkedin.com/in/maya-chen/")).toBe(true);
    expect(withLink("linkedinUrl", "https://uk.linkedin.com/in/maya")).toBe(true);
    expect(withLink("linkedinUrl", "https://www.linkedin.com/company/example")).toBe(false);
    expect(withLink("linkedinUrl", "https://www.linkedin.com/in/ab")).toBe(false);
    expect(withLink("linkedinUrl", "https://github.com/maya")).toBe(false);

    expect(withLink("githubUrl", "https://github.com/maya-chen")).toBe(true);
    expect(withLink("githubUrl", "http://www.github.com/m")).toBe(true);
    expect(withLink("githubUrl", "https://github.com/-maya")).toBe(false);
    expect(withLink("githubUrl", "https://github.com/maya-")).toBe(false);
    expect(withLink("githubUrl", "https://github.com/maya--chen")).toBe(false);
    expect(withLink("githubUrl", "https://github.com/maya/repo")).toBe(false);
    expect(withLink("githubUrl", `https://github.com/${"a".repeat(40)}`)).toBe(false);
    expect(withLink("githubUrl", " https://github.com/maya")).toBe(false);

    expect(withLink("devpostUrl", "https://devpost.com/maya_chen")).toBe(true);
    expect(withLink("devpostUrl", "https://devpost.com/software/project")).toBe(false);
    expect(withLink("devpostUrl", "javascript:alert(1)")).toBe(false);
    expect(withLink("devpostUrl", "")).toBe(false);
  });

  it("exposes the profile link rule for safely rendering stored links", () => {
    expect(isProfileLink("githubUrl", "https://github.com/maya")).toBe(true);
    expect(isProfileLink("githubUrl", "https://www.linkedin.com/in/maya")).toBe(false);
    expect(isProfileLink("devpostUrl", 42)).toBe(false);
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

  it("shares the About you section with the hacker form and has different questions after it", () => {
    expect(judgeApplicationSchema.safeParse(validHackerResponses).success).toBe(false);
    expect(hackerApplicationSchema.safeParse(validJudgeResponses).success).toBe(false);

    const hackerRequired = getRequiredApplicationFieldKeys("hacker");
    const judgeRequired = getRequiredApplicationFieldKeys("judge");
    expect(hackerRequired).toHaveLength(13);
    expect(judgeRequired).toHaveLength(13);
    expect(getApplicationFieldKeys("hacker").slice(0, 8)).toEqual(getApplicationFieldKeys("judge").slice(0, 8));
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
    expect(judgeApplicationDraftSchema.safeParse({ birthdate: null, githubUrl: null }).success).toBe(true);
  });

  it("still enforce types, option values, limits, real dates, and profile links", () => {
    expect(hackerApplicationDraftSchema.safeParse({ graduationYear: "2027" }).success).toBe(false);
    expect(hackerApplicationDraftSchema.safeParse({ skills: ["cooking"] }).success).toBe(false);
    expect(hackerApplicationDraftSchema.safeParse({ bio: "x".repeat(601) }).success).toBe(false);
    expect(hackerApplicationDraftSchema.safeParse({ birthdate: "2005-02-30" }).success).toBe(false);
    expect(hackerApplicationDraftSchema.safeParse({ countryOfResidence: "Narnia" }).success).toBe(false);
    expect(judgeApplicationDraftSchema.safeParse({ githubUrl: "https://example.com" }).success).toBe(false);
  });
});

describe("mergeApplicationResponses", () => {
  it("keeps stored answers, applies the patch, clears null/blank values, and drops unknown keys", () => {
    const merged = mergeApplicationResponses(
      "hacker",
      { fullName: "Maya", bio: "Builder", legacyField: "remove me", preferredName: "Old key" },
      { bio: null, school: "Example University", cityOfResidence: "   ", notAField: "ignored" },
    );
    expect(merged).toEqual({ fullName: "Maya", school: "Example University" });
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
        birthdate: "2005-02-30",
        githubUrl: "https://example.com/maya",
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

  it("orders About you as specified for Round 2", () => {
    expect(getApplicationFieldKeys("hacker").slice(0, 8)).toEqual([
      "fullName",
      "birthdate",
      "countryOfResidence",
      "cityOfResidence",
      "linkedinUrl",
      "githubUrl",
      "devpostUrl",
      "bio",
    ]);
  });
});
