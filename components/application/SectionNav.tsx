import { Check, Circle, CircleAlert, CircleDot, Rocket, type LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { COPY } from "@/content/copy";
import type { SectionNavItemView } from "@/lib/view-models/types";

/** Step icons, shown for every step. They are decorative: the state is always in the link text as well. */
const STATE_ICONS = {
  complete: Check,
  in_progress: CircleDot,
  not_started: Circle,
  review: Rocket,
} as const satisfies Record<SectionNavItemView["state"], LucideIcon>;

export interface SectionNavProps {
  /** Accessible name of the navigation landmark. */
  label: string;
  items: readonly SectionNavItemView[];
  /**
   * Lets the container save and switch steps without a page load. The item href is the no-JavaScript fallback, and
   * the container ignores modified clicks so open-in-new-tab keeps working.
   */
  onSelect?: (item: SectionNavItemView, event: MouseEvent<HTMLAnchorElement>) => void;
}

/** Section navigation for wide screens: an ordered list of steps with their state, marking the active step. */
export function SectionNav({ label, items, onSelect }: SectionNavProps) {
  return (
    <nav aria-label={label} data-testid="section-nav">
      <ol className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = STATE_ICONS[item.state];
          return (
            <li
              key={item.step}
              data-state={item.state}
              data-needs-attention={item.needsAttention ? "true" : "false"}
              data-just-completed={item.justCompleted ? "true" : "false"}
              className={
                item.isActive
                  ? "rounded-control border-2 border-border bg-accent px-3"
                  : "rounded-control border-2 border-transparent px-3"
              }
            >
              <AppLink
                href={item.href}
                variant="quiet"
                aria-current={item.isActive ? "step" : undefined}
                onClick={onSelect ? (event) => onSelect(item, event) : undefined}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                {/* The spaces keep the link's accessible name readable when the parts stack as flex items. */}
                <span className="flex min-w-0 flex-col py-1">
                  <span>{item.label}</span>{" "}
                  <span className="text-sm font-normal">{item.stateLabel}</span>
                  {item.needsAttention ? (
                    <>
                      {" "}
                      {/* The attention icon sits beside its text, so the state icon still shows the step's state. */}
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                        {COPY.readiness.needsAttention}
                      </span>
                    </>
                  ) : null}
                </span>
              </AppLink>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
