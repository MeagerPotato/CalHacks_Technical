"use client";

import { PageError } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";

/** Portal data-access failures. Rendered inside PortalShell, which already provides main#main. */
export default function PortalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
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
