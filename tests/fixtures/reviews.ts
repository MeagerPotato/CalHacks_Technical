/** A complete Hacker review: every rubric dimension scored, with notes and a recommendation. */
export const completeHackerRubric = {
  scores: { motivation: 4, initiative: 5, growth: 3, community: 4 },
  notes: "Strong fit.",
  recommendation: "strong_yes",
} as const;

/** A complete Judge review: every rubric dimension scored, with a recommendation. */
export const completeJudgeRubric = {
  scores: { expertise: 5, evaluation: 4, motivation: 4, availability: 3 },
  recommendation: "yes",
} as const;
