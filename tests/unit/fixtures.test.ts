import { describe, expect, it } from "vitest";

import { APPLICATION_SCHEMAS, isHttpLink } from "@/lib/validation/application";
import { calculateApplicationCompletion } from "@/lib/validation/completion";
import { toFieldErrors } from "@/lib/validation/errors";
import { REVIEW_SCHEMAS } from "@/lib/validation/review";

import {
  draftInvalidHackerResponses,
  draftInvalidJudgeResponses,
  partialHackerResponses,
  partialJudgeResponses,
  validHackerResponses,
  validJudgeResponses,
} from "../fixtures/applications";
import { completeHackerRubric, completeJudgeRubric } from "../fixtures/reviews";

// Unit, integration, and E2E tests rely on these fixtures meaning what their names say.
const APPLICATION_FIXTURES = {
  hacker: {
    valid: validHackerResponses,
    partial: partialHackerResponses,
    draftInvalid: draftInvalidHackerResponses,
    omittedRequiredText: "proudProject",
  },
  judge: {
    valid: validJudgeResponses,
    partial: partialJudgeResponses,
    draftInvalid: draftInvalidJudgeResponses,
    omittedRequiredText: "motivation",
  },
} as const;

describe.each(["hacker", "judge"] as const)("%s application fixtures", (type) => {
  const { draft, submission } = APPLICATION_SCHEMAS[type];
  const fixtures = APPLICATION_FIXTURES[type];

  it("valid responses pass both schemas and are submittable", () => {
    expect(draft.safeParse(fixtures.valid).success).toBe(true);
    expect(submission.safeParse(fixtures.valid).success).toBe(true);
    expect(calculateApplicationCompletion(type, fixtures.valid)).toMatchObject({ isSubmittable: true, percent: 100 });
  });

  it("partial responses are a valid draft with some sections complete and others not", () => {
    expect(draft.safeParse(fixtures.partial).success).toBe(true);
    expect(submission.safeParse(fixtures.partial).success).toBe(false);

    const completion = calculateApplicationCompletion(type, fixtures.partial);
    const statuses = completion.sections.map((section) => section.status);
    expect(completion.isSubmittable).toBe(false);
    expect(statuses).toContain("complete");
    expect(statuses).toContain("in_progress");
    expect(statuses).toContain("not_started");
    // Every saved answer is valid, so the only gaps are unanswered fields.
    expect(completion.sections.flatMap((section) => section.invalidFields)).toEqual([]);
  });

  it("draft-invalid responses save as a draft but fail submission", () => {
    expect(draft.safeParse(fixtures.draftInvalid).success).toBe(true);
    expect(fixtures.draftInvalid).not.toHaveProperty(fixtures.omittedRequiredText);
    expect(fixtures.draftInvalid).not.toHaveProperty("codeOfConductAccepted");
    expect(fixtures.draftInvalid.links.some((link) => !isHttpLink(link))).toBe(true);

    const result = submission.safeParse(fixtures.draftInvalid);
    if (result.success) {
      throw new Error("Expected the draft-invalid fixture to fail the submission schema.");
    }
    expect(Object.keys(toFieldErrors(result.error))).toEqual(
      expect.arrayContaining([fixtures.omittedRequiredText, "links", "codeOfConductAccepted"]),
    );

    const completion = calculateApplicationCompletion(type, fixtures.draftInvalid);
    expect(completion.isSubmittable).toBe(false);
    expect(completion.missingRequiredFields).toEqual(
      expect.arrayContaining([fixtures.omittedRequiredText, "codeOfConductAccepted"]),
    );
    expect(completion.sections.find((section) => section.id === "about")?.invalidFields).toEqual(["links"]);
  });
});

describe("review rubric fixtures", () => {
  it.each([
    ["hacker", completeHackerRubric],
    ["judge", completeJudgeRubric],
  ] as const)("the complete %s rubric passes the draft and submission schemas", (type, rubric) => {
    expect(REVIEW_SCHEMAS[type].draft.safeParse(rubric).success).toBe(true);
    expect(REVIEW_SCHEMAS[type].submission.safeParse(rubric).success).toBe(true);
  });
});
