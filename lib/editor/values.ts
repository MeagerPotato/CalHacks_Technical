import type { z } from "zod";

import { APPLICATION_FORMS, type ApplicationFieldConfig } from "@/lib/application-config";
import type { ApplicantApplication } from "@/lib/data/types";
import type { ApplicationStatus, ApplicationType } from "@/lib/domain/enums";
import { getApplicationDraftSchema } from "@/lib/validation/application";
import type { FieldErrors } from "@/lib/validation/errors";

// =============================================================================
// Editor value model (client-safe, pure).
//
// Controls hold UI values: strings for text, whole numbers, single choices, and link lists; string arrays for multi
// choices; booleans for agreements. Saves send draft payloads built from those values (trimmed, normalized, null to
// clear). Dirty checks compare payloads, so trailing spaces or checkbox order never count as unsaved changes.
// =============================================================================

/** The value a form control holds for one field. */
export type UiValue = string | string[] | boolean;

/** UI values keyed by response field key. */
export type UiValues = Record<string, UiValue>;

/** The saveApplication patch for the current values, plus what could not be sent. */
export interface DraftPatch {
  /** JSON-serializable draft input with valid dirty keys only. Null clears a saved answer. */
  patch: Record<string, unknown>;
  /** The UI values behind `patch`, used to rebase edits when the save returns. */
  sent: UiValues;
  /** Draft-schema messages for dirty keys that cannot be saved yet. */
  invalid: FieldErrors;
  /** The UI values behind `invalid`, used to drop those errors once the user edits again. */
  validated: UiValues;
  /** Every key whose payload differs from the baseline payload, valid or not, in form order. */
  dirtyKeys: string[];
}

const WHOLE_NUMBER_PATTERN = /^\d{1,9}$/;
const LINE_BREAK = /\r?\n/;

const FORM_FIELDS: Record<ApplicationType, readonly ApplicationFieldConfig[]> = {
  hacker: APPLICATION_FORMS.hacker.sections.flatMap((section) => section.fields),
  judge: APPLICATION_FORMS.judge.sections.flatMap((section) => section.fields),
};

// Decisions share a rank: neither outcome replaces the other.
const STATUS_RANK: Record<ApplicationStatus, number> = {
  draft: 0,
  submitted: 1,
  in_review: 2,
  accepted: 3,
  waitlisted: 3,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyStrings(values: readonly unknown[]): string[] {
  return values.filter((item): item is string => typeof item === "string");
}

function emptyUiValue(field: ApplicationFieldConfig): UiValue {
  switch (field.kind) {
    case "multi_choice":
      return [];
    case "agreement":
      return false;
    default:
      return "";
  }
}

function copyUiValue(value: UiValue): UiValue {
  return Array.isArray(value) ? [...value] : value;
}

function toUiValue(field: ApplicationFieldConfig, stored: unknown): UiValue {
  switch (field.kind) {
    case "short_text":
    case "long_text":
    case "single_choice":
      return typeof stored === "string" ? stored : "";
    case "whole_number":
      return typeof stored === "number" && Number.isFinite(stored) ? String(stored) : "";
    case "multi_choice":
      return Array.isArray(stored) ? onlyStrings(stored) : [];
    case "link_list":
      return Array.isArray(stored) ? onlyStrings(stored).join("\n") : "";
    case "agreement":
      return stored === true;
  }
}

/**
 * Converts saved responses into UI values. Every field of the form gets a value: "" for unanswered text, numbers,
 * single choices, and link lists; [] for multi choices; false for agreements. Arrays are copied.
 */
export function toUiValues(type: ApplicationType, responses: Record<string, unknown>): UiValues {
  const source = isPlainObject(responses) ? responses : {};
  const values: UiValues = {};
  for (const field of FORM_FIELDS[type]) {
    values[field.key] = toUiValue(field, source[field.key]);
  }
  return values;
}

/**
 * Converts one UI value into its draft payload. Blank answers become null, which clears the saved answer. A value
 * that does not fit the field (such as "20.5" for a whole number) is sent unchanged, so the draft schema reports its
 * message instead of the value being silently dropped.
 */
export function toPayloadValue(field: ApplicationFieldConfig, value: UiValue): unknown {
  switch (field.kind) {
    case "short_text":
    case "long_text": {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    case "whole_number": {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      if (trimmed === "") {
        return null;
      }
      return WHOLE_NUMBER_PATTERN.test(trimmed) ? Number(trimmed) : value;
    }
    case "single_choice":
      return value === "" ? null : value;
    case "multi_choice": {
      if (!Array.isArray(value)) {
        return value;
      }
      // Known options follow option order; unknown values stay (deduplicated) so validation can reject them.
      const selected = new Set<unknown>(value);
      const optionValues = (field.options ?? []).map((option) => option.value);
      const knownValues = new Set<unknown>(optionValues);
      const ordered: unknown[] = [
        ...optionValues.filter((option) => selected.has(option)),
        ...Array.from(selected).filter((item) => !knownValues.has(item)),
      ];
      return ordered.length === 0 ? null : ordered;
    }
    case "link_list": {
      if (typeof value !== "string") {
        return value;
      }
      const links = value
        .split(LINE_BREAK)
        .map((line) => line.trim())
        .filter((line) => line !== "");
      return links.length === 0 ? null : links;
    }
    case "agreement":
      return value === false ? null : value;
  }
}

/** True when two UI values hold the same content (arrays compare element by element, in order). */
export function uiValueEqual(a: UiValue | undefined, b: UiValue | undefined): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => item === b[index]);
  }
  return a === b;
}

/** Deep equality for JSON-compatible payload values. Object key order does not matter; array order does. */
export function payloadEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => payloadEqual(item, b[index]))
    );
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && payloadEqual(a[key], b[key]))
    );
  }
  return false;
}

/**
 * Validates one draft payload against its field in the draft schema and returns the unique messages, or [] when
 * valid. Keys the schema does not define return [] because the draft schema strips them.
 */
export function validateDraftValue(type: ApplicationType, key: string, payload: unknown): string[] {
  const shape = getApplicationDraftSchema(type).shape as Record<string, z.ZodType>;
  // Own-property check: "constructor" and similar keys must not resolve to Object.prototype members.
  if (!Object.prototype.hasOwnProperty.call(shape, key)) {
    return [];
  }
  const result = shape[key].safeParse(payload);
  return result.success ? [] : Array.from(new Set(result.error.issues.map((issue) => issue.message)));
}

/**
 * Compares UI values with the saved baseline and builds a partial save. A key is dirty when its payload differs from
 * the baseline payload; keys missing from `values` are unchanged, and keys missing from `baseline` count as
 * unanswered. Only valid dirty keys are sent, so one invalid answer never blocks saving the others. Inputs are never
 * mutated, and array values are copied into the result.
 */
export function buildDraftPatch(type: ApplicationType, baseline: UiValues, values: UiValues): DraftPatch {
  const result: DraftPatch = { patch: {}, sent: {}, invalid: {}, validated: {}, dirtyKeys: [] };

  for (const field of FORM_FIELDS[type]) {
    const { key } = field;
    const value: UiValue | undefined = values[key];
    if (value === undefined) {
      continue;
    }

    const payload = toPayloadValue(field, value);
    const baselineValue: UiValue | undefined = baseline[key];
    if (payloadEqual(payload, toPayloadValue(field, baselineValue ?? emptyUiValue(field)))) {
      continue;
    }

    result.dirtyKeys.push(key);
    const messages = validateDraftValue(type, key, payload);
    if (messages.length > 0) {
      result.invalid[key] = messages;
      result.validated[key] = copyUiValue(value);
    } else {
      result.patch[key] = payload;
      result.sent[key] = copyUiValue(value);
    }
  }

  return result;
}

/**
 * True when `a` is strictly newer than `b`: a later `updatedAt` instant wins (a parseable one beats an unparseable
 * one), then the raw strings break ties within the same millisecond (Postgres keeps microseconds), then the status
 * rank draft < submitted < in_review < accepted/waitlisted.
 */
export function isNewerApplication(a: ApplicantApplication, b: ApplicantApplication): boolean {
  const aTime = Date.parse(a.updatedAt);
  const bTime = Date.parse(b.updatedAt);
  const aParsed = !Number.isNaN(aTime);
  const bParsed = !Number.isNaN(bTime);

  if (aParsed !== bParsed) {
    return aParsed;
  }
  if (aParsed && aTime !== bTime) {
    return aTime > bTime;
  }
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt > b.updatedAt;
  }
  return STATUS_RANK[a.status] > STATUS_RANK[b.status];
}

/** Counts Unicode code points, the unit Zod uses for maximum lengths, so an emoji counts as one character. */
export function countCharacters(value: string): number {
  return Array.from(value).length;
}
