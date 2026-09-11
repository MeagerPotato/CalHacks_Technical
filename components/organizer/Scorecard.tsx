import type { FormEvent, MouseEvent, Ref } from "react";

import { RubricScoreField } from "@/components/organizer/RubricScoreField";
import { Button } from "@/components/ui/Button";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Field, FieldGroup, type FieldCounter } from "@/components/ui/Field";
import { Form, FormActions } from "@/components/ui/Form";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { TextInput } from "@/components/ui/TextInput";
import { Timestamp } from "@/components/ui/Timestamp";
import type { ScorecardErrors, ScorecardValues, ScorecardView } from "@/lib/view-models/organizer-types";
import type { SummaryItemView } from "@/lib/view-models/types";

/** The scorecard action in flight: Save draft, Save review, or Save review and continue. */
export type ScorecardAction = "draft" | "review" | "continue";

export interface ScorecardProps {
  view: ScorecardView;
  values: ScorecardValues;
  /** Live overall score text, or the pending text until every dimension is scored. */
  overallText: string;
  notesCounter?: FieldCounter | null;
  errors?: ScorecardErrors;
  summaryItems?: readonly SummaryItemView[];
  formErrors?: readonly string[];
  /** The error summary, which the container focuses after a failed save. */
  summaryRef?: Ref<HTMLElement>;
  onSummaryItemActivate?: (item: SummaryItemView, event: MouseEvent<HTMLAnchorElement>) => void;
  pending?: ScorecardAction | null;
  onScoreChange?: (dimension: string, score: number) => void;
  onNotesChange?: (notes: string) => void;
  onRecommendationChange?: (recommendation: string) => void;
  onSaveDraft?: () => void;
  onSaveReview?: () => void;
  /** Also runs when the form is submitted with Enter. */
  onSaveAndContinue?: () => void;
}

const SECTION_CLASSES = "flex flex-col gap-5 rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card";

function ReadOnlyScorecard({ view, values, overallText }: Pick<ScorecardProps, "view" | "values" | "overallText">) {
  const recommendation = view.recommendation.options.find((option) => option.value === values.recommendation);
  return (
    <dl data-testid="scorecard-read-only" className="flex flex-col gap-3">
      {view.dimensions.map((dimension) => {
        const score = values.scores[dimension.key];
        return (
          <div key={dimension.key} data-dimension={dimension.key} className="flex flex-wrap justify-between gap-x-4">
            <dt className="font-semibold">{dimension.label}</dt>
            <dd>{typeof score === "number" ? String(score) : view.readOnly.noScore}</dd>
          </div>
        );
      })}
      <div className="flex flex-wrap justify-between gap-x-4 border-t-2 border-border pt-3">
        <dt className="font-semibold">{view.overall.label}</dt>
        <dd data-testid="overall-score">{overallText}</dd>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4">
        <dt className="font-semibold">{view.recommendation.label}</dt>
        <dd>{recommendation ? recommendation.label : view.readOnly.noRecommendation}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="font-semibold">{view.notes.label}</dt>
        <dd className="whitespace-pre-line wrap-break-word">{values.notes.trim() ? values.notes : view.readOnly.noNotes}</dd>
      </div>
    </dl>
  );
}

/**
 * The review scorecard: `section[data-testid=scorecard]` with `data-access` (`editable`, `owned_by_another_organizer`,
 * `locked`) and `data-completed`, named by `h2#scorecard-title`, with the last-saved line.
 *
 * - Editable: `form#review-form` with the error summary, one `RubricScoreField` per dimension, the live overall score
 *   (`data-testid="overall-score"`, not a live region), the recommendation radios (`#review-recommendation` first),
 *   the notes textarea (`#review-notes`), and the actions. Save draft is hidden once the review is complete.
 * - Otherwise: a read-only description list of the saved review.
 */
export function Scorecard({
  view,
  values,
  overallText,
  notesCounter,
  errors,
  summaryItems = [],
  formErrors = [],
  summaryRef,
  onSummaryItemActivate,
  pending = null,
  onScoreChange,
  onNotesChange,
  onRecommendationChange,
  onSaveDraft,
  onSaveReview,
  onSaveAndContinue,
}: ScorecardProps) {
  const editable = view.access === "editable";
  const handleSubmit = onSaveAndContinue
    ? (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSaveAndContinue();
      }
    : undefined;

  return (
    <section
      aria-labelledby="scorecard-title"
      data-testid="scorecard"
      data-access={view.access}
      data-completed={view.isCompleted ? "true" : "false"}
      className={SECTION_CLASSES}
    >
      <div className="flex flex-col gap-1">
        <h2 id="scorecard-title" className="text-2xl font-bold">
          {view.title}
        </h2>
        <p data-testid="scorecard-saved" className="text-sm">
          <Timestamp value={view.saved?.time ?? null} prefix={view.saved?.prefix} fallback={view.notSavedText} />
        </p>
      </div>
      {editable ? (
        <Form id="review-form" aria-labelledby="scorecard-title" onSubmit={handleSubmit}>
          <ErrorSummary
            ref={summaryRef}
            title={view.errorSummaryTitle}
            items={summaryItems}
            formErrors={formErrors}
            headingId="scorecard-error-summary-title"
            onItemActivate={onSummaryItemActivate}
          />
          <p className="text-sm">{view.hint}</p>
          {view.dimensions.map((dimension) => (
            <RubricScoreField
              key={dimension.key}
              dimension={dimension}
              value={values.scores[dimension.key] ?? null}
              errors={errors?.scores[dimension.key]}
              onValueChange={onScoreChange ? (score) => onScoreChange(dimension.key, score) : undefined}
            />
          ))}
          <div data-testid="overall-score-panel" className="rounded-control border-2 border-border bg-page p-3">
            <p className="font-semibold">{view.overall.label}</p>
            <p data-testid="overall-score" className="text-2xl font-bold">
              {overallText}
            </p>
          </div>
          <FieldGroup
            id={view.recommendation.id}
            legend={view.recommendation.label}
            hint={view.recommendation.hint}
            errors={errors?.recommendation}
          >
            <RadioGroup
              idPrefix={view.recommendation.id}
              name={view.recommendation.name}
              options={view.recommendation.options}
              value={values.recommendation}
              onValueChange={onRecommendationChange}
              invalid={(errors?.recommendation.length ?? 0) > 0}
            />
          </FieldGroup>
          <Field
            id={view.notes.id}
            label={view.notes.label}
            hint={view.notes.hint}
            errors={errors?.notes}
            counter={notesCounter}
          >
            {(control) => (
              <TextInput
                id={control.id}
                name="notes"
                multiline
                rows={6}
                value={values.notes}
                onValueChange={onNotesChange}
                describedBy={control.describedBy}
                invalid={control.invalid}
              />
            )}
          </Field>
          <FormActions>
            <Button
              type={handleSubmit ? "submit" : "button"}
              pending={pending === "continue"}
              data-testid="save-review-and-continue"
            >
              {view.actions.saveAndContinue}
            </Button>
            <Button
              variant="secondary"
              pending={pending === "review"}
              onClick={onSaveReview ? () => onSaveReview() : undefined}
              data-testid="save-review"
            >
              {view.actions.saveReview}
            </Button>
            {view.isCompleted ? null : (
              <Button
                variant="quiet"
                pending={pending === "draft"}
                onClick={onSaveDraft ? () => onSaveDraft() : undefined}
                data-testid="save-draft"
              >
                {view.actions.saveDraft}
              </Button>
            )}
          </FormActions>
        </Form>
      ) : (
        <ReadOnlyScorecard view={view} values={values} overallText={overallText} />
      )}
    </section>
  );
}
