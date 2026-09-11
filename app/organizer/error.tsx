"use client";

import { PageError } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";

/** Organizer data-access failures. Rendered inside OrganizerShell, which already provides main#main. */
export default function OrganizerError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageError
      title={COPY.pages.error.title}
      message={COPY.pages.error.body}
      retryLabel={COPY.pages.error.retry}
      onRetry={retry}
      standalone={false}
    />
  );
}
