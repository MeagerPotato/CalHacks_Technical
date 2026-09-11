import { z } from "zod";

import { RECOMMENDATIONS, type ApplicationType } from "@/lib/domain/enums";

// =============================================================================
// Organizer review contracts.
//
// - Draft schemas accept partial input: omitted fields keep saved values and a null
//   score clears that score (merge semantics in saveReview).
// - Submission schemas require every rubric dimension and a recommendation.
// - The database recomputes overall_score and validates dimensions independently
//   (private.guard_review_write); RUBRIC_DIMENSIONS mirrors private.rubric_dimensions.
// =============================================================================

export const RUBRIC_DIMENSIONS = {
  hacker: ["motivation", "initiative", "growth", "community"],
  judge: ["expertise", "evaluation", "motivation", "availability"],
} as const satisfies Record<ApplicationType, readonly string[]>;

export type HackerRubricDimension = (typeof RUBRIC_DIMENSIONS.hacker)[number];
export type JudgeRubricDimension = (typeof RUBRIC_DIMENSIONS.judge)[number];
export type RubricDimension<T extends ApplicationType = ApplicationType> = (typeof RUBRIC_DIMENSIONS)[T][number];

export const RUBRIC_SCORE_RANGE = { min: 1, max: 5 } as const;
export const REVIEW_NOTES_MAX_LENGTH = 5000;

const SCORE_MESSAGE = "Scores must be whole numbers from 1 to 5.";

const rubricScore = z
  .int({ error: (issue) => (issue.input === undefined ? "Score every rubric dimension." : SCORE_MESSAGE) })
  .min(RUBRIC_SCORE_RANGE.min, { error: SCORE_MESSAGE })
  .max(RUBRIC_SCORE_RANGE.max, { error: SCORE_MESSAGE });

const draftRubricScore = z
  .int({ error: SCORE_MESSAGE })
  .min(RUBRIC_SCORE_RANGE.min, { error: SCORE_MESSAGE })
  .max(RUBRIC_SCORE_RANGE.max, { error: SCORE_MESSAGE })
  .nullish();

/** Optional in both modes: omitted notes keep the saved value. */
const reviewNotes = z
  .string({ error: "Notes must be text." })
  .max(REVIEW_NOTES_MAX_LENGTH, { error: `Use ${REVIEW_NOTES_MAX_LENGTH} characters or fewer.` })
  .optional();

const draftRecommendation = z.enum(RECOMMENDATIONS, { error: "Choose a listed recommendation." }).nullish();

const requiredRecommendation = z.enum(RECOMMENDATIONS, {
  error: (issue) => (issue.input === undefined || issue.input === null ? "Choose a recommendation." : "Choose a listed recommendation."),
});

const SCORES_OBJECT_MESSAGE = "Scores must be keyed by rubric dimension.";

export const hackerReviewDraftSchema = z.object({
  scores: z
    .strictObject(
      {
        motivation: draftRubricScore,
        initiative: draftRubricScore,
        growth: draftRubricScore,
        community: draftRubricScore,
      },
      { error: SCORES_OBJECT_MESSAGE },
    )
    .optional(),
  notes: reviewNotes,
  recommendation: draftRecommendation,
});

export const judgeReviewDraftSchema = z.object({
  scores: z
    .strictObject(
      {
        expertise: draftRubricScore,
        evaluation: draftRubricScore,
        motivation: draftRubricScore,
        availability: draftRubricScore,
      },
      { error: SCORES_OBJECT_MESSAGE },
    )
    .optional(),
  notes: reviewNotes,
  recommendation: draftRecommendation,
});

export const hackerReviewSubmissionSchema = z.object({
  scores: z.strictObject(
    {
      motivation: rubricScore,
      initiative: rubricScore,
      growth: rubricScore,
      community: rubricScore,
    },
    { error: (issue) => (issue.input === undefined ? "Score every rubric dimension." : SCORES_OBJECT_MESSAGE) },
  ),
  notes: reviewNotes,
  recommendation: requiredRecommendation,
});

export const judgeReviewSubmissionSchema = z.object({
  scores: z.strictObject(
    {
      expertise: rubricScore,
      evaluation: rubricScore,
      motivation: rubricScore,
      availability: rubricScore,
    },
    { error: (issue) => (issue.input === undefined ? "Score every rubric dimension." : SCORES_OBJECT_MESSAGE) },
  ),
  notes: reviewNotes,
  recommendation: requiredRecommendation,
});

export const REVIEW_SCHEMAS = {
  hacker: { draft: hackerReviewDraftSchema, submission: hackerReviewSubmissionSchema },
  judge: { draft: judgeReviewDraftSchema, submission: judgeReviewSubmissionSchema },
} as const;

/** Payload accepted by saveReview (partial). */
export type ReviewDraftInput = z.input<typeof hackerReviewDraftSchema> | z.input<typeof judgeReviewDraftSchema>;
/** Payload accepted by submitReview (complete). */
export type ReviewSubmissionInput =
  | z.input<typeof hackerReviewSubmissionSchema>
  | z.input<typeof judgeReviewSubmissionSchema>;

export type ReviewDraft = z.output<typeof hackerReviewDraftSchema> | z.output<typeof judgeReviewDraftSchema>;
export type ReviewSubmission =
  | z.output<typeof hackerReviewSubmissionSchema>
  | z.output<typeof judgeReviewSubmissionSchema>;

/** Removes null/undefined scores so only scored dimensions are stored. */
export function compactRubricScores(scores: Record<string, number | null | undefined>): Record<string, number> {
  const compact: Record<string, number> = {};
  for (const [dimension, score] of Object.entries(scores)) {
    if (typeof score === "number") {
      compact[dimension] = score;
    }
  }
  return compact;
}

/**
 * Average of all rubric dimensions rounded to two decimals, or null until every
 * dimension has a valid score. Matches the database calculation.
 */
export function calculateOverallScore(type: ApplicationType, scores: unknown): number | null {
  if (typeof scores !== "object" || scores === null) {
    return null;
  }

  const values: number[] = [];
  for (const dimension of RUBRIC_DIMENSIONS[type]) {
    const score = (scores as Record<string, unknown>)[dimension];
    if (
      typeof score !== "number" ||
      !Number.isInteger(score) ||
      score < RUBRIC_SCORE_RANGE.min ||
      score > RUBRIC_SCORE_RANGE.max
    ) {
      return null;
    }
    values.push(score);
  }

  const average = values.reduce((sum, score) => sum + score, 0) / values.length;
  return Math.round(average * 100) / 100;
}
