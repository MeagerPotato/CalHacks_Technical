import type { ApplicationType } from "@/lib/domain/enums";
import { portalApplicationRoute } from "@/lib/routes";
import { APPLICATION_SECTIONS, type ApplicationSectionId } from "@/lib/validation/application";
import type { ApplicationCompletion } from "@/lib/validation/completion";

// =============================================================================
// Editor steps, step URLs, and the frozen DOM ids the editor focuses (client-safe, pure).
//
// A step is an application section id or "review". It travels in the `section` search parameter, so parsing treats
// the raw value as untrusted input.
// =============================================================================

/** The last editor step, after every application section. */
export const REVIEW_STEP = "review";

/** An application section id, or the review step. */
export type EditorStep = ApplicationSectionId | typeof REVIEW_STEP;

interface StepSection {
  readonly id: ApplicationSectionId;
  readonly fields: readonly string[];
}

function sectionsFor(type: ApplicationType): readonly StepSection[] {
  return APPLICATION_SECTIONS[type];
}

/** Steps for an application type: its sections in form order, then review. Returns a new array. */
export function getEditorSteps(type: ApplicationType): EditorStep[] {
  return [...sectionsFor(type).map((section) => section.id), REVIEW_STEP];
}

/**
 * Returns `raw` when it is exactly one of the type's steps, otherwise null. Membership is checked against the step
 * list, never with an object-key lookup, so values such as "constructor" or "__proto__" cannot match.
 */
export function parseEditorStep(type: ApplicationType, raw: unknown): EditorStep | null {
  if (typeof raw !== "string") {
    return null;
  }
  return getEditorSteps(type).find((step) => step === raw) ?? null;
}

/** The step after `step`, or null after review or when the type has no such step. */
export function getNextStep(type: ApplicationType, step: EditorStep): EditorStep | null {
  const steps = getEditorSteps(type);
  const index = steps.indexOf(step);
  return index === -1 || index === steps.length - 1 ? null : steps[index + 1];
}

/** Id of a step's `h2`, which receives focus after step navigation. */
export function sectionHeadingId(step: string): string {
  return `section-heading-${step}`;
}

/** Id of a field's control, or of the first option in a choice group. */
export function fieldControlId(key: string): string {
  return `field-${key}`;
}

/** Id of a field's generated hint. */
export function fieldHintId(key: string): string {
  return `${fieldControlId(key)}-hint`;
}

/** Id of a field's inline error message. */
export function fieldErrorId(key: string): string {
  return `${fieldControlId(key)}-error`;
}

/** Id of a field's character or selection counter. */
export function fieldCounterId(key: string): string {
  return `${fieldControlId(key)}-counter`;
}

/** URL of an editor step, `/portal/application?type=<type>&section=<step>`, plus `#field-<key>` to jump to a field. */
export function applicationStepHref(type: ApplicationType, step: EditorStep, fieldKey?: string): string {
  const href = `${portalApplicationRoute(type)}&section=${encodeURIComponent(step)}`;
  return fieldKey ? `${href}#${fieldControlId(fieldKey)}` : href;
}

/** The section that contains a field, or null when the type has no such field. */
export function sectionForField(type: ApplicationType, key: string): ApplicationSectionId | null {
  return sectionsFor(type).find((section) => section.fields.includes(key))?.id ?? null;
}

/**
 * The step to open first: the requested `section` when it is valid for the type, else the next incomplete section,
 * else review.
 */
export function resolveInitialStep(
  type: ApplicationType,
  rawSection: unknown,
  completion: ApplicationCompletion,
): EditorStep {
  return (
    parseEditorStep(type, rawSection) ?? parseEditorStep(type, completion.nextIncompleteSectionId) ?? REVIEW_STEP
  );
}

/**
 * True for clicks the browser should handle itself: a modifier key (new tab, window, download) or a non-primary
 * button.
 */
export function isModifiedClick(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
}): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}
