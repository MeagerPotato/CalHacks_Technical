"use client";

import "./globals.css";

import { PageError } from "@/components/ui/PageState";
import { SkipLink } from "@/components/ui/SkipLink";
import { COPY, LOCKED } from "@/content/copy";

import { fontVariables } from "./fonts";

/** Replaces the root layout when it fails, so it renders its own html and body with the global styles. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <title>{`${COPY.pages.error.title} | ${LOCKED.brand}`}</title>
        <SkipLink targetId="main" label={COPY.common.skipToContent} />
        <PageError
          title={COPY.pages.error.title}
          message={COPY.pages.error.body}
          retryLabel={COPY.pages.error.retry}
          onRetry={retry}
        />
      </body>
    </html>
  );
}
