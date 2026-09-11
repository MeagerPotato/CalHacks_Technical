import { ORGANIZER_COPY, ORGANIZER_LOCKED } from "@/content/copy";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  RECOMMENDATION_LABELS,
} from "@/lib/application-config";
import type { ApplicationListItem, ReviewQueueProgress } from "@/lib/data/types";
import { toTimestampView } from "@/lib/format/datetime";
import { organizerApplicationRoute } from "@/lib/routes";
import type { ApplicationRowView, QueueProgressView, RowReviewState } from "@/lib/view-models/organizer-types";

// =============================================================================
// Builders shared by the organizer dashboard, applications table, and review workspace.
//
// Only server code may call `toApplicationRowView`: it formats timestamps in the event time zone.
// =============================================================================

const COUNT_FORMAT = new Intl.NumberFormat("en-US");

const REVIEW_STATE_LABELS = {
  complete: ORGANIZER_COPY.rows.reviewStates.complete,
  "in-progress": ORGANIZER_COPY.rows.reviewStates.inProgress,
  none: ORGANIZER_COPY.rows.reviewStates.none,
} as const satisfies Record<RowReviewState, string>;

function presentText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** A whole, non-negative count; anything else counts as zero. */
export function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** A count with thousands separators, for example "1,204". */
export function formatCount(value: unknown): string {
  return COUNT_FORMAT.format(toCount(value));
}

/** An overall score with two decimals ("4.25"), or null when there is no finite score. */
export function formatScore(score: number | null | undefined): string | null {
  return typeof score === "number" && Number.isFinite(score) ? score.toFixed(2) : null;
}

/** A whole percent of `part` in `total`, 0 when the total is 0, never above 100. */
export function toPercent(part: number, total: number): number {
  const whole = toCount(total);
  return whole === 0 ? 0 : Math.min(100, Math.round((toCount(part) / whole) * 100));
}

/** Review queue totals as a progress meter: reviewed of submitted, plus the applications still needing review. */
export function toQueueProgressView(progress: ReviewQueueProgress): QueueProgressView {
  const total = toCount(progress.total);
  const reviewed = toCount(progress.reviewed);
  return {
    label: ORGANIZER_COPY.queue.label,
    percent: toPercent(reviewed, total),
    valueText: ORGANIZER_COPY.queue.value(reviewed, total),
    remainingText: ORGANIZER_COPY.queue.remaining(toCount(progress.remaining)),
  };
}

function toRowReviewState(item: ApplicationListItem): RowReviewState {
  if (item.review === null) {
    return "none";
  }
  return item.review.isCompleted ? "complete" : "in-progress";
}

/**
 * One listed application: its blind reference, name, email, affiliation, type and status labels, submitted time,
 * formatted score (or the not-scored text), review state, and recommendation label. A blank name falls back to the
 * blind reference so every row has link text.
 */
export function toApplicationRowView(item: ApplicationListItem): ApplicationRowView {
  const reviewState = toRowReviewState(item);
  const recommendation = item.review?.recommendation ?? null;
  return {
    id: item.id,
    reference: item.applicantReference,
    referenceLabel: ORGANIZER_LOCKED.workspace.applicant(item.applicantReference),
    href: organizerApplicationRoute(item.id),
    name: presentText(item.applicantName) ?? item.applicantReference,
    email: item.applicantEmail,
    affiliation: presentText(item.affiliation),
    type: item.type,
    typeLabel: APPLICATION_TYPE_LABELS[item.type],
    status: item.status,
    statusLabel: APPLICATION_STATUS_LABELS[item.status],
    submitted: toTimestampView(item.launchedAt),
    submittedFallback: ORGANIZER_COPY.rows.notSubmitted,
    scoreText: formatScore(item.review?.overallScore) ?? ORGANIZER_COPY.rows.notScored,
    reviewState,
    reviewStateLabel: REVIEW_STATE_LABELS[reviewState],
    recommendationLabel: recommendation ? RECOMMENDATION_LABELS[recommendation] : null,
  };
}
