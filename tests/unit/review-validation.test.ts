import { describe, expect, it } from "vitest";

import { toFieldErrors } from "@/lib/validation/errors";
import {
  REVIEW_SCHEMAS,
  RUBRIC_DIMENSIONS,
  calculateOverallScore,
  compactRubricScores,
} from "@/lib/validation/review";

describe("review draft schemas", () => {
  it("accept partial scores, null scores, and missing notes", () => {
    const result = REVIEW_SCHEMAS.hacker.draft.safeParse({ scores: { motivation: 4, growth: null } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.notes).toBeUndefined();
    expect(result.data.scores).toEqual({ motivation: 4, growth: null });
  });

  it("leave omitted fields absent so saved values are kept", () => {
    expect(REVIEW_SCHEMAS.judge.draft.parse({})).toEqual({});
    expect(REVIEW_SCHEMAS.judge.draft.parse({ recommendation: null })).toEqual({ recommendation: null });
  });

  it("reject scores outside 1-5, fractional scores, and unknown dimensions", () => {
    const draft = REVIEW_SCHEMAS.hacker.draft;
    expect(draft.safeParse({ scores: { motivation: 0 } }).success).toBe(false);
    expect(draft.safeParse({ scores: { motivation: 6 } }).success).toBe(false);
    expect(draft.safeParse({ scores: { motivation: 2.5 } }).success).toBe(false);
    expect(draft.safeParse({ scores: { expertise: 3 } }).success).toBe(false);
    expect(REVIEW_SCHEMAS.judge.draft.safeParse({ scores: { initiative: 3 } }).success).toBe(false);
  });

  it("reject notes over the limit and unknown recommendations", () => {
    expect(REVIEW_SCHEMAS.hacker.draft.safeParse({ notes: "x".repeat(5001) }).success).toBe(false);
    expect(REVIEW_SCHEMAS.hacker.draft.safeParse({ recommendation: "rejected" }).success).toBe(false);
  });
});

describe("review submission schemas", () => {
  it("require every rubric dimension and a recommendation", () => {
    const result = REVIEW_SCHEMAS.hacker.submission.safeParse({ scores: { motivation: 4 } });
    expect(result.success).toBe(false);
    if (result.success) return;

    const errors = toFieldErrors(result.error, 2);
    expect(Object.keys(errors).sort()).toEqual(
      ["recommendation", "scores.community", "scores.growth", "scores.initiative"].sort(),
    );
  });

  it("accept a complete judge review", () => {
    const result = REVIEW_SCHEMAS.judge.submission.safeParse({
      scores: { expertise: 5, evaluation: 4, motivation: 4, availability: 3 },
      notes: "Strong fit.",
      recommendation: "yes",
    });
    expect(result.success).toBe(true);
  });
});

describe("calculateOverallScore", () => {
  it("averages all dimensions to two decimals", () => {
    expect(calculateOverallScore("hacker", { motivation: 4, initiative: 5, growth: 4, community: 3 })).toBe(4);
    expect(calculateOverallScore("hacker", { motivation: 5, initiative: 5, growth: 4, community: 5 })).toBe(4.75);
    expect(calculateOverallScore("judge", { expertise: 3, evaluation: 3, motivation: 4, availability: 2 })).toBe(3);
  });

  it("returns null until every dimension has a valid score", () => {
    expect(calculateOverallScore("hacker", { motivation: 4 })).toBeNull();
    expect(calculateOverallScore("hacker", { motivation: 4, initiative: 5, growth: 4, community: 7 })).toBeNull();
    expect(calculateOverallScore("judge", null)).toBeNull();
  });
});

describe("compactRubricScores", () => {
  it("drops null and undefined scores", () => {
    expect(compactRubricScores({ motivation: 4, growth: null, community: undefined })).toEqual({ motivation: 4 });
  });
});

describe("rubric dimensions", () => {
  it("match the plan for each application type", () => {
    expect(RUBRIC_DIMENSIONS.hacker).toEqual(["motivation", "initiative", "growth", "community"]);
    expect(RUBRIC_DIMENSIONS.judge).toEqual(["expertise", "evaluation", "motivation", "availability"]);
  });
});
