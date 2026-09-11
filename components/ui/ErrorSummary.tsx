import { CircleAlert } from "lucide-react";
import type { MouseEvent, Ref } from "react";

import type { SummaryItemView } from "@/lib/view-models/types";

export interface ErrorSummaryProps {
  title: string;
  items: readonly SummaryItemView[];
  /** Form-level messages without a field; rendered as plain list items. */
  formErrors?: readonly string[];
  /** Id of the summary heading that labels the section. Defaults to "error-summary-title". */
  headingId?: string;
  /** Lets the container move focus to the control; the item href is the no-JavaScript fallback. */
  onItemActivate?: (item: SummaryItemView, event: MouseEvent<HTMLAnchorElement>) => void;
  ref?: Ref<HTMLElement>;
}

/**
 * The error summary shown above a form after a failed save or submit. The container focuses it (`tabIndex={-1}`).
 * It is deliberately not a live region, so errors are not announced twice. Renders nothing when there are no errors.
 */
export function ErrorSummary({
  title,
  items,
  formErrors = [],
  headingId = "error-summary-title",
  onItemActivate,
  ref,
}: ErrorSummaryProps) {
  if (items.length === 0 && formErrors.length === 0) {
    return null;
  }

  return (
    <section
      ref={ref}
      data-testid="error-summary"
      tabIndex={-1}
      aria-labelledby={headingId}
      className="rounded-card border-2 border-l-8 border-border border-l-danger-edge bg-surface p-5 text-ink"
    >
      <h2 id={headingId} className="flex items-center gap-2 text-xl font-bold">
        <CircleAlert aria-hidden="true" className="size-6 shrink-0" />
        {title}
      </h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-6">
        {items.map((item) => (
          <li key={item.key}>
            <a
              href={item.href}
              onClick={onItemActivate ? (event) => onItemActivate(item, event) : undefined}
              className="font-semibold underline underline-offset-4"
            >
              {`${item.label}: ${item.message}`}
            </a>
          </li>
        ))}
        {formErrors.map((message, index) => (
          <li key={`${index}-${message}`}>{message}</li>
        ))}
      </ul>
    </section>
  );
}
