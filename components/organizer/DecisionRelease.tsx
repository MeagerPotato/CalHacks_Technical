import type { Ref } from "react";

import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldGroup } from "@/components/ui/Field";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Timestamp } from "@/components/ui/Timestamp";
import type { DecisionStatus } from "@/lib/domain/enums";
import type { DecisionReleaseView } from "@/lib/view-models/organizer-types";

/** `choose` shows the decision radios; `confirm` asks before releasing the chosen decision. */
export type DecisionReleaseStep = "choose" | "confirm";

export interface DecisionReleaseProps {
  view: DecisionReleaseView;
  step?: DecisionReleaseStep;
  /** The chosen decision ("" for none). */
  choice?: string;
  error?: string | null;
  /** Marks Confirm release pending while the decision is released. */
  pending?: boolean;
  /** The `h2`, focusable with `tabIndex={-1}`, for focus after a release. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** The confirmation group, focusable with `tabIndex={-1}`. */
  confirmRef?: Ref<HTMLDivElement>;
  /** Release decision, which regains focus when the confirmation is cancelled. */
  releaseRef?: Ref<HTMLButtonElement>;
  onChoiceChange?: (value: string) => void;
  onRelease?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

function isDecisionChoice(view: DecisionReleaseView, choice: string): choice is DecisionStatus {
  return view.options.some((option) => option.value === choice);
}

/**
 * Official decision release, separate from the review: `section[data-testid=decision-release]` named by
 * `h2#decision-release-title`, with `data-state` (`available`, `unavailable`, `released`) and, while available,
 * `data-step` (`choose`, `confirm`).
 *
 * - available/choose: radios for Accepted and Waitlisted (`#decision-choice` first) and Release decision.
 * - available/confirm: `div[role=group]#decision-confirm` with the confirmation title and body, Confirm release, and
 *   Cancel.
 * - unavailable: why a decision cannot be released yet. released: the released decision and its time.
 */
export function DecisionRelease({
  view,
  step = "choose",
  choice = "",
  error = null,
  pending = false,
  headingRef,
  confirmRef,
  releaseRef,
  onChoiceChange,
  onRelease,
  onConfirm,
  onCancel,
}: DecisionReleaseProps) {
  const confirming = view.state === "available" && step === "confirm" && isDecisionChoice(view, choice);

  return (
    <section
      aria-labelledby="decision-release-title"
      data-testid="decision-release"
      data-state={view.state}
      data-step={view.state === "available" ? (confirming ? "confirm" : "choose") : undefined}
      className="flex flex-col gap-4 rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card"
    >
      <h2 id="decision-release-title" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
        {view.title}
      </h2>
      {view.state === "released" && view.released ? (
        <div data-testid="decision-released" data-decision={view.released.status} className="flex flex-col items-start gap-2">
          <StatusBadge
            status={view.released.status}
            label={view.options.find((option) => option.value === view.released?.status)?.label ?? view.released.status}
          />
          <p className="font-semibold">{view.released.text}</p>
          {view.released.time ? (
            <p className="text-sm">
              <Timestamp value={view.released.time} prefix={view.released.timePrefix} fallback="" />
            </p>
          ) : null}
        </div>
      ) : null}
      {view.state === "unavailable" ? (
        <>
          <p>{view.intro}</p>
          <p data-testid="decision-unavailable" className="font-semibold">
            {view.unavailableText}
          </p>
        </>
      ) : null}
      {view.state === "available" && !confirming ? (
        <>
          <p>{view.intro}</p>
          <FieldGroup id="decision-choice" legend={view.legend} errors={error ? [error] : []}>
            <RadioGroup
              idPrefix="decision-choice"
              name="decision"
              options={view.options}
              value={choice}
              onValueChange={onChoiceChange}
              invalid={Boolean(error)}
            />
          </FieldGroup>
          <div>
            <Button
              ref={releaseRef}
              variant="secondary"
              onClick={onRelease ? () => onRelease() : undefined}
              data-testid="release-decision"
            >
              {view.releaseLabel}
            </Button>
          </div>
        </>
      ) : null}
      {confirming ? (
        <div
          id="decision-confirm"
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-labelledby="decision-confirm-title"
          aria-describedby="decision-confirm-body"
          data-testid="decision-confirm"
          data-decision={choice}
          className="flex flex-col gap-3 rounded-control border-2 border-l-8 border-border bg-highlight p-4 text-ink"
        >
          <p id="decision-confirm-title" className="font-semibold">
            {view.confirmTitles[choice]}
          </p>
          <p id="decision-confirm-body">{view.confirmBody}</p>
          <div className="flex flex-wrap gap-3">
            <Button pending={pending} onClick={onConfirm ? () => onConfirm() : undefined} data-testid="confirm-decision">
              {view.confirmLabel}
            </Button>
            <Button variant="secondary" onClick={onCancel ? () => onCancel() : undefined} data-testid="cancel-decision">
              {view.cancelLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
