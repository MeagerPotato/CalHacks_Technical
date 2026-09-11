"use client";

import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { Button } from "@/components/ui/Button";
import { LOCKED } from "@/content/copy";

interface PendingExampleProps {
  example: "button" | "review-submit";
}

/**
 * Development gallery only. A pending button attaches a click handler that blocks activation, and a Server Component
 * cannot pass functions to rendered elements, so pending examples render from this client module.
 */
export function PendingExample({ example }: PendingExampleProps) {
  if (example === "button") {
    return (
      <Button variant="primary" pending>
        {LOCKED.review.submit}
      </Button>
    );
  }
  return (
    <ReviewSubmit
      noteId="gallery-review-note-pending"
      note={LOCKED.review.irreversible}
      submitLabel={LOCKED.review.submit}
      pending
    />
  );
}
