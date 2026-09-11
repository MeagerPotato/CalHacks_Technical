"use client";

import { CountdownPanel } from "@/components/schedule/CountdownPanel";
import { useNow } from "@/lib/client/use-now";
import { toCountdownReading } from "@/lib/view-models/countdown";
import type { CountdownsView } from "@/lib/view-models/types";

export interface LiveCountdownsProps {
  view: CountdownsView;
}

/**
 * The countdown panel, updated every second. The server render and hydration read the server's clock, then the
 * browser clock takes over.
 */
export function LiveCountdowns({ view }: LiveCountdownsProps) {
  const now = useNow(view.renderedAt, true);

  return <CountdownPanel view={view} readings={view.timers.map((timer) => toCountdownReading(timer, now))} />;
}
