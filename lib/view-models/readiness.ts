import { COPY } from "@/content/copy";
import type { ApplicationType } from "@/lib/domain/enums";
import { REVIEW_STEP, applicationStepHref, sectionForField, type EditorStep } from "@/lib/editor/steps";
import type { ApplicationCompletion, SectionCompletion } from "@/lib/validation/completion";
import { getSectionLabel } from "@/lib/view-models/fields";
import type { ReadinessItemView, SectionNavItemView } from "@/lib/view-models/types";

// =============================================================================
// Launch Readiness checklist and editor section navigation (client-safe, pure).
//
// Section states come from the saved completion, which is derived from the submission schema, so the portal checklist,
// the review step, and the editor navigation always agree. Callers add the current step, the sections completed by
// the latest save, and the fields that currently show errors.
// =============================================================================

/** Options for Launch Readiness items. */
export interface ReadinessOptions {
  /** The section the applicant is on. Absent or null falls back to the next incomplete section. */
  currentSectionId?: string | null;
  /** Section ids completed by the most recent successful save. */
  justCompleted?: readonly string[];
  /** Field keys that currently show an error; the sections containing them need attention. */
  attentionFieldKeys?: readonly string[];
}

/** Options for editor section navigation items. */
export interface SectionNavOptions {
  /** Section ids completed by the most recent successful save. */
  justCompleted?: readonly string[];
  /** Field keys that currently show an error; the sections containing them need attention. */
  attentionFieldKeys?: readonly string[];
}

interface SectionSummary {
  label: string;
  state: SectionCompletion["status"];
  stateLabel: string;
  needsAttention: boolean;
  justCompleted: boolean;
  href: string;
}

// Keys that are not fields of this form (another type's fields, typos) belong to no section and are ignored.
function sectionsWithAttention(type: ApplicationType, fieldKeys: readonly string[] | undefined): Set<string> {
  const sectionIds = new Set<string>();
  for (const key of fieldKeys ?? []) {
    const sectionId = sectionForField(type, key);
    if (sectionId !== null) {
      sectionIds.add(sectionId);
    }
  }
  return sectionIds;
}

function summarizeSection(
  type: ApplicationType,
  section: SectionCompletion,
  attention: ReadonlySet<string>,
  justCompleted: readonly string[] | undefined,
): SectionSummary {
  return {
    label: getSectionLabel(type, section.id),
    state: section.status,
    stateLabel: COPY.readiness.states[section.status],
    // A saved answer that fails the submission schema needs attention even when no error is on screen.
    needsAttention: section.invalidFields.length > 0 || attention.has(section.id),
    justCompleted: justCompleted?.includes(section.id) ?? false,
    href: applicationStepHref(type, section.id),
  };
}

/**
 * Launch Readiness items, one per section in form order, linking to each section's editor step. A section needs
 * attention when a saved answer fails the submission schema or when one of `attentionFieldKeys` belongs to it. The
 * current item is `currentSectionId`, or the next incomplete section when it is absent or null, so no item is
 * current once every section is complete (or when the editor is on the review step).
 */
export function toReadinessItems(
  type: ApplicationType,
  completion: ApplicationCompletion,
  options: ReadinessOptions,
): ReadinessItemView[] {
  const attention = sectionsWithAttention(type, options.attentionFieldKeys);
  const currentSectionId = options.currentSectionId ?? completion.nextIncompleteSectionId;

  return completion.sections.map((section) => {
    const summary = summarizeSection(type, section, attention, options.justCompleted);
    return {
      id: section.id,
      label: summary.label,
      state: summary.state,
      stateLabel: summary.stateLabel,
      isCurrent: section.id === currentSectionId,
      justCompleted: summary.justCompleted,
      needsAttention: summary.needsAttention,
      progressText: COPY.readiness.progress(section.completedRequiredFieldCount, section.requiredFieldCount),
      href: summary.href,
    };
  });
}

/**
 * Editor navigation: every section in form order, then the review step. Review has the state "review" and never needs
 * attention; its state label reads complete once the application can be submitted, otherwise not started.
 */
export function toSectionNavItems(
  type: ApplicationType,
  completion: ApplicationCompletion,
  activeStep: EditorStep,
  options: SectionNavOptions,
): SectionNavItemView[] {
  const attention = sectionsWithAttention(type, options.attentionFieldKeys);

  const sectionItems = completion.sections.map((section): SectionNavItemView => {
    const summary = summarizeSection(type, section, attention, options.justCompleted);
    return {
      step: section.id,
      label: summary.label,
      state: summary.state,
      stateLabel: summary.stateLabel,
      isActive: section.id === activeStep,
      needsAttention: summary.needsAttention,
      justCompleted: summary.justCompleted,
      href: summary.href,
    };
  });

  const reviewItem: SectionNavItemView = {
    step: REVIEW_STEP,
    label: getSectionLabel(type, REVIEW_STEP),
    state: "review",
    stateLabel: completion.isSubmittable ? COPY.readiness.states.complete : COPY.readiness.states.not_started,
    isActive: activeStep === REVIEW_STEP,
    needsAttention: false,
    justCompleted: false,
    href: applicationStepHref(type, REVIEW_STEP),
  };

  return [...sectionItems, reviewItem];
}
