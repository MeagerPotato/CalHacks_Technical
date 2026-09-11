import { describe, expect, it } from "vitest";

import {
  APPLICATION_FORMS,
  JUDGE_EXPERTISE_OPTIONS,
  PUBLIC_ACCOUNT_ROLE_OPTIONS,
  RUBRIC_FORMS,
} from "@/lib/application-config";
import { IDENTITY_RESPONSE_KEYS } from "@/lib/domain/applicant-identity";
import { APPLICATION_TYPES } from "@/lib/domain/enums";
import {
  APPLICATION_SCHEMAS,
  JUDGE_EXPERTISE_AREAS,
  getApplicationFieldKeys,
  getRequiredApplicationFieldKeys,
} from "@/lib/validation/application";
import { RUBRIC_DIMENSIONS } from "@/lib/validation/review";

describe("APPLICATION_FORMS", () => {
  it.each(APPLICATION_TYPES)("covers every %s schema field exactly once with matching required flags", (type) => {
    const fields = APPLICATION_FORMS[type].sections.flatMap((section) => section.fields);
    const keys = fields.map((field) => field.key);

    expect(keys).toEqual(getApplicationFieldKeys(type));
    expect([...keys].sort()).toEqual(Object.keys(APPLICATION_SCHEMAS[type].submission.shape).sort());
    expect(fields.filter((field) => field.required).map((field) => field.key)).toEqual(
      getRequiredApplicationFieldKeys(type),
    );
    expect(fields.every((field) => field.label.length > 0)).toBe(true);
  });

  it.each(APPLICATION_TYPES)("flags the %s identity fields for blind review", (type) => {
    const identifying = APPLICATION_FORMS[type].sections
      .flatMap((section) => section.fields)
      .filter((field) => field.identifying)
      .map((field) => field.key);
    expect([...identifying].sort()).toEqual([...IDENTITY_RESPONSE_KEYS[type]].sort());
  });

  it("uses validation option values for choice fields", () => {
    expect(JUDGE_EXPERTISE_OPTIONS.map((option) => option.value)).toEqual([...JUDGE_EXPERTISE_AREAS]);
  });

  it("offers only hacker and judge at public signup", () => {
    expect(PUBLIC_ACCOUNT_ROLE_OPTIONS.map((option) => option.value)).toEqual(["hacker", "judge"]);
  });
});

describe("RUBRIC_FORMS", () => {
  it.each(APPLICATION_TYPES)("lists every %s rubric dimension with a 1-5 range", (type) => {
    expect(RUBRIC_FORMS[type].map((dimension) => dimension.key)).toEqual([...RUBRIC_DIMENSIONS[type]]);
    expect(RUBRIC_FORMS[type].every((dimension) => dimension.minScore === 1 && dimension.maxScore === 5)).toBe(true);
  });
});
