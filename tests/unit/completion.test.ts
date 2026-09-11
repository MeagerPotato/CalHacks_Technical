import { describe, expect, it } from "vitest";

import { calculateApplicationCompletion } from "@/lib/validation/completion";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";

describe("calculateApplicationCompletion", () => {
  it("reports an empty application as not started", () => {
    const completion = calculateApplicationCompletion("hacker", {});

    expect(completion.percent).toBe(0);
    expect(completion.isSubmittable).toBe(false);
    expect(completion.requiredFieldCount).toBe(12);
    expect(completion.completedRequiredFieldCount).toBe(0);
    expect(completion.sections.every((section) => section.status === "not_started")).toBe(true);
    expect(completion.nextIncompleteSectionId).toBe("about");
    expect(completion.missingRequiredFields).toHaveLength(12);
  });

  it("reaches 100 only for a submittable application", () => {
    for (const [type, responses] of [
      ["hacker", validHackerResponses],
      ["judge", validJudgeResponses],
    ] as const) {
      const completion = calculateApplicationCompletion(type, responses);
      expect(completion.percent).toBe(100);
      expect(completion.isSubmittable).toBe(true);
      expect(completion.sections.every((section) => section.status === "complete")).toBe(true);
      expect(completion.nextIncompleteSectionId).toBeNull();
      expect(completion.fieldErrors).toEqual({});
    }
  });

  it("computes the percentage from valid required answers", () => {
    const completion = calculateApplicationCompletion("hacker", {
      preferredName: "Maya",
      location: "Oakland, CA",
      bio: "Builder",
    });

    expect(completion.completedRequiredFieldCount).toBe(3);
    expect(completion.percent).toBe(25);
    expect(completion.sections[0]).toMatchObject({ id: "about", status: "complete" });
    expect(completion.nextIncompleteSectionId).toBe("education");
  });

  it("marks a partially answered section as in progress", () => {
    const completion = calculateApplicationCompletion("hacker", { school: "Example University" });
    expect(completion.sections.find((section) => section.id === "education")).toMatchObject({
      status: "in_progress",
      requiredFieldCount: 3,
      completedRequiredFieldCount: 1,
      missingRequiredFields: ["major", "graduationYear"],
    });
  });

  it("treats an invalid required answer as missing and invalid", () => {
    const completion = calculateApplicationCompletion("hacker", { ...validHackerResponses, graduationYear: 1900 });
    const education = completion.sections.find((section) => section.id === "education");

    expect(completion.isSubmittable).toBe(false);
    expect(completion.percent).toBe(92);
    expect(education?.missingRequiredFields).toEqual(["graduationYear"]);
    expect(education?.invalidFields).toEqual(["graduationYear"]);
    expect(completion.fieldErrors.graduationYear).toBeDefined();
  });

  it("never reports 100 when an optional answer is invalid", () => {
    const completion = calculateApplicationCompletion("hacker", { ...validHackerResponses, links: ["not-a-url"] });

    expect(completion.completedRequiredFieldCount).toBe(12);
    expect(completion.percent).toBe(99);
    expect(completion.isSubmittable).toBe(false);
    expect(completion.sections.find((section) => section.id === "about")).toMatchObject({
      status: "in_progress",
      invalidFields: ["links"],
    });
  });

  it("does not count an unchecked agreement as answered", () => {
    const completion = calculateApplicationCompletion("judge", { ...validJudgeResponses, codeOfConductAccepted: false });
    expect(completion.sections.find((section) => section.id === "agreements")?.status).toBe("not_started");
    expect(completion.percent).toBe(92);
  });

  it("handles non-object stored responses", () => {
    expect(calculateApplicationCompletion("judge", null).percent).toBe(0);
    expect(calculateApplicationCompletion("judge", "garbage").percent).toBe(0);
  });
});
