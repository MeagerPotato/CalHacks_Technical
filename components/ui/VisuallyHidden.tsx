import type { ReactNode } from "react";

export interface VisuallyHiddenProps {
  children: ReactNode;
  /** Use "div" when the hidden content contains block elements. */
  as?: "span" | "div";
}

/** Content for assistive technology only. Uses the clip pattern (`sr-only`), never `display: none`. */
export function VisuallyHidden({ children, as: Element = "span" }: VisuallyHiddenProps) {
  return <Element className="sr-only">{children}</Element>;
}
