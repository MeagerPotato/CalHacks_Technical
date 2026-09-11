"use client";

import { PageError } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";

/** Root error boundary for pages outside the portal. `retry` re-fetches and re-renders the failed segment. */
export default function RootError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageError
      title={COPY.pages.error.title}
      message={COPY.pages.error.body}
      retryLabel={COPY.pages.error.retry}
      onRetry={retry}
    />
  );
}
