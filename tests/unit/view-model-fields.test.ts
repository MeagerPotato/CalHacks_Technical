import { afterEach, describe, expect, it, vi } from "vitest";

import { COPY, FIELD_COPY, SECTION_COPY } from "@/content/copy";
import { APPLICATION_FORMS, type ApplicationFieldConfig } from "@/lib/application-config";
import type { ApplicationType } from "@/lib/domain/enums";
import { APPLICATION_LIMITS } from "@/lib/validation/application";
import { getFieldConfig, getSectionLabel, resolveFieldCopy, resolveSectionCopy } from "@/lib/view-models/fields";

const TYPES: ApplicationType[] = ["hacker", "judge"];
const { hints } = COPY.editor;

function formFields(type: ApplicationType): ApplicationFieldConfig[] {
  return APPLICATION_FORMS[type].sections.flatMap((section) => section.fields);
}

function hintsFor(type: ApplicationType): Record<string, string | null> {
  return Object.fromEntries(formFields(type).map((field) => [field.key, resolveFieldCopy(type, field).hint]));
}

describe("resolveFieldCopy hints", () => {
  it("covers every field kind across the two forms", () => {
    expect(new Set(formFields("hacker").map((field) => field.kind))).toEqual(
      new Set(["short_text", "long_text", "link_list", "whole_number", "single_choice", "multi_choice", "agreement"]),
    );
  });

  it("generates hacker hints from the config limits", () => {
    expect(hintsFor("hacker")).toEqual({
      preferredName: hints.maxCharacters(APPLICATION_LIMITS.preferredName),
      location: hints.maxCharacters(APPLICATION_LIMITS.shortText),
      bio: hints.maxCharacters(APPLICATION_LIMITS.bio),
      links: hints.links(APPLICATION_LIMITS.links),
      school: hints.maxCharacters(APPLICATION_LIMITS.shortText),
      major: hints.maxCharacters(APPLICATION_LIMITS.shortText),
      graduationYear: hints.wholeNumber(APPLICATION_LIMITS.graduationYear.min, APPLICATION_LIMITS.graduationYear.max),
      experienceLevel: null,
      skills: hints.chooseUpTo(APPLICATION_LIMITS.skills),
      previousHackathonCount: hints.wholeNumber(
        APPLICATION_LIMITS.previousHackathonCount.min,
        APPLICATION_LIMITS.previousHackathonCount.max,
      ),
      buildGoals: hints.maxCharacters(APPLICATION_LIMITS.longAnswer),
      proudProject: hints.maxCharacters(APPLICATION_LIMITS.longAnswer),
      codeOfConductAccepted: null,
    });
  });

  it("generates judge hints from the config limits", () => {
    expect(hintsFor("judge")).toEqual({
      preferredName: hints.maxCharacters(APPLICATION_LIMITS.preferredName),
      location: hints.maxCharacters(APPLICATION_LIMITS.shortText),
      bio: hints.maxCharacters(APPLICATION_LIMITS.bio),
      links: hints.links(APPLICATION_LIMITS.links),
      company: hints.maxCharacters(APPLICATION_LIMITS.shortText),
      roleTitle: hints.maxCharacters(APPLICATION_LIMITS.shortText),
      yearsExperience: hints.wholeNumber(
        APPLICATION_LIMITS.yearsExperience.min,
        APPLICATION_LIMITS.yearsExperience.max,
      ),
      expertiseAreas: hints.chooseUpTo(APPLICATION_LIMITS.expertiseAreas),
      judgingExperience: hints.maxCharacters(APPLICATION_LIMITS.mediumAnswer),
      availability: hints.chooseUpTo(APPLICATION_LIMITS.availability),
      preferredCategories: hints.chooseUpTo(APPLICATION_LIMITS.preferredCategories),
      conflictsOfInterest: hints.maxCharacters(APPLICATION_LIMITS.mediumAnswer),
      evaluationApproach: hints.maxCharacters(APPLICATION_LIMITS.longAnswer),
      motivation: hints.maxCharacters(APPLICATION_LIMITS.longAnswer),
      codeOfConductAccepted: null,
    });
  });

  it("returns no hint when the config has no limit to describe", () => {
    const base = { key: "custom", label: "Custom", required: false, identifying: false } as const;
    const unlimited: ApplicationFieldConfig[] = [
      { ...base, kind: "short_text" },
      { ...base, kind: "long_text" },
      { ...base, kind: "whole_number", min: 0 },
      { ...base, kind: "multi_choice", options: [] },
      // A per-link maxLength must not turn a link list into a character-count hint.
      { ...base, kind: "link_list", maxLength: 300 },
      { ...base, kind: "single_choice", options: [] },
      { ...base, kind: "agreement" },
    ];
    for (const field of unlimited) {
      expect(resolveFieldCopy("hacker", field).hint, field.kind).toBeNull();
    }
  });

  it("puts the real limits into the hint text", () => {
    const graduationYear = getFieldConfig("hacker", "graduationYear");
    const hint = graduationYear ? resolveFieldCopy("hacker", graduationYear).hint : null;
    expect(hint).toContain("2000");
    expect(hint).toContain("2040");
  });
});

describe("resolveFieldCopy labels", () => {
  it("uses config labels and no help when FIELD_COPY has no override", () => {
    for (const type of TYPES) {
      for (const field of formFields(type)) {
        if (FIELD_COPY[field.key] !== undefined) {
          continue;
        }
        const copy = resolveFieldCopy(type, field);
        expect(copy.label, field.key).toBe(field.label);
        expect(copy.help, field.key).toBeNull();
      }
    }
  });

  it("marks only optional fields", () => {
    for (const type of TYPES) {
      for (const field of formFields(type)) {
        expect(resolveFieldCopy(type, field).optionalText, field.key).toBe(
          field.required ? null : COPY.common.optional,
        );
      }
    }
    const company = getFieldConfig("judge", "company");
    const roleTitle = getFieldConfig("judge", "roleTitle");
    expect(company && resolveFieldCopy("judge", company).optionalText).toBe(COPY.common.optional);
    expect(roleTitle && resolveFieldCopy("judge", roleTitle).optionalText).toBeNull();
  });
});

describe("copy overrides", () => {
  afterEach(() => {
    vi.doUnmock("@/content/copy");
    vi.resetModules();
  });

  it("applies FIELD_COPY and SECTION_COPY overrides and ignores blank ones", async () => {
    vi.resetModules();
    vi.doMock("@/content/copy", async (importOriginal) => ({
      ...(await importOriginal<Record<string, unknown>>()),
      FIELD_COPY: {
        preferredName: { label: "Name to use", help: "Help prose for the name field." },
        bio: { label: "   ", help: "" },
      },
      SECTION_COPY: { about: { intro: "Intro for the about section." }, education: { intro: " " } },
    }));

    const fields = await import("@/lib/view-models/fields");
    const preferredName = fields.getFieldConfig("hacker", "preferredName");
    const bio = fields.getFieldConfig("hacker", "bio");
    const [about, education] = APPLICATION_FORMS.hacker.sections;

    expect(preferredName && fields.resolveFieldCopy("hacker", preferredName)).toMatchObject({
      label: "Name to use",
      help: "Help prose for the name field.",
      hint: hints.maxCharacters(APPLICATION_LIMITS.preferredName),
    });
    expect(bio && fields.resolveFieldCopy("hacker", bio)).toMatchObject({ label: "Short biography", help: null });
    expect(fields.resolveSectionCopy("hacker", about)).toEqual({
      label: about.label,
      intro: "Intro for the about section.",
    });
    expect(fields.resolveSectionCopy("hacker", education)).toEqual({ label: education.label, intro: null });
  });
});

describe("resolveSectionCopy", () => {
  it("uses the config label and a null intro when SECTION_COPY has none", () => {
    for (const type of TYPES) {
      for (const section of APPLICATION_FORMS[type].sections) {
        const copy = resolveSectionCopy(type, section);
        expect(copy.label).toBe(section.label);
        if (SECTION_COPY[section.id] === undefined) {
          expect(copy.intro, section.id).toBeNull();
        }
      }
    }
  });
});

describe("getFieldConfig", () => {
  it("finds fields of the given type only", () => {
    expect(getFieldConfig("hacker", "school")).toBe(formFields("hacker").find((field) => field.key === "school"));
    expect(getFieldConfig("judge", "school")).toBeNull();
    expect(getFieldConfig("judge", "roleTitle")?.label).toBe("Role / title");
  });

  it.each(["constructor", "__proto__", "toString", ""])("returns null for %j", (key) => {
    expect(getFieldConfig("hacker", key)).toBeNull();
  });
});

describe("getSectionLabel", () => {
  it("labels the review step with COPY.editor.reviewStep", () => {
    expect(getSectionLabel("hacker", "review")).toBe(COPY.editor.reviewStep);
    expect(getSectionLabel("judge", "review")).toBe(COPY.editor.reviewStep);
  });

  it("uses config labels for sections", () => {
    for (const type of TYPES) {
      for (const section of APPLICATION_FORMS[type].sections) {
        expect(getSectionLabel(type, section.id)).toBe(section.label);
      }
    }
    expect(getSectionLabel("judge", "professional")).toBe("Professional background");
  });

  it("returns an id the form does not have unchanged", () => {
    expect(getSectionLabel("judge", "education")).toBe("education");
  });
});
