"use client";

import { useState } from "react";

import { CountdownPanel } from "@/components/schedule/CountdownPanel";
import { useNow } from "@/lib/client/use-now";
import { toCountdownReading } from "@/lib/view-models/countdown";
import type { CountdownsView } from "@/lib/view-models/types";

export interface LiveCountdownsProps {
  view: CountdownsView;
}

/**
 * The countdown panel, updated every second. The server render and hydration read the server's clock, then the
 * browser clock takes over. Pausing freezes both readings at the moment of the press and stops the ticks until the
 * viewer resumes.
 */
export function LiveCountdowns({ view }: LiveCountdownsProps) {
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const now = useNow(view.renderedAt, pausedAt === null);
  const shownAt = pausedAt ?? now;

  return (
    <CountdownPanel
      view={view}
      readings={view.timers.map((timer) => toCountdownReading(timer, shownAt))}
      paused={pausedAt !== null}
      onTogglePause={() => setPausedAt((current) => (current === null ? now : null))}
    />
  );
}
