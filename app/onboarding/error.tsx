"use client";

import { PageError } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";

/** Data-access failures while loading onboarding. `retry` re-fetches the segment. */
export default function OnboardingError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PageError
      title={COPY.pages.error.title}
      message={COPY.pages.error.body}
      retryLabel={COPY.pages.error.retry}
      onRetry={retry}
    />
  );
}
