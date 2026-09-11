import { COPY } from "@/content/copy";
import { APPLICATION_FORMS, type ApplicationFieldConfig } from "@/lib/application-config";
import type { ApplicationType } from "@/lib/domain/enums";
import { applicationStepHref } from "@/lib/editor/steps";
import type { FieldErrors } from "@/lib/validation/errors";
import { resolveFieldCopy, resolveSectionCopy } from "@/lib/view-models/fields";
import type { AnswerSectionView, AnswerView } from "@/lib/view-models/types";

// =============================================================================
// Read-only answers for the review step and the submitted application (client-safe, pure).
//
// Stored option values become their config labels, so applicants read what they chose rather than internal values.
// Blank text and empty lists count as unanswered, the same way completion treats them.
// =============================================================================

/** Options for answer sections. */
export interface AnswerSectionOptions {
  /** Messages keyed by field key; each answer shows only its own. */
  fieldErrors?: FieldErrors;
  /** Edit links are built only while the application can still be edited. */
  editable: boolean;
}

type AnswerValue = AnswerView["value"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(stored: unknown): string | null {
  if (typeof stored === "string") {
    return stored.trim() === "" ? null : stored;
  }
  return typeof stored === "number" && Number.isFinite(stored) ? String(stored) : null;
}

function nonBlankStrings(stored: unknown): string[] {
  return Array.isArray(stored)
    ? stored.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
}

function listValue(items: string[]): string[] | null {
  return items.length === 0 ? null : items;
}

// A value the config does not list is shown as stored rather than hidden, so no saved answer silently disappears.
function optionLabel(field: ApplicationFieldConfig, value: string): string {
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

function displayValue(field: ApplicationFieldConfig, stored: unknown): AnswerValue {
  switch (field.kind) {
    case "short_text":
    case "long_text":
    case "whole_number":
      return textValue(stored);
    case "single_choice": {
      const value = textValue(stored);
      return value === null ? null : optionLabel(field, value);
    }
    case "multi_choice":
      return listValue(nonBlankStrings(stored).map((value) => optionLabel(field, value)));
    case "link_list":
      return listValue(nonBlankStrings(stored));
    case "agreement":
      // An agreement always has an answer to show: only a stored true counts as accepted.
      return stored === true ? COPY.review.agreementAccepted : COPY.review.agreementNotAccepted;
  }
}

function toAnswer(
  type: ApplicationType,
  field: ApplicationFieldConfig,
  stored: unknown,
  fieldErrors: FieldErrors | undefined,
): AnswerView {
  const value = displayValue(field, stored);
  const messages = fieldErrors?.[field.key];
  return {
    key: field.key,
    label: resolveFieldCopy(type, field).label,
    value,
    missingText: value !== null ? null : field.required ? COPY.review.notAnsweredRequired : COPY.review.notAnswered,
    // Copied so a view model never shares an array with editor state.
    errors: Array.isArray(messages) ? [...messages] : [],
  };
}

/**
 * Every field of the form, grouped by section in form order, with display-ready values: option labels for choices
 * (unknown stored values as stored), strings for numbers, string arrays for links, and accepted or not accepted for
 * agreements. Blank strings and empty lists are unanswered and carry missing text that marks required fields;
 * agreements never do. Errors come from `options.fieldErrors`. Edit labels and links to each section's editor step are
 * present only when `options.editable` is true, otherwise null.
 */
export function toAnswerSections(
  type: ApplicationType,
  responses: Record<string, unknown>,
  options: AnswerSectionOptions,
): AnswerSectionView[] {
  const answers = isPlainObject(responses) ? responses : {};

  return APPLICATION_FORMS[type].sections.map((section) => {
    const { label } = resolveSectionCopy(type, section);
    return {
      id: section.id,
      label,
      editLabel: options.editable ? COPY.review.editSection(label) : null,
      editHref: options.editable ? applicationStepHref(section.id) : null,
      answers: section.fields.map((field) => toAnswer(type, field, answers[field.key], options.fieldErrors)),
    };
  });
}
