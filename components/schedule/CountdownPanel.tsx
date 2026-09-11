import { Pause } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Timestamp } from "@/components/ui/Timestamp";
import type { CountdownReadingView, CountdownsView } from "@/lib/view-models/types";

export interface CountdownPanelProps {
  view: CountdownsView;
  /** Each countdown's reading at the moment shown, matched to `view.timers` by id. */
  readings: readonly CountdownReadingView[];
  /** Whether the viewer paused the countdowns; the toggle reports it with `aria-pressed`. */
  paused: boolean;
  /** Attached only when provided. */
  onTogglePause?: () => void;
  /** Id of the heading that labels the panel. Pass a unique one when a page shows more than one panel. */
  headingId?: string;
}

/**
 * The countdowns: time to launch (the application deadline) and time to landing (the first day of the event). The
 * digits change every second, so they are hidden from assistive technology, which reads a summary to the minute
 * instead. The pause toggle freezes both readings, because content that updates on its own for more than five
 * seconds must be pausable (WCAG 2.2.2).
 */
export function CountdownPanel({
  view,
  readings,
  paused,
  onTogglePause,
  headingId = "countdowns-title",
}: CountdownPanelProps) {
  return (
    <section
      data-testid="countdowns"
      data-paused={paused ? "true" : "false"}
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-card border-2 border-border bg-surface p-5 text-ink shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-2xl font-bold">
          {view.title}
        </h2>
        <Button variant="secondary" aria-pressed={paused} onClick={onTogglePause} className="aria-pressed:bg-accent">
          <Pause aria-hidden="true" className="size-4 shrink-0" />
          {view.pauseLabel}
        </Button>
      </div>
      {/* role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none. */}
      <ul role="list" className="grid gap-6 sm:grid-cols-2">
        {view.timers.map((timer) => {
          const reading = readings.find((candidate) => candidate.id === timer.id);
          return (
            <li
              key={timer.id}
              data-testid={`countdown-${timer.id}`}
              data-state={reading?.state}
              className="flex flex-col gap-2"
            >
              <h3 className="text-xl font-bold">{timer.title}</h3>
              <p className="text-sm">
                <Timestamp value={timer.target} prefix={timer.caption} fallback="" />
              </p>
              {reading?.state === "counting" ? (
                <>
                  <p aria-hidden="true" data-countdown-digits="" className="flex flex-wrap gap-2">
                    {reading.units.map((unit) => (
                      <span
                        key={unit.unit}
                        data-unit={unit.unit}
                        className="flex min-w-16 flex-col items-center rounded-control border-2 border-border bg-page px-2 py-1"
                      >
                        <span data-countdown-value="" className="text-3xl font-extrabold tabular-nums">
                          {unit.value}
                        </span>
                        <span className="text-xs font-semibold uppercase">{unit.label}</span>
                      </span>
                    ))}
                  </p>
                  <p data-countdown-summary="" className="sr-only">
                    {reading.summary}
                  </p>
                </>
              ) : null}
              {reading?.state === "complete" ? (
                <p data-countdown-summary="" className="text-lg font-semibold">
                  {reading.summary}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
