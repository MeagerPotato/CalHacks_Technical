import { Check, Circle, CircleAlert, CircleDot, type LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { joinDescribedBy } from "@/components/ui/Field";
import { COPY, LOCKED } from "@/content/copy";
import type { ReadinessItemView, ReadinessState } from "@/lib/view-models/types";

const STATE_ICONS = {
  complete: Check,
  in_progress: CircleDot,
  not_started: Circle,
} as const satisfies Record<ReadinessState, LucideIcon>;

const STATE_TONES = {
  complete: "success",
  in_progress: "highlight",
  not_started: "neutral",
} as const satisfies Record<ReadinessState, BadgeTone>;

// The current section gets a sky fill beside its "Current section" text; a section that needs attention gets a coral
// edge beside its "Needs attention" text (coral is never text).
const ITEM_CLASSES =
  "flex flex-col gap-2 rounded-card border-2 border-border bg-surface p-4 text-ink " +
  "data-[current=true]:bg-accent data-[needs-attention=true]:border-l-8 " +
  "data-[needs-attention=true]:border-l-danger-edge";

// A class map rather than a data-state variant: Tailwind reads the underscore in an arbitrary value such as
// in_progress as a space, so that variant would never match the attribute.
const PROGRESS_LINE_FILLS = {
  complete: "bg-success",
  in_progress: "bg-highlight",
  not_started: "bg-page",
} as const satisfies Record<ReadinessState, string>;

export interface LaunchReadinessProps {
  items: readonly ReadinessItemView[];
  /** 2 on the portal dashboard; 3 inside the editor's review step. */
  headingLevel?: 2 | 3;
  /** Id of the heading that labels the section. Also prefixes the item description ids, so pass a unique one. */
  headingId?: string;
  /** Lets the editor handle the jump in place; the href is the fallback. Attached only when provided. */
  onSelect?: (item: ReadinessItemView, event: MouseEvent<HTMLAnchorElement>) => void;
}

function flag(value: boolean): "true" | "false" {
  return value ? "true" : "false";
}

/**
 * The Launch Readiness checklist: one item per application section, with its state, required-answer progress, and a
 * jump link. The link text is the section name; the state, progress, and needs-attention text describe the link. The
 * current section is marked with visible text as well as `aria-current="step"` on its link, never by color alone.
 */
export function LaunchReadiness({
  items,
  headingLevel = 2,
  headingId = "launch-readiness-title",
  onSelect,
}: LaunchReadinessProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <section data-testid="launch-readiness" aria-labelledby={headingId} className="workshop-readiness flex flex-col gap-4">
      <Heading id={headingId} className={headingLevel === 3 ? "text-xl font-bold" : "text-2xl font-bold"}>
        {LOCKED.editor.launchReadiness}
      </Heading>
      {/* role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none. */}
      <ol role="list" className="flex flex-col gap-3">
        {items.map((item) => {
          const idBase = `${headingId}-${item.id}`;
          const stateId = `${idBase}-state`;
          const progressId = `${idBase}-progress`;
          const attentionId = item.needsAttention ? `${idBase}-attention` : undefined;

          return (
            <li
              key={item.id}
              data-testid={`readiness-item-${item.id}`}
              data-state={item.state}
              data-current={flag(item.isCurrent)}
              data-just-completed={flag(item.justCompleted)}
              data-needs-attention={flag(item.needsAttention)}
              className={ITEM_CLASSES}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <AppLink
                  href={item.href}
                  variant="quiet"
                  aria-current={item.isCurrent ? "step" : undefined}
                  aria-describedby={joinDescribedBy(stateId, progressId, attentionId)}
                  onClick={onSelect ? (event) => onSelect(item, event) : undefined}
                >
                  {item.label}
                </AppLink>
                <span id={stateId}>
                  <Badge tone={STATE_TONES[item.state]} icon={STATE_ICONS[item.state]}>
                    {item.stateLabel}
                  </Badge>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span id={progressId}>{item.progressText}</span>
                {/* Sighted users need text, not only the sky fill; aria-current already announces it on the link. */}
                {item.isCurrent ? <span className="font-semibold">{COPY.readiness.current}</span> : null}
                {attentionId ? (
                  <span id={attentionId} className="inline-flex items-center gap-1.5 font-semibold">
                    <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                    {COPY.readiness.needsAttention}
                  </span>
                ) : null}
              </div>
              {/* Decorative progress line; it draws in once when the section has just been completed. */}
              <span
                aria-hidden="true"
                data-progress-line=""
                className={`block h-1.5 w-full rounded-full ${PROGRESS_LINE_FILLS[item.state]}`}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
