import { describe, expect, it } from "vitest";

import {
  REVIEW_STEP,
  applicationStepHref,
  fieldControlId,
  fieldCounterId,
  fieldErrorId,
  fieldHintId,
  getEditorSteps,
  getNextStep,
  isModifiedClick,
  parseEditorStep,
  resolveInitialStep,
  sectionForField,
  sectionHeadingId,
} from "@/lib/editor/steps";
import { APPLICATION_SECTIONS } from "@/lib/validation/application";
import { calculateApplicationCompletion } from "@/lib/validation/completion";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";

const HACKER_STEPS = ["about", "education", "experience", "short_answers", "agreements", "review"];
const JUDGE_STEPS = ["about", "professional", "judging", "short_answers", "agreements", "review"];

describe("getEditorSteps", () => {
  it("lists the sections in form order, then review", () => {
    expect(REVIEW_STEP).toBe("review");
    expect(getEditorSteps("hacker")).toEqual(HACKER_STEPS);
    expect(getEditorSteps("judge")).toEqual(JUDGE_STEPS);
    expect(getEditorSteps("judge")).toEqual([...APPLICATION_SECTIONS.judge.map((section) => section.id), REVIEW_STEP]);
  });

  it("returns a new array every time", () => {
    const steps = getEditorSteps("hacker");
    steps.pop();
    expect(getEditorSteps("hacker")).toEqual(HACKER_STEPS);
  });
});

describe("parseEditorStep", () => {
  it("accepts exactly the steps of the application type", () => {
    for (const step of HACKER_STEPS) {
      expect(parseEditorStep("hacker", step)).toBe(step);
    }
    for (const step of JUDGE_STEPS) {
      expect(parseEditorStep("judge", step)).toBe(step);
    }
  });

  it("rejects the other type's sections", () => {
    expect(parseEditorStep("judge", "education")).toBeNull();
    expect(parseEditorStep("judge", "experience")).toBeNull();
    expect(parseEditorStep("hacker", "professional")).toBeNull();
    expect(parseEditorStep("hacker", "judging")).toBeNull();
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"])(
    "rejects the prototype key %s",
    (raw) => {
      expect(parseEditorStep("hacker", raw)).toBeNull();
      expect(parseEditorStep("judge", raw)).toBeNull();
    },
  );

  it("rejects anything that is not an exact step string", () => {
    for (const raw of [undefined, null, 42, true, {}, ["about"], "", " about", "About", "about#x", "about,education"]) {
      expect(parseEditorStep("hacker", raw)).toBeNull();
    }
  });
});

describe("getNextStep", () => {
  it("moves through the sections and ends after review", () => {
    expect(getNextStep("hacker", "about")).toBe("education");
    expect(getNextStep("hacker", "short_answers")).toBe("agreements");
    expect(getNextStep("hacker", "agreements")).toBe("review");
    expect(getNextStep("hacker", "review")).toBeNull();
    expect(getNextStep("judge", "about")).toBe("professional");
  });

  it("returns null for a step the type does not have", () => {
    expect(getNextStep("judge", "education")).toBeNull();
  });
});

describe("step hrefs and ids", () => {
  it("builds step hrefs with an optional field fragment", () => {
    expect(applicationStepHref("education")).toBe("/portal/application?section=education");
    expect(applicationStepHref("review")).toBe("/portal/application?section=review");
    expect(applicationStepHref("about", "preferredName")).toBe("/portal/application?section=about#field-preferredName");
  });

  it("builds the frozen DOM ids", () => {
    expect(sectionHeadingId("review")).toBe("section-heading-review");
    expect(sectionHeadingId("short_answers")).toBe("section-heading-short_answers");
    expect(fieldControlId("bio")).toBe("field-bio");
    expect(fieldHintId("bio")).toBe("field-bio-hint");
    expect(fieldErrorId("bio")).toBe("field-bio-error");
    expect(fieldCounterId("bio")).toBe("field-bio-counter");
  });
});

describe("sectionForField", () => {
  it("finds the section for the type's fields only", () => {
    expect(sectionForField("hacker", "graduationYear")).toBe("education");
    expect(sectionForField("hacker", "codeOfConductAccepted")).toBe("agreements");
    expect(sectionForField("judge", "conflictsOfInterest")).toBe("judging");
    expect(sectionForField("judge", "graduationYear")).toBeNull();
    expect(sectionForField("hacker", "constructor")).toBeNull();
    expect(sectionForField("hacker", "")).toBeNull();
  });
});

describe("resolveInitialStep", () => {
  const partialHacker = calculateApplicationCompletion("hacker", {
    fullName: "Maya",
    birthdate: "2006-03-14",
    countryOfResidence: "US",
    cityOfResidence: "Oakland",
  });

  it("uses a valid requested section", () => {
    expect(resolveInitialStep("hacker", "experience", partialHacker)).toBe("experience");
    expect(resolveInitialStep("hacker", "review", partialHacker)).toBe("review");
  });

  it("falls back to the next incomplete section", () => {
    expect(partialHacker.nextIncompleteSectionId).toBe("education");
    for (const raw of [undefined, "", "professional", "__proto__", ["about"]]) {
      expect(resolveInitialStep("hacker", raw, partialHacker)).toBe("education");
    }
    expect(resolveInitialStep("judge", "education", calculateApplicationCompletion("judge", {}))).toBe("about");
  });

  it("falls back to review when every section is complete", () => {
    const completeHacker = calculateApplicationCompletion("hacker", validHackerResponses);
    const completeJudge = calculateApplicationCompletion("judge", validJudgeResponses);
    expect(resolveInitialStep("hacker", undefined, completeHacker)).toBe("review");
    expect(resolveInitialStep("judge", "nope", completeJudge)).toBe("review");
  });

  it("never opens a section from another application type", () => {
    expect(resolveInitialStep("judge", undefined, partialHacker)).toBe("review");
  });
});

describe("isModifiedClick", () => {
  const plain = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0 };

  it("is false for a plain primary click", () => {
    expect(isModifiedClick(plain)).toBe(false);
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)("is true while %s is held", (modifier) => {
    expect(isModifiedClick({ ...plain, [modifier]: true })).toBe(true);
  });

  it("is true for the middle and secondary buttons", () => {
    expect(isModifiedClick({ ...plain, button: 1 })).toBe(true);
    expect(isModifiedClick({ ...plain, button: 2 })).toBe(true);
  });
});
