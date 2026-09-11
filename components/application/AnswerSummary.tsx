import { CircleAlert } from "lucide-react";
import type { MouseEvent } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { COPY } from "@/content/copy";
import type { AnswerSectionView, AnswerView } from "@/lib/view-models/types";

export interface AnswerSummaryProps {
  sections: readonly AnswerSectionView[];
  /** Section heading level: 3 (default) under the review step's `h2`, 2 directly under a page `h1`. */
  headingLevel?: 2 | 3;
  /**
   * Lets the container save and switch steps without a page load. The edit href is the no-JavaScript fallback, and
   * the container ignores modified clicks.
   */
  onEdit?: (section: AnswerSectionView, event: MouseEvent<HTMLAnchorElement>) => void;
}

function AnswerValue({ answer }: { answer: AnswerView }) {
  const { value } = answer;

  if (value === null || (Array.isArray(value) && value.length === 0)) {
    return answer.missingText ? <p className="italic">{answer.missingText}</p> : null;
  }

  if (Array.isArray(value)) {
    // Submitted links stay plain text: an applicant's review screen must never send them to an unchecked URL.
    // role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none.
    return (
      <ul role="list" className="flex flex-col gap-1">
        {value.map((item, index) => (
          <li key={`${index}-${item}`} className="wrap-anywhere">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  return <p className="whitespace-pre-line wrap-break-word">{value}</p>;
}

// Errors are ink text with a coral edge and an icon; coral is never used for text.
function AnswerError({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 border-l-4 border-danger-edge pl-3 font-semibold text-ink">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>
        <VisuallyHidden>{`${COPY.common.errorPrefix} `}</VisuallyHidden>
        {message}
      </span>
    </p>
  );
}

/**
 * Every answer grouped by section, as `dl` lists of `dt` labels and `dd` values, with missing-answer text, inline
 * errors, and an edit link per section while the application is editable. It renders no form controls.
 */
export function AnswerSummary({ sections, headingLevel = 3, onEdit }: AnswerSummaryProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <div data-testid="answer-summary" className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.id} className="rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <Heading className="text-xl font-bold">{section.label}</Heading>
            {section.editHref && section.editLabel ? (
              <AppLink href={section.editHref} onClick={onEdit ? (event) => onEdit(section, event) : undefined}>
                {section.editLabel}
              </AppLink>
            ) : null}
          </div>
          {section.answers.length > 0 ? (
            <dl className="mt-4 flex flex-col gap-4">
              {section.answers.map((answer) => (
                <div key={answer.key} className="flex flex-col gap-1">
                  <dt className="font-semibold">{answer.label}</dt>
                  <dd className="flex flex-col gap-2">
                    <AnswerValue answer={answer} />
                    {answer.errors
                      .filter((message) => message.length > 0)
                      .map((message, index) => (
                        <AnswerError key={`${index}-${message}`} message={message} />
                      ))}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ))}
    </div>
  );
}
