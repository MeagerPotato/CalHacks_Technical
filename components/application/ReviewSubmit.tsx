import { Info } from "lucide-react";

import { Button } from "@/components/ui/Button";

export interface ReviewSubmitProps {
  /** Id of the note paragraph; the submit button is described by it (`review-irreversible` on the review step). */
  noteId: string;
  /** The irreversible-submission note. */
  note: string;
  submitLabel: string;
  /** Submission in progress: the button keeps focus and its label but ignores clicks. */
  pending: boolean;
  onSubmit?: () => void;
}

/** The final review action: the irreversible-submission note and the primary submit button it describes. */
export function ReviewSubmit({ noteId, note, submitLabel, pending, onSubmit }: ReviewSubmitProps) {
  return (
    <div data-testid="review-submit" className="flex flex-col items-start gap-4">
      <p id={noteId} className="flex items-start gap-2 font-semibold">
        <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        {note}
      </p>
      <Button
        variant="primary"
        aria-describedby={noteId}
        pending={pending}
        onClick={onSubmit ? () => onSubmit() : undefined}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
