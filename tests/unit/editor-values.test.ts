import { describe, expect, it } from "vitest";

import { APPLICATION_FORMS, type ApplicationFieldConfig } from "@/lib/application-config";
import type { ApplicantApplication } from "@/lib/data/types";
import type { ApplicationStatus, ApplicationType } from "@/lib/domain/enums";
import { deriveMissionState } from "@/lib/domain/mission";
import {
  buildDraftPatch,
  countCharacters,
  isNewerApplication,
  payloadEqual,
  toPayloadValue,
  toUiValues,
  uiValueEqual,
  validateDraftValue,
  type UiValues,
} from "@/lib/editor/values";
import {
  HACKER_SKILLS,
  getApplicationFieldKeys,
  hackerApplicationSchema,
  judgeApplicationSchema,
} from "@/lib/validation/application";
import { calculateApplicationCompletion } from "@/lib/validation/completion";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";

const GRADUATION_YEAR_MESSAGE = "Enter a whole number from 2000 to 2040.";

function formFields(type: ApplicationType): ApplicationFieldConfig[] {
  return APPLICATION_FORMS[type].sections.flatMap((section) => section.fields);
}

function fieldFor(type: ApplicationType, key: string): ApplicationFieldConfig {
  const field = formFields(type).find((candidate) => candidate.key === key);
  if (!field) {
    throw new Error(`The ${type} form has no field named ${key}.`);
  }
  return field;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

/** Drops answers the editor treats as unanswered: blank text and empty lists. */
function withoutBlankAnswers(responses: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(responses).filter(([, value]) => value !== "" && !(Array.isArray(value) && value.length === 0)),
  );
}

function makeApplication(updatedAt: string, status: ApplicationStatus = "draft"): ApplicantApplication {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    referenceNumber: 1042,
    applicantReference: "H-1042",
    type: "hacker",
    status,
    completionPercent: 0,
    launchedAt: null,
    reviewStartedAt: null,
    decisionReleasedAt: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt,
    responses: {},
    completion: calculateApplicationCompletion("hacker", {}),
    mission: deriveMissionState({ status, launched_at: null, review_started_at: null, decision_released_at: null }),
    isEditable: status === "draft",
  };
}

describe("toUiValues", () => {
  it("gives every form field an empty value of its kind", () => {
    for (const type of ["hacker", "judge"] as const) {
      const values = toUiValues(type, {});
      expect(Object.keys(values)).toEqual(getApplicationFieldKeys(type));
      for (const field of formFields(type)) {
        const empty = field.kind === "multi_choice" ? [] : field.kind === "agreement" ? false : "";
        expect(values[field.key], field.key).toEqual(empty);
      }
    }
  });

  it("converts stored answers per kind", () => {
    const values = toUiValues("hacker", {
      ...validHackerResponses,
      previousHackathonCount: 0,
    });

    expect(values).toMatchObject({
      fullName: "Test Hacker",
      birthdate: "2005-04-12",
      countryOfResidence: "US",
      githubUrl: "https://github.com/test-hacker",
      linkedinUrl: "",
      bio: validHackerResponses.bio,
      graduationYear: "2027",
      previousHackathonCount: "0",
      experienceLevel: "intermediate",
      skills: ["web", "ai_ml"],
      codeOfConductAccepted: true,
    });
  });

  it("treats wrongly typed stored values as unanswered", () => {
    expect(
      toUiValues("hacker", {
        bio: 42,
        birthdate: 20050412,
        countryOfResidence: ["US"],
        graduationYear: "2027",
        skills: "web",
        codeOfConductAccepted: "true",
      }),
    ).toMatchObject({
      bio: "",
      birthdate: "",
      countryOfResidence: "",
      graduationYear: "",
      skills: [],
      codeOfConductAccepted: false,
    });
  });

  it("copies arrays so editing values never changes the saved responses", () => {
    const responses = { skills: ["web"] };
    const values = toUiValues("hacker", responses);
    (values.skills as string[]).push("data");
    expect(responses.skills).toEqual(["web"]);
  });

  it("accepts an application's saved responses", () => {
    const application = makeApplication("2026-09-10T10:00:00.000Z");
    expect(toUiValues(application.type, application.responses)).toEqual(toUiValues("hacker", {}));
  });
});

describe("toPayloadValue", () => {
  it("trims text and clears blank answers", () => {
    const bio = fieldFor("hacker", "bio");
    expect(toPayloadValue(bio, "  Builder  ")).toBe("Builder");
    expect(toPayloadValue(bio, "   ")).toBeNull();
    expect(toPayloadValue(fieldFor("judge", "roleTitle"), "")).toBeNull();
  });

  it.each<[string, number | string | null]>([
    ["2027", 2027],
    [" 42 ", 42],
    ["0012", 12],
    ["", null],
    ["   ", null],
    ["20.5", "20.5"],
    ["abc", "abc"],
    ["-1", "-1"],
    ["1e3", "1e3"],
    ["1234567890", "1234567890"],
  ])("converts the whole-number input %j to %j", (input, expected) => {
    expect(toPayloadValue(fieldFor("hacker", "graduationYear"), input)).toBe(expected);
  });

  it("lets the draft schema report whole numbers that are not plain digits or out of range", () => {
    const graduationYear = fieldFor("hacker", "graduationYear");
    for (const input of ["20.5", "abc", "-1", "1e3", "1234567890", "0012"]) {
      expect(validateDraftValue("hacker", "graduationYear", toPayloadValue(graduationYear, input)), input).toEqual([
        GRADUATION_YEAR_MESSAGE,
      ]);
    }
    expect(validateDraftValue("hacker", "graduationYear", toPayloadValue(graduationYear, "2027"))).toEqual([]);
    expect(validateDraftValue("hacker", "graduationYear", toPayloadValue(graduationYear, ""))).toEqual([]);

    const hackathons = fieldFor("hacker", "previousHackathonCount");
    expect(validateDraftValue("hacker", "previousHackathonCount", toPayloadValue(hackathons, " 42 "))).toEqual([]);
    expect(validateDraftValue("hacker", "previousHackathonCount", toPayloadValue(hackathons, "0012"))).toEqual([]);
  });

  it("clears an empty single or searchable choice", () => {
    const level = fieldFor("hacker", "experienceLevel");
    expect(toPayloadValue(level, "")).toBeNull();
    expect(toPayloadValue(level, "beginner")).toBe("beginner");

    const country = fieldFor("judge", "countryOfResidence");
    expect(toPayloadValue(country, "")).toBeNull();
    expect(toPayloadValue(country, "CA")).toBe("CA");
  });

  it("trims dates and profile links and clears blank ones", () => {
    const birthdate = fieldFor("hacker", "birthdate");
    expect(toPayloadValue(birthdate, "2005-04-12")).toBe("2005-04-12");
    expect(toPayloadValue(birthdate, "")).toBeNull();

    const github = fieldFor("judge", "githubUrl");
    expect(toPayloadValue(github, "  https://github.com/maya  ")).toBe("https://github.com/maya");
    expect(toPayloadValue(github, "   ")).toBeNull();
    expect(validateDraftValue("judge", "githubUrl", toPayloadValue(github, "https://example.com/maya"))).toEqual([
      "Enter a GitHub profile link, like https://github.com/your-username",
    ]);
  });

  it("dedupes multi-choice values in option order and keeps unknown values for validation", () => {
    const skills = fieldFor("hacker", "skills");
    expect(toPayloadValue(skills, ["ai_ml", "web", "ai_ml"])).toEqual(["web", "ai_ml"]);
    expect(toPayloadValue(skills, [])).toBeNull();

    const tampered = toPayloadValue(skills, ["cooking", "web", "cooking", "juggling"]);
    expect(tampered).toEqual(["web", "cooking", "juggling"]);
    expect(validateDraftValue("hacker", "skills", tampered)).toEqual(["Choose from the listed options."]);
  });

  it("sends an accepted agreement and clears an unchecked one", () => {
    const agreement = fieldFor("hacker", "codeOfConductAccepted");
    expect(toPayloadValue(agreement, true)).toBe(true);
    expect(toPayloadValue(agreement, false)).toBeNull();
  });
});

describe("value equality", () => {
  it("compares UI values by content", () => {
    expect(uiValueEqual("a", "a")).toBe(true);
    expect(uiValueEqual("a", "a ")).toBe(false);
    expect(uiValueEqual(["web", "data"], ["web", "data"])).toBe(true);
    expect(uiValueEqual(["web", "data"], ["data", "web"])).toBe(false);
    expect(uiValueEqual(["web"], "web")).toBe(false);
    expect(uiValueEqual(true, true)).toBe(true);
    expect(uiValueEqual(false, "")).toBe(false);
    expect(uiValueEqual(undefined, undefined)).toBe(true);
    expect(uiValueEqual(undefined, "")).toBe(false);
  });

  it("compares payloads structurally", () => {
    expect(payloadEqual(null, null)).toBe(true);
    expect(payloadEqual(2027, 2027)).toBe(true);
    expect(payloadEqual(2027, "2027")).toBe(false);
    expect(payloadEqual(["web", "ai_ml"], ["web", "ai_ml"])).toBe(true);
    expect(payloadEqual(["web", "ai_ml"], ["ai_ml", "web"])).toBe(false);
    expect(payloadEqual({ a: [1, { b: null }], c: "x" }, { c: "x", a: [1, { b: null }] })).toBe(true);
    expect(payloadEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(payloadEqual(null, [])).toBe(false);
    expect(payloadEqual([], {})).toBe(false);
  });
});

describe("validateDraftValue", () => {
  it("returns draft-schema messages for one field", () => {
    expect(validateDraftValue("hacker", "bio", "Builder")).toEqual([]);
    expect(validateDraftValue("hacker", "bio", null)).toEqual([]);
    expect(validateDraftValue("hacker", "bio", "x".repeat(601))).toEqual(["Use 600 characters or fewer."]);
    expect(validateDraftValue("hacker", "skills", HACKER_SKILLS.slice(0, 9))).toEqual(["Choose up to 8 options."]);
  });

  it("ignores keys the draft schema does not define, including prototype keys", () => {
    for (const key of ["notAField", "constructor", "__proto__", "toString"]) {
      expect(validateDraftValue("hacker", key, "anything"), key).toEqual([]);
    }
    expect(validateDraftValue("judge", "school", 42)).toEqual([]);
  });
});

describe("buildDraftPatch", () => {
  it("round-trips complete responses from an empty baseline back to the original payload", () => {
    for (const [type, responses, schema] of [
      ["hacker", validHackerResponses, hackerApplicationSchema],
      ["judge", validJudgeResponses, judgeApplicationSchema],
    ] as const) {
      const expected = withoutBlankAnswers(responses);
      const uiValues = toUiValues(type, responses);
      const baselines: UiValues[] = [{}, toUiValues(type, {})];

      for (const baseline of baselines) {
        const result = buildDraftPatch(type, baseline, uiValues);

        expect(result.patch).toEqual(expected);
        expect(JSON.parse(JSON.stringify(result.patch))).toEqual(expected);
        expect(result.dirtyKeys).toEqual(getApplicationFieldKeys(type).filter((key) => key in expected));
        expect(result.sent).toEqual(Object.fromEntries(result.dirtyKeys.map((key) => [key, uiValues[key]])));
        expect(result.invalid).toEqual({});
        expect(result.validated).toEqual({});
        expect(schema.safeParse(result.patch).success).toBe(true);
      }
    }

    // The hacker fixture has no blank answers, so its patch is exactly the original payload.
    expect(withoutBlankAnswers(validHackerResponses)).toEqual(validHackerResponses);
  });

  it("sends only valid dirty keys, reports invalid ones, and never mutates its inputs", () => {
    const baseline = deepFreeze(toUiValues("hacker", validHackerResponses));
    const values: UiValues = deepFreeze({
      ...baseline,
      bio: "",
      githubUrl: "https://github.com/test-hacker  ",
      school: "  New School  ",
      major: "Computer Science   ",
      graduationYear: "20.5",
      skills: ["ai_ml", "web", "web"],
      previousHackathonCount: "3",
    });
    const snapshot = structuredClone({ baseline, values });

    const result = buildDraftPatch("hacker", baseline, values);

    expect(result.dirtyKeys).toEqual(["bio", "school", "graduationYear", "previousHackathonCount"]);
    expect(result.patch).toEqual({ bio: null, school: "New School", previousHackathonCount: 3 });
    expect(result.sent).toEqual({ bio: "", school: "  New School  ", previousHackathonCount: "3" });
    expect(result.invalid).toEqual({ graduationYear: [GRADUATION_YEAR_MESSAGE] });
    expect(result.validated).toEqual({ graduationYear: "20.5" });
    expect({ baseline, values }).toEqual(snapshot);
  });

  it("copies array values into sent and validated", () => {
    const baseline = toUiValues("judge", validJudgeResponses);
    const values: UiValues = {
      ...baseline,
      availability: ["sunday_morning", "friday_evening"],
      expertiseAreas: ["web", "cooking"],
    };

    const result = buildDraftPatch("judge", baseline, values);

    expect(result.patch).toEqual({ availability: ["friday_evening", "sunday_morning"] });
    expect(result.sent.availability).toEqual(values.availability);
    expect(result.sent.availability).not.toBe(values.availability);
    expect(result.invalid).toEqual({ expertiseAreas: ["Choose from the listed options."] });
    expect(result.validated.expertiseAreas).toEqual(values.expertiseAreas);
    expect(result.validated.expertiseAreas).not.toBe(values.expertiseAreas);
  });

  it("treats keys missing from values as unchanged and reports nothing when clean", () => {
    const baseline = toUiValues("judge", validJudgeResponses);

    expect(buildDraftPatch("judge", baseline, { roleTitle: " Principal Engineer " })).toEqual({
      patch: { roleTitle: "Principal Engineer" },
      sent: { roleTitle: " Principal Engineer " },
      invalid: {},
      validated: {},
      dirtyKeys: ["roleTitle"],
    });
    expect(buildDraftPatch("judge", baseline, baseline)).toEqual({
      patch: {},
      sent: {},
      invalid: {},
      validated: {},
      dirtyKeys: [],
    });
  });
});

describe("isNewerApplication", () => {
  it("orders by updatedAt", () => {
    const older = makeApplication("2026-09-10T10:00:00.000Z");
    const newer = makeApplication("2026-09-10T10:00:01.000Z");
    expect(isNewerApplication(newer, older)).toBe(true);
    expect(isNewerApplication(older, newer)).toBe(false);
  });

  it("compares instants rather than strings when offsets differ", () => {
    const utc = makeApplication("2026-09-10T18:00:00.000Z");
    const pacific = makeApplication("2026-09-10T10:30:00.000-08:00");
    expect(isNewerApplication(pacific, utc)).toBe(true);
    expect(isNewerApplication(utc, pacific)).toBe(false);
  });

  it("is false in both directions for identical timestamps and status", () => {
    const a = makeApplication("2026-09-10T10:00:00.000Z", "submitted");
    const b = makeApplication("2026-09-10T10:00:00.000Z", "submitted");
    expect(isNewerApplication(a, b)).toBe(false);
    expect(isNewerApplication(b, a)).toBe(false);
  });

  it("breaks millisecond ties with the raw Postgres string", () => {
    const earlier = makeApplication("2026-09-10T22:04:05.123456+00:00");
    const later = makeApplication("2026-09-10T22:04:05.123999+00:00");
    // toBe uses Object.is, which also equates NaN with NaN, so prove the strings parse before comparing them.
    expect(Number.isNaN(Date.parse(earlier.updatedAt))).toBe(false);
    expect(Date.parse(earlier.updatedAt)).toBe(Date.parse(later.updatedAt));
    expect(isNewerApplication(later, earlier)).toBe(true);
    expect(isNewerApplication(earlier, later)).toBe(false);
    // A microsecond timestamp counts as parseable, so it outranks an invalid one whatever the status.
    expect(isNewerApplication(earlier, makeApplication("not a timestamp", "accepted"))).toBe(true);
  });

  it("breaks exact ties with the status rank", () => {
    const at = "2026-09-10T10:00:00.000Z";
    const ranked: ApplicationStatus[] = ["draft", "submitted", "in_review", "accepted"];
    for (let index = 1; index < ranked.length; index += 1) {
      const higher = makeApplication(at, ranked[index]);
      const lower = makeApplication(at, ranked[index - 1]);
      expect(isNewerApplication(higher, lower), ranked[index]).toBe(true);
      expect(isNewerApplication(lower, higher), ranked[index]).toBe(false);
    }
    expect(isNewerApplication(makeApplication(at, "accepted"), makeApplication(at, "waitlisted"))).toBe(false);
    expect(isNewerApplication(makeApplication(at, "waitlisted"), makeApplication(at, "accepted"))).toBe(false);
  });

  it("lets a later timestamp outrank a higher status", () => {
    expect(
      isNewerApplication(
        makeApplication("2026-09-10T10:00:01.000Z", "draft"),
        makeApplication("2026-09-10T10:00:00.000Z", "submitted"),
      ),
    ).toBe(true);
  });

  it("prefers a parseable updatedAt over an invalid one and stays antisymmetric for two invalid ones", () => {
    const valid = makeApplication("2026-09-10T10:00:00.000Z");
    const invalid = makeApplication("not a timestamp", "accepted");
    expect(isNewerApplication(valid, invalid)).toBe(true);
    expect(isNewerApplication(invalid, valid)).toBe(false);

    const first = makeApplication("garbage-a");
    const second = makeApplication("garbage-b");
    expect(isNewerApplication(second, first)).toBe(true);
    expect(isNewerApplication(first, second)).toBe(false);
  });
});

describe("countCharacters", () => {
  it("counts code points, matching the schema's maximum length", () => {
    const grinning = String.fromCodePoint(0x1f600);
    expect(grinning.length).toBe(2);
    expect(countCharacters("")).toBe(0);
    expect(countCharacters("abc")).toBe(3);
    expect(countCharacters(grinning)).toBe(1);
    expect(countCharacters(`a${grinning}b`)).toBe(3);

    expect(countCharacters(grinning.repeat(600))).toBe(600);
    expect(validateDraftValue("hacker", "bio", grinning.repeat(600))).toEqual([]);
    expect(validateDraftValue("hacker", "bio", grinning.repeat(601))).toEqual(["Use 600 characters or fewer."]);
  });
});
