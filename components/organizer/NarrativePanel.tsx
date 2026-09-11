import { AnswerSummary } from "@/components/application/AnswerSummary";
import type { AnswerSectionView } from "@/lib/view-models/types";

export interface NarrativePanelProps {
  title: string;
  /** Read-only answer sections without identifying fields. */
  sections: readonly AnswerSectionView[];
}

/** The application narrative: a named region with an `h2` and the generic `AnswerSummary` (section `h3` headings). */
export function NarrativePanel({ title, sections }: NarrativePanelProps) {
  return (
    <section aria-labelledby="narrative-title" data-testid="narrative-panel" className="flex flex-col gap-5">
      <h2 id="narrative-title" className="w-fit border-b-4 border-highlight pb-1 text-3xl font-bold">
        {title}
      </h2>
      <AnswerSummary sections={sections} headingLevel={3} />
    </section>
  );
}
