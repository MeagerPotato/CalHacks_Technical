import { COPY, FIELD_COPY, SECTION_COPY } from "@/content/copy";
import {
  APPLICATION_FORMS,
  type ApplicationFieldConfig,
  type ApplicationSectionConfig,
} from "@/lib/application-config";
import type { ApplicationType } from "@/lib/domain/enums";
import { REVIEW_STEP } from "@/lib/editor/steps";
import type { FieldCopyView } from "@/lib/view-models/types";

// =============================================================================
// Field and section copy for the application editor (client-safe, pure).
//
// Hints restate validation rules, so they are generated from the form config (itself derived from the Zod schemas)
// and cannot drift. FIELD_COPY and SECTION_COPY only add optional label overrides, help prose, and section intros.
// =============================================================================

function indexFields(type: ApplicationType): ReadonlyMap<string, ApplicationFieldConfig> {
  return new Map(
    APPLICATION_FORMS[type].sections.flatMap((section) => section.fields.map((field) => [field.key, field] as const)),
  );
}

const FIELDS_BY_KEY: Record<ApplicationType, ReadonlyMap<string, ApplicationFieldConfig>> = {
  hacker: indexFields("hacker"),
  judge: indexFields("judge"),
};

// A blank override counts as absent, so a copy edit can never remove a field's accessible name.
function presentText(value: string | undefined): string | null {
  return value !== undefined && value.trim() !== "" ? value : null;
}

function generatedHint(field: ApplicationFieldConfig): string | null {
  const { hints } = COPY.editor;
  switch (field.kind) {
    case "whole_number":
      return field.min !== undefined && field.max !== undefined ? hints.wholeNumber(field.min, field.max) : null;
    case "profile_link":
      return field.example !== undefined ? hints.profileLink(field.example) : null;
    case "searchable_choice":
      return hints.searchableChoice;
    case "multi_choice":
      return field.maxItems !== undefined ? hints.chooseUpTo(field.maxItems) : null;
    case "short_text":
    case "long_text":
      return field.maxLength !== undefined ? hints.maxCharacters(field.maxLength) : null;
    default:
      return null;
  }
}

/**
 * Label, generated hint, help prose, and optional marker for one application field. The label comes from FIELD_COPY
 * when overridden, else the config label; the hint is generated from the config limits and is never editable copy.
 */
export function resolveFieldCopy(type: ApplicationType, field: ApplicationFieldConfig): FieldCopyView {
  const override = Object.prototype.hasOwnProperty.call(FIELD_COPY, field.key) ? FIELD_COPY[field.key] : undefined;
  return {
    label: presentText(override?.label) ?? field.label,
    hint: generatedHint(field),
    help: presentText(override?.help),
    optionalText: field.required ? null : COPY.common.optional,
  };
}

/** Section label from the config and the optional intro from SECTION_COPY. */
export function resolveSectionCopy(
  type: ApplicationType,
  section: ApplicationSectionConfig,
): { label: string; intro: string | null } {
  return { label: section.label, intro: presentText(SECTION_COPY[section.id]?.intro) };
}

/** The config for a field of the given type, or null when that form has no such field. */
export function getFieldConfig(type: ApplicationType, key: string): ApplicationFieldConfig | null {
  return FIELDS_BY_KEY[type].get(key) ?? null;
}

/**
 * Display label for an editor step: `COPY.editor.reviewStep` for review, else the section label. An id the form does
 * not have is returned unchanged, so a caller bug shows up as visible text rather than a blank label.
 */
export function getSectionLabel(type: ApplicationType, sectionId: string): string {
  if (sectionId === REVIEW_STEP) {
    return COPY.editor.reviewStep;
  }
  return APPLICATION_FORMS[type].sections.find((section) => section.id === sectionId)?.label ?? sectionId;
}
