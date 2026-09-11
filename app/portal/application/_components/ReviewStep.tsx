"use client";

import type { MouseEvent } from "react";

import { AnswerSummary } from "@/components/application/AnswerSummary";
import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { SectionPanel } from "@/components/application/SectionPanel";
import { LaunchReadiness } from "@/components/portal/LaunchReadiness";
import { AppLink } from "@/components/ui/AppLink";
import { Notice } from "@/components/ui/Notice";
import { COPY, LOCKED } from "@/content/copy";
import type { ApplicantApplication } from "@/lib/data/types";
import { REVIEW_STEP, applicationStepHref, sectionHeadingId } from "@/lib/editor/steps";
import type { FieldErrors } from "@/lib/validation/errors";
import { toAnswerSections } from "@/lib/view-models/answers";
import { getSectionLabel } from "@/lib/view-models/fields";
import { toReadinessItems } from "@/lib/view-models/readiness";

interface ReviewStepProps {
  saved: ApplicantApplication;
  /** Every current error, including client messages about unsaved edits. Drives Launch Readiness attention. */
  errors: FieldErrors;
  /**
   * Errors about the saved answers only (server messages). The summary shows saved values, so a client message about
   * an unsaved edit would otherwise appear beside a different, valid value.
   */
  answerErrors: FieldErrors;
  justCompleted: readonly string[];
  hasUnsavedChanges: boolean;
  submitting: boolean;
  onSelectStep(step: string, event: MouseEvent<HTMLAnchorElement>): void;
  onSubmit(): void;
}

/**
 * Final review: Launch Readiness, every saved answer with edit links, and the irreversible submit. The submit
 * button is never disabled for incompleteness; submitting an incomplete application explains what is missing.
 */
export function ReviewStep({
  saved,
  errors,
  answerErrors,
  justCompleted,
  hasUnsavedChanges,
  submitting,
  onSelectStep,
  onSubmit,
}: ReviewStepProps) {
  const { completion } = saved;
  const readiness = toReadinessItems(saved.type, completion, {
    // The applicant is on review, so no section is current.
    currentSectionId: REVIEW_STEP,
    justCompleted,
    attentionFieldKeys: Object.keys(errors),
  });
  const sections = toAnswerSections(saved.type, saved.responses, { fieldErrors: answerErrors, editable: true });
  const missingCount = completion.missingRequiredFields.length;
  const firstIncomplete = completion.nextIncompleteSectionId;

  return (
    <SectionPanel
      step={REVIEW_STEP}
      headingId={sectionHeadingId(REVIEW_STEP)}
      title={LOCKED.review.heading}
      intro={COPY.review.intro}
      actions={
        <ReviewSubmit
          noteId="review-irreversible"
          note={LOCKED.review.irreversible}
          submitLabel={LOCKED.review.submit}
          pending={submitting}
          onSubmit={onSubmit}
        />
      }
    >
      <LaunchReadiness items={readiness} headingLevel={3} onSelect={(item, event) => onSelectStep(item.id, event)} />
      {hasUnsavedChanges ? <Notice id="review-unsaved" tone="warning" title={COPY.review.unsaved} /> : null}
      {missingCount > 0 ? (
        <Notice id="review-incomplete" tone="info" title={COPY.review.missing(missingCount)}>
          {firstIncomplete ? (
            <AppLink
              href={applicationStepHref(firstIncomplete)}
              onClick={(event) => onSelectStep(firstIncomplete, event)}
            >
              {COPY.review.goToMissing(getSectionLabel(saved.type, firstIncomplete))}
            </AppLink>
          ) : null}
        </Notice>
      ) : null}
      <AnswerSummary sections={sections} onEdit={(section, event) => onSelectStep(section.id, event)} />
    </SectionPanel>
  );
}
