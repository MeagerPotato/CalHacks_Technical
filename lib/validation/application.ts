import { z } from "zod";

import type { ApplicationType } from "@/lib/domain/enums";

// =============================================================================
// Hacker and Judge application contracts.
//
// - Submission schemas define a complete, valid application. They are enforced by
//   submitApplication and mirrored by the database function
//   private.application_responses_valid (tests/integration/schema-drift.test.ts).
// - Draft schemas accept partial answers but still enforce types, option values,
//   and size limits. The same database function checks drafts, so malformed data
//   cannot be stored even through direct Data API writes.
// - APPLICATION_SECTIONS groups fields for completion and Launch Readiness.
// Field labels and option labels live in lib/application-config.ts.
// =============================================================================

// ---------------------------------------------------------------------------
// Option values stored in responses JSON
// ---------------------------------------------------------------------------

export const EXPERIENCE_LEVELS = ["first_project", "beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const HACKER_SKILLS = [
  "web",
  "mobile",
  "ai_ml",
  "data",
  "hardware",
  "design",
  "game_dev",
  "security",
  "cloud",
  "robotics",
  "ar_vr",
  "blockchain",
] as const;
export type HackerSkill = (typeof HACKER_SKILLS)[number];

export const JUDGE_EXPERTISE_AREAS = [
  "ai_ml",
  "web",
  "mobile",
  "hardware",
  "data",
  "security",
  "design_ux",
  "developer_tools",
  "health",
  "climate",
  "fintech",
  "education",
] as const;
export type JudgeExpertiseArea = (typeof JUDGE_EXPERTISE_AREAS)[number];

export const JUDGE_AVAILABILITY_BLOCKS = [
  "friday_evening",
  "saturday_morning",
  "saturday_afternoon",
  "saturday_evening",
  "sunday_morning",
  "sunday_afternoon",
] as const;
export type JudgeAvailabilityBlock = (typeof JUDGE_AVAILABILITY_BLOCKS)[number];

export const PROJECT_CATEGORIES = [
  "ai_ml",
  "hardware",
  "health",
  "sustainability",
  "education",
  "fintech",
  "social_impact",
  "developer_tools",
  "entertainment",
  "beginner_friendly",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const APPLICATION_LIMITS = {
  preferredName: 80,
  shortText: 120,
  bio: 600,
  mediumAnswer: 1000,
  longAnswer: 1500,
  url: 300,
  links: 5,
  skills: 8,
  expertiseAreas: 6,
  availability: JUDGE_AVAILABILITY_BLOCKS.length,
  preferredCategories: 5,
  graduationYear: { min: 2000, max: 2040 },
  previousHackathonCount: { min: 0, max: 100 },
  yearsExperience: { min: 0, max: 60 },
} as const;

/**
 * Submitted links must be http(s) URLs with a domain name and an optional port. The database
 * uses the identical pattern (private.http_link_pattern), so both accept exactly the same links.
 */
export const HTTP_LINK_PATTERN_SOURCE = String.raw`^https?://(?=[A-Za-z0-9.-]{1,253}(?:[:/?#]|$))(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?::(?:[1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?(?:[/?#][^\x01-\x20\x7f]*)?$`;
export const HTTP_LINK_PATTERN = new RegExp(HTTP_LINK_PATTERN_SOURCE);

// ---------------------------------------------------------------------------
// Field builders
// ---------------------------------------------------------------------------

const REQUIRED_MESSAGE = "This field is required.";

const tooLong = (max: number) => `Use ${max} characters or fewer.`;
const outOfRange = (min: number, max: number) => `Enter a whole number from ${min} to ${max}.`;

/** Uses the required message when the value is missing, otherwise the given message. */
const requiredOr = (message: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? REQUIRED_MESSAGE : message;

const hasNoDuplicates = (values: readonly string[]) => new Set(values).size === values.length;
const DUPLICATE_MESSAGE = "Each option can only be chosen once.";

const requiredText = (max: number) =>
  z
    .string({ error: requiredOr("Enter text.") })
    .trim()
    .min(1, { error: REQUIRED_MESSAGE })
    .max(max, { error: tooLong(max) });

const optionalText = (max: number) =>
  z.string({ error: "Enter text." }).trim().max(max, { error: tooLong(max) }).optional();

const wholeNumber = (min: number, max: number) =>
  z
    .int({ error: requiredOr(outOfRange(min, max)) })
    .min(min, { error: outOfRange(min, max) })
    .max(max, { error: outOfRange(min, max) });

const singleChoice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, { error: requiredOr("Choose one of the listed options.") });

const multiChoice = <const T extends readonly [string, ...string[]]>(values: T, maxItems: number) =>
  z
    .array(z.enum(values, { error: "Choose from the listed options." }), {
      error: requiredOr("Choose at least one option."),
    })
    .min(1, { error: "Choose at least one option." })
    .max(maxItems, { error: `Choose up to ${maxItems} options.` })
    .refine(hasNoDuplicates, { error: DUPLICATE_MESSAGE });

const LINK_MESSAGE = "Enter a full link starting with http:// or https://.";

const httpLink = z
  .string({ error: LINK_MESSAGE })
  .max(APPLICATION_LIMITS.url, { error: tooLong(APPLICATION_LIMITS.url) })
  .regex(HTTP_LINK_PATTERN, { error: LINK_MESSAGE });

/** True for a link that passes submission validation (draft links can be any text). */
export function isHttpLink(value: unknown): value is string {
  return httpLink.safeParse(value).success;
}

const linkList = z
  .array(httpLink, { error: "Links must be a list." })
  .max(APPLICATION_LIMITS.links, { error: `Add up to ${APPLICATION_LIMITS.links} links.` })
  .optional();

const codeOfConductAgreement = z.literal(true, {
  error: "Accept the code of conduct to submit.",
});

// Draft builders: every field optional; null clears a saved answer.

const draftText = (max: number) =>
  z.string({ error: "Enter text." }).trim().max(max, { error: tooLong(max) }).nullish();

const draftWholeNumber = (min: number, max: number) =>
  z
    .int({ error: outOfRange(min, max) })
    .min(min, { error: outOfRange(min, max) })
    .max(max, { error: outOfRange(min, max) })
    .nullish();

const draftSingleChoice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, { error: "Choose one of the listed options." }).nullish();

const draftMultiChoice = <const T extends readonly [string, ...string[]]>(values: T, maxItems: number) =>
  z
    .array(z.enum(values, { error: "Choose from the listed options." }), { error: "Choose from the listed options." })
    .max(maxItems, { error: `Choose up to ${maxItems} options.` })
    .refine(hasNoDuplicates, { error: DUPLICATE_MESSAGE })
    .nullish();

const draftLinkList = z
  .array(
    z.string({ error: "Enter a link." }).trim().max(APPLICATION_LIMITS.url, { error: tooLong(APPLICATION_LIMITS.url) }),
    { error: "Links must be a list." },
  )
  .max(APPLICATION_LIMITS.links, { error: `Add up to ${APPLICATION_LIMITS.links} links.` })
  .nullish();

const draftAgreement = z.boolean({ error: "Choose yes or no." }).nullish();

// ---------------------------------------------------------------------------
// Submission schemas
// ---------------------------------------------------------------------------

export const hackerApplicationSchema = z.object({
  preferredName: requiredText(APPLICATION_LIMITS.preferredName),
  location: requiredText(APPLICATION_LIMITS.shortText),
  bio: requiredText(APPLICATION_LIMITS.bio),
  links: linkList,
  school: requiredText(APPLICATION_LIMITS.shortText),
  major: requiredText(APPLICATION_LIMITS.shortText),
  graduationYear: wholeNumber(APPLICATION_LIMITS.graduationYear.min, APPLICATION_LIMITS.graduationYear.max),
  experienceLevel: singleChoice(EXPERIENCE_LEVELS),
  skills: multiChoice(HACKER_SKILLS, APPLICATION_LIMITS.skills),
  previousHackathonCount: wholeNumber(
    APPLICATION_LIMITS.previousHackathonCount.min,
    APPLICATION_LIMITS.previousHackathonCount.max,
  ),
  buildGoals: requiredText(APPLICATION_LIMITS.longAnswer),
  proudProject: requiredText(APPLICATION_LIMITS.longAnswer),
  codeOfConductAccepted: codeOfConductAgreement,
});

export const judgeApplicationSchema = z.object({
  preferredName: requiredText(APPLICATION_LIMITS.preferredName),
  location: requiredText(APPLICATION_LIMITS.shortText),
  bio: requiredText(APPLICATION_LIMITS.bio),
  links: linkList,
  company: optionalText(APPLICATION_LIMITS.shortText),
  roleTitle: requiredText(APPLICATION_LIMITS.shortText),
  yearsExperience: wholeNumber(APPLICATION_LIMITS.yearsExperience.min, APPLICATION_LIMITS.yearsExperience.max),
  expertiseAreas: multiChoice(JUDGE_EXPERTISE_AREAS, APPLICATION_LIMITS.expertiseAreas),
  judgingExperience: requiredText(APPLICATION_LIMITS.mediumAnswer),
  availability: multiChoice(JUDGE_AVAILABILITY_BLOCKS, APPLICATION_LIMITS.availability),
  preferredCategories: multiChoice(PROJECT_CATEGORIES, APPLICATION_LIMITS.preferredCategories),
  conflictsOfInterest: optionalText(APPLICATION_LIMITS.mediumAnswer),
  evaluationApproach: requiredText(APPLICATION_LIMITS.longAnswer),
  motivation: requiredText(APPLICATION_LIMITS.longAnswer),
  codeOfConductAccepted: codeOfConductAgreement,
});

// ---------------------------------------------------------------------------
// Draft schemas
// ---------------------------------------------------------------------------

export const hackerApplicationDraftSchema = z.object({
  preferredName: draftText(APPLICATION_LIMITS.preferredName),
  location: draftText(APPLICATION_LIMITS.shortText),
  bio: draftText(APPLICATION_LIMITS.bio),
  links: draftLinkList,
  school: draftText(APPLICATION_LIMITS.shortText),
  major: draftText(APPLICATION_LIMITS.shortText),
  graduationYear: draftWholeNumber(APPLICATION_LIMITS.graduationYear.min, APPLICATION_LIMITS.graduationYear.max),
  experienceLevel: draftSingleChoice(EXPERIENCE_LEVELS),
  skills: draftMultiChoice(HACKER_SKILLS, APPLICATION_LIMITS.skills),
  previousHackathonCount: draftWholeNumber(
    APPLICATION_LIMITS.previousHackathonCount.min,
    APPLICATION_LIMITS.previousHackathonCount.max,
  ),
  buildGoals: draftText(APPLICATION_LIMITS.longAnswer),
  proudProject: draftText(APPLICATION_LIMITS.longAnswer),
  codeOfConductAccepted: draftAgreement,
});

export const judgeApplicationDraftSchema = z.object({
  preferredName: draftText(APPLICATION_LIMITS.preferredName),
  location: draftText(APPLICATION_LIMITS.shortText),
  bio: draftText(APPLICATION_LIMITS.bio),
  links: draftLinkList,
  company: draftText(APPLICATION_LIMITS.shortText),
  roleTitle: draftText(APPLICATION_LIMITS.shortText),
  yearsExperience: draftWholeNumber(APPLICATION_LIMITS.yearsExperience.min, APPLICATION_LIMITS.yearsExperience.max),
  expertiseAreas: draftMultiChoice(JUDGE_EXPERTISE_AREAS, APPLICATION_LIMITS.expertiseAreas),
  judgingExperience: draftText(APPLICATION_LIMITS.mediumAnswer),
  availability: draftMultiChoice(JUDGE_AVAILABILITY_BLOCKS, APPLICATION_LIMITS.availability),
  preferredCategories: draftMultiChoice(PROJECT_CATEGORIES, APPLICATION_LIMITS.preferredCategories),
  conflictsOfInterest: draftText(APPLICATION_LIMITS.mediumAnswer),
  evaluationApproach: draftText(APPLICATION_LIMITS.longAnswer),
  motivation: draftText(APPLICATION_LIMITS.longAnswer),
  codeOfConductAccepted: draftAgreement,
});

// ---------------------------------------------------------------------------
// Types and registry
// ---------------------------------------------------------------------------

export type HackerApplicationResponses = z.output<typeof hackerApplicationSchema>;
export type JudgeApplicationResponses = z.output<typeof judgeApplicationSchema>;
export type HackerApplicationDraft = z.output<typeof hackerApplicationDraftSchema>;
export type JudgeApplicationDraft = z.output<typeof judgeApplicationDraftSchema>;

/** Input accepted by saveApplication for each type (all fields optional; null clears). */
export type HackerApplicationDraftInput = z.input<typeof hackerApplicationDraftSchema>;
export type JudgeApplicationDraftInput = z.input<typeof judgeApplicationDraftSchema>;

export interface ApplicationResponsesByType {
  hacker: HackerApplicationResponses;
  judge: JudgeApplicationResponses;
}

export interface ApplicationDraftByType {
  hacker: HackerApplicationDraft;
  judge: JudgeApplicationDraft;
}

export type ApplicationFieldKey<T extends ApplicationType = ApplicationType> = keyof ApplicationResponsesByType[T] &
  string;

export const APPLICATION_SCHEMAS = {
  hacker: { submission: hackerApplicationSchema, draft: hackerApplicationDraftSchema },
  judge: { submission: judgeApplicationSchema, draft: judgeApplicationDraftSchema },
} as const;

export function getApplicationSubmissionSchema<T extends ApplicationType>(type: T) {
  return APPLICATION_SCHEMAS[type].submission;
}

export function getApplicationDraftSchema<T extends ApplicationType>(type: T) {
  return APPLICATION_SCHEMAS[type].draft;
}

// ---------------------------------------------------------------------------
// Sections (drive completion calculation and Launch Readiness)
// ---------------------------------------------------------------------------

export interface ApplicationSectionDefinition<K extends string = string> {
  readonly id: string;
  readonly fields: readonly K[];
}

export const APPLICATION_SECTIONS = {
  hacker: [
    { id: "about", fields: ["preferredName", "location", "bio", "links"] },
    { id: "education", fields: ["school", "major", "graduationYear"] },
    { id: "experience", fields: ["experienceLevel", "skills", "previousHackathonCount"] },
    { id: "short_answers", fields: ["buildGoals", "proudProject"] },
    { id: "agreements", fields: ["codeOfConductAccepted"] },
  ],
  judge: [
    { id: "about", fields: ["preferredName", "location", "bio", "links"] },
    { id: "professional", fields: ["company", "roleTitle", "yearsExperience", "expertiseAreas"] },
    { id: "judging", fields: ["judgingExperience", "availability", "preferredCategories", "conflictsOfInterest"] },
    { id: "short_answers", fields: ["evaluationApproach", "motivation"] },
    { id: "agreements", fields: ["codeOfConductAccepted"] },
  ],
} as const satisfies {
  hacker: readonly ApplicationSectionDefinition<ApplicationFieldKey<"hacker">>[];
  judge: readonly ApplicationSectionDefinition<ApplicationFieldKey<"judge">>[];
};

export type ApplicationSectionId<T extends ApplicationType = ApplicationType> =
  (typeof APPLICATION_SECTIONS)[T][number]["id"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Section definitions for a type, in form order. */
export function getApplicationSections(type: ApplicationType): readonly ApplicationSectionDefinition[] {
  return APPLICATION_SECTIONS[type];
}

/** All response keys for a type, in form order. */
export function getApplicationFieldKeys(type: ApplicationType): string[] {
  return getApplicationSections(type).flatMap((section) => [...section.fields]);
}

/** True when the submission schema rejects a missing value for the field. */
export function isRequiredApplicationField(type: ApplicationType, key: string): boolean {
  const shape = APPLICATION_SCHEMAS[type].submission.shape as Record<string, z.ZodType>;
  const field = shape[key];
  return field !== undefined && !field.safeParse(undefined).success;
}

export function getRequiredApplicationFieldKeys(type: ApplicationType): string[] {
  return getApplicationFieldKeys(type).filter((key) => isRequiredApplicationField(type, key));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClearedValue(value: unknown): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

/**
 * Merges a parsed draft patch into the stored responses.
 * - keys absent from the patch keep their stored value
 * - null or blank strings remove the stored answer
 * - unknown stored keys are dropped
 */
export function mergeApplicationResponses(
  type: ApplicationType,
  stored: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const knownKeys = new Set(getApplicationFieldKeys(type));
  const merged: Record<string, unknown> = {};

  if (isPlainObject(stored)) {
    for (const [key, value] of Object.entries(stored)) {
      if (knownKeys.has(key) && !isClearedValue(value)) {
        merged[key] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(patch)) {
    if (!knownKeys.has(key) || value === undefined) {
      continue;
    }
    if (isClearedValue(value)) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

/** Parses stored responses leniently for display: invalid or unknown values are dropped. */
export function parseStoredResponses<T extends ApplicationType>(
  type: T,
  stored: unknown,
): Partial<ApplicationDraftByType[T]> {
  if (!isPlainObject(stored)) {
    return {};
  }

  const shape = APPLICATION_SCHEMAS[type].draft.shape as Record<string, z.ZodType>;
  const parsed: Record<string, unknown> = {};

  for (const key of getApplicationFieldKeys(type)) {
    const field = shape[key];
    if (!field || !(key in stored)) {
      continue;
    }
    const result = field.safeParse(stored[key]);
    if (result.success && result.data !== undefined && result.data !== null) {
      parsed[key] = result.data;
    }
  }

  return parsed as Partial<ApplicationDraftByType[T]>;
}
