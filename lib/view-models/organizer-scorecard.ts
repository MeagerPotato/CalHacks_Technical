import { ORGANIZER_COPY, ORGANIZER_LOCKED } from "@/content/copy";
import { RUBRIC_FORMS, type RubricDimensionConfig } from "@/lib/application-config";
import type { ReviewRecord } from "@/lib/data/types";
import { RECOMMENDATIONS, type ApplicationType, type Recommendation } from "@/lib/domain/enums";
import type { FieldErrors } from "@/lib/validation/errors";
import { RUBRIC_SCORE_RANGE, calculateOverallScore } from "@/lib/validation/review";
import type { ScorecardErrors, ScorecardValues } from "@/lib/view-models/organizer-types";
import type { SummaryItemView } from "@/lib/view-models/types";

// =============================================================================
// Scorecard form logic for the review workspace (client-safe, pure).
//
// Control ids, form values, action payloads, the live overall score, and the mapping from saveReview/submitReview
// field errors ("scores.<dimension>", "recommendation", "notes") to inline errors and error-summary items.
// =============================================================================

export const REVIEW_NOTES_ID = "review-notes";
export const REVIEW_RECOMMENDATION_ID = "review-recommendation";

/** Id of a rubric dimension's first radio (the one error-summary links focus). */
export function reviewScoreControlId(dimension: string): string {
  return `review-score-${dimension}`;
}

/** Field-error key of a rubric dimension, as returned by the review actions. */
export function scoreErrorKey(dimension: string): string {
  return `scores.${dimension}`;
}

function isValidScore(value: unknown, dimension: RubricDimensionConfig): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= dimension.minScore &&
    value <= dimension.maxScore
  );
}

function isRecommendation(value: unknown): value is Recommendation {
  return typeof value === "string" && (RECOMMENDATIONS as readonly string[]).includes(value);
}

/** Form values for a saved review (or blank values), with every rubric dimension of the type present. */
export function toScorecardValues(
  type: ApplicationType,
  review: Pick<ReviewRecord, "scores" | "notes" | "recommendation"> | null,
): ScorecardValues {
  const scores: Record<string, number | null> = {};
  for (const dimension of RUBRIC_FORMS[type]) {
    const score = review?.scores[dimension.key];
    scores[dimension.key] = isValidScore(score, dimension) ? score : null;
  }
  return {
    scores,
    notes: typeof review?.notes === "string" ? review.notes : "",
    recommendation: isRecommendation(review?.recommendation) ? review.recommendation : "",
  };
}

/** Whether two sets of form values are the same review. A missing score equals an unscored one. */
export function scorecardValuesEqual(first: ScorecardValues, second: ScorecardValues): boolean {
  if (first.notes !== second.notes || first.recommendation !== second.recommendation) {
    return false;
  }
  const keys = new Set([...Object.keys(first.scores), ...Object.keys(second.scores)]);
  for (const key of keys) {
    if ((first.scores[key] ?? null) !== (second.scores[key] ?? null)) {
      return false;
    }
  }
  return true;
}

/** saveReview payload: every dimension of the type (null clears a score), the notes, and the recommendation or null. */
export function toReviewDraftPayload(type: ApplicationType, values: ScorecardValues) {
  const scores: Record<string, number | null> = {};
  for (const dimension of RUBRIC_FORMS[type]) {
    scores[dimension.key] = values.scores[dimension.key] ?? null;
  }
  return { scores, notes: values.notes, recommendation: values.recommendation === "" ? null : values.recommendation };
}

/** submitReview payload: scored dimensions only, so each missing one fails validation with its own message. */
export function toReviewSubmissionPayload(type: ApplicationType, values: ScorecardValues) {
  const scores: Record<string, number> = {};
  for (const dimension of RUBRIC_FORMS[type]) {
    const score = values.scores[dimension.key];
    if (typeof score === "number") {
      scores[dimension.key] = score;
    }
  }
  return { scores, notes: values.notes, recommendation: values.recommendation === "" ? null : values.recommendation };
}

/** The live overall score text ("4.25 out of 5"), or the pending text until every dimension is scored. */
export function overallScoreText(type: ApplicationType, scores: ScorecardValues["scores"]): string {
  const copy = ORGANIZER_COPY.workspace.scorecard;
  const overall = calculateOverallScore(type, scores);
  return overall === null ? copy.overallPending : copy.overallValue(overall.toFixed(2), RUBRIC_SCORE_RANGE.max);
}

/** The notes character counter text. */
export function notesCounterText(notes: string, maxLength: number): string {
  return ORGANIZER_COPY.workspace.scorecard.characterCount(notes.length, maxLength);
}

function ownMessages(fieldErrors: FieldErrors | undefined, key: string): string[] {
  if (!fieldErrors || !Object.prototype.hasOwnProperty.call(fieldErrors, key)) {
    return [];
  }
  const messages: unknown = fieldErrors[key];
  return Array.isArray(messages)
    ? messages.filter((message): message is string => typeof message === "string" && message !== "")
    : [];
}

/** Inline errors for the scorecard controls, the error-summary items in form order, and messages no control shows. */
export interface ReviewErrorState {
  errors: ScorecardErrors;
  summary: SummaryItemView[];
  unplaced: string[];
}

/** A scorecard with no errors. Returns a new object on every call. */
export function emptyScorecardErrors(): ScorecardErrors {
  return { scores: {}, recommendation: [], notes: [] };
}

/**
 * Maps review field errors to the scorecard. A message on `scores` itself (for example a missing scores object)
 * belongs to the first dimension. Summary items follow the form: dimensions, recommendation, then notes; each links to
 * its control with `#<id>`. Keys that match no control are returned as `unplaced`.
 */
export function toReviewErrorState(type: ApplicationType, fieldErrors: FieldErrors | undefined): ReviewErrorState {
  const errors = emptyScorecardErrors();
  const summary: SummaryItemView[] = [];
  const placed = new Set<string>(["scores", "recommendation", "notes"]);

  RUBRIC_FORMS[type].forEach((dimension, index) => {
    const key = scoreErrorKey(dimension.key);
    placed.add(key);
    const messages = [...ownMessages(fieldErrors, key), ...(index === 0 ? ownMessages(fieldErrors, "scores") : [])];
    if (messages.length > 0) {
      errors.scores[dimension.key] = messages;
      summary.push({ key, label: dimension.label, message: messages[0], href: `#${reviewScoreControlId(dimension.key)}` });
    }
  });

  errors.recommendation = ownMessages(fieldErrors, "recommendation");
  if (errors.recommendation.length > 0) {
    summary.push({
      key: "recommendation",
      label: ORGANIZER_LOCKED.workspace.recommendation,
      message: errors.recommendation[0],
      href: `#${REVIEW_RECOMMENDATION_ID}`,
    });
  }

  errors.notes = ownMessages(fieldErrors, "notes");
  if (errors.notes.length > 0) {
    summary.push({
      key: "notes",
      label: ORGANIZER_LOCKED.workspace.notes,
      message: errors.notes[0],
      href: `#${REVIEW_NOTES_ID}`,
    });
  }

  const unplaced = Object.keys(fieldErrors ?? {})
    .filter((key) => !placed.has(key))
    .flatMap((key) => ownMessages(fieldErrors, key));

  return { errors, summary, unplaced };
}
