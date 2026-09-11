import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";

const FRAME_CLASSES = "mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-16";

// Standalone states own the page's single main#main landmark; nested states (inside a layout's main) render a div.
function StateFrame({ standalone, children }: { standalone: boolean; children: ReactNode }) {
  if (standalone) {
    return (
      <main id="main" tabIndex={-1} className={FRAME_CLASSES}>
        {children}
      </main>
    );
  }
  return <div className={FRAME_CLASSES}>{children}</div>;
}

export interface PageLoadingProps {
  label: string;
  /** Default true renders `main#main`. Pass false inside a layout that already renders main. */
  standalone?: boolean;
}

/** Route loading state, announced through role="status". */
export function PageLoading({ label, standalone = true }: PageLoadingProps) {
  return (
    <StateFrame standalone={standalone}>
      <div role="status" className="flex items-center gap-3">
        <LoaderCircle aria-hidden="true" className="size-6 shrink-0 motion-safe:animate-spin" />
        <span>{label}</span>
      </div>
    </StateFrame>
  );
}

export interface PageErrorProps {
  title: string;
  message: string;
  retryLabel: string;
  /** The retry button renders only when this is provided. */
  onRetry?: () => void;
  standalone?: boolean;
}

/** Route error state with an `h1` and an optional retry button. */
export function PageError({ title, message, retryLabel, onRetry, standalone = true }: PageErrorProps) {
  return (
    <StateFrame standalone={standalone}>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p>{message}</p>
      {onRetry ? <Button onClick={() => onRetry()}>{retryLabel}</Button> : null}
    </StateFrame>
  );
}

export interface PageNotFoundProps {
  title: string;
  message: string;
  homeHref: string;
  homeLabel: string;
  standalone?: boolean;
}

/** Not-found state with an `h1` and a link home. */
export function PageNotFound({ title, message, homeHref, homeLabel, standalone = true }: PageNotFoundProps) {
  return (
    <StateFrame standalone={standalone}>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p>{message}</p>
      <AppLink href={homeHref} variant="primary">
        {homeLabel}
      </AppLink>
    </StateFrame>
  );
}
