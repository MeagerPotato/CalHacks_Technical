import type { ReactNode } from "react";

export type CardTone = "default" | "accent" | "muted";

/** Card fills. Every tone keeps ink text readable (navy on white, sky, or cream). */
export const CARD_TONE_CLASSES = {
  default: "bg-surface",
  accent: "bg-accent",
  muted: "bg-page",
} as const satisfies Record<CardTone, string>;

export interface CardProps {
  /** Id of the card heading. When set, the card is a named `section` region; otherwise a plain `div`. */
  labelledBy?: string;
  tone?: CardTone;
  children: ReactNode;
  "data-testid"?: string;
}

/** A bordered content card. */
export function Card({ labelledBy, tone = "default", children, "data-testid": testId }: CardProps) {
  const className = `workshop-card rounded-card border-2 border-border p-5 sm:p-6 text-ink shadow-card ${CARD_TONE_CLASSES[tone]}`;

  if (labelledBy) {
    return (
      <section aria-labelledby={labelledBy} data-tone={tone} data-testid={testId} className={className}>
        {children}
      </section>
    );
  }

  return (
    <div data-tone={tone} data-testid={testId} className={className}>
      {children}
    </div>
  );
}
