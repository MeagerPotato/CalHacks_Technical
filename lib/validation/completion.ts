import type { z } from "zod";

import type { ApplicationType } from "@/lib/domain/enums";
import {
  APPLICATION_SCHEMAS,
  getApplicationSections,
  isRequiredApplicationField,
  type ApplicationSectionId,
} from "@/lib/validation/application";
import { toFieldErrors, type FieldErrors } from "@/lib/validation/errors";

export type SectionCompletionStatus = "complete" | "in_progress" | "not_started";

export interface SectionCompletion<T extends ApplicationType = ApplicationType> {
  id: ApplicationSectionId<T>;
  status: SectionCompletionStatus;
  requiredFieldCount: number;
  completedRequiredFieldCount: number;
  /** Required fields that are missing or invalid. */
  missingRequiredFields: string[];
  /** Answered fields (required or optional) whose value fails the submission schema. */
  invalidFields: string[];
}

export interface ApplicationCompletion<T extends ApplicationType = ApplicationType> {
  /** Integer 0-100. 100 only when the submission schema passes. */
  percent: number;
  /** True when submitApplication would accept the current responses. */
  isSubmittable: boolean;
  requiredFieldCount: number;
  completedRequiredFieldCount: number;
  sections: SectionCompletion<T>[];
  /** First section that is not complete, in form order; null when every section is complete. */
  nextIncompleteSectionId: ApplicationSectionId<T> | null;
  missingRequiredFields: string[];
  /** Submission-schema errors keyed by field (empty when submittable). */
  fieldErrors: FieldErrors;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasAnswer(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  return false;
}

/**
 * Derives completion and Launch Readiness data from the role-specific submission schema.
 * Required fields count toward the percentage; optional fields only affect a section when
 * they contain an invalid value.
 */
export function calculateApplicationCompletion<T extends ApplicationType>(
  type: T,
  responses: unknown,
): ApplicationCompletion<T> {
  const schema = APPLICATION_SCHEMAS[type].submission;
  const shape = schema.shape as Record<string, z.ZodType>;
  const answers = isPlainObject(responses) ? responses : {};
  const submission = schema.safeParse(answers);

  let requiredFieldCount = 0;
  let completedRequiredFieldCount = 0;
  const missingRequiredFields: string[] = [];

  const sections = getApplicationSections(type).map((section) => {
    let sectionRequired = 0;
    let sectionCompleted = 0;
    let answeredCount = 0;
    const sectionMissing: string[] = [];
    const invalidFields: string[] = [];

    for (const key of section.fields as readonly string[]) {
      const value = answers[key];
      const answered = hasAnswer(value);
      const valid = shape[key]?.safeParse(value).success ?? false;
      const required = isRequiredApplicationField(type, key);

      if (answered) answeredCount += 1;

      if (required) {
        sectionRequired += 1;
        if (answered && valid) {
          sectionCompleted += 1;
        } else {
          sectionMissing.push(key);
        }
      }

      if (answered && !valid) {
        invalidFields.push(key);
      }
    }

    requiredFieldCount += sectionRequired;
    completedRequiredFieldCount += sectionCompleted;
    missingRequiredFields.push(...sectionMissing);

    const status: SectionCompletionStatus =
      answeredCount === 0 && sectionRequired > 0
        ? "not_started"
        : sectionCompleted === sectionRequired && invalidFields.length === 0
          ? "complete"
          : "in_progress";

    return {
      id: section.id as ApplicationSectionId<T>,
      status,
      requiredFieldCount: sectionRequired,
      completedRequiredFieldCount: sectionCompleted,
      missingRequiredFields: sectionMissing,
      invalidFields,
    };
  });

  let percent =
    requiredFieldCount === 0 ? 100 : Math.round((completedRequiredFieldCount / requiredFieldCount) * 100);
  if (percent === 100 && !submission.success) {
    percent = 99;
  }
  if (percent < 100 && submission.success) {
    percent = 100;
  }

  return {
    percent,
    isSubmittable: submission.success,
    requiredFieldCount,
    completedRequiredFieldCount,
    sections,
    nextIncompleteSectionId: sections.find((section) => section.status !== "complete")?.id ?? null,
    missingRequiredFields,
    fieldErrors: submission.success ? {} : toFieldErrors(submission.error),
  };
}
