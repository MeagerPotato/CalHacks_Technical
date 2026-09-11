import { Sticker } from "@/components/art/Sticker";
import { Timestamp } from "@/components/ui/Timestamp";
import type { CountdownReadingView, CountdownsView } from "@/lib/view-models/types";

export interface CountdownPanelProps {
  view: CountdownsView;
  /** Each countdown's reading at the moment shown, matched to `view.timers` by id. */
  readings: readonly CountdownReadingView[];
  /** Id of the heading that labels the panel. Pass a unique one when a page shows more than one panel. */
  headingId?: string;
}

/**
 * The countdowns: time to launch (the application deadline) and time to landing (the first day of the event). The
 * digits change every second, so they are hidden from assistive technology, which reads a summary to the minute
 * instead.
 */
export function CountdownPanel({ view, readings, headingId = "countdowns-title" }: CountdownPanelProps) {
  return (
    <section
      data-testid="countdowns"
      data-surface="dark"
      aria-labelledby={headingId}
      className="relative flex flex-col gap-5 overflow-hidden rounded-card border-2 border-border bg-dark p-5 text-on-dark shadow-card sm:p-6"
    >
      <span aria-hidden="true" className="absolute -top-10 -right-10 size-32 rounded-full border-2 border-accent opacity-30" />
      <span aria-hidden="true" className="absolute top-12 right-20 hidden size-2 rounded-full bg-highlight sm:block" />
      <div className="relative flex items-center gap-3">
        <Sticker name="antenna" />
        <div className="flex flex-col gap-0.5">
          <span aria-hidden="true" className="font-mono text-xs font-semibold tracking-[0.3em] text-on-dark">•••</span>
          <h2 id={headingId} className="text-2xl font-bold sm:text-3xl">
            {view.title}
          </h2>
        </div>
      </div>
      {/* role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none. */}
      <ul role="list" className="relative grid gap-4 sm:grid-cols-2">
        {view.timers.map((timer) => {
          const reading = readings.find((candidate) => candidate.id === timer.id);
          return (
            <li
              key={timer.id}
              data-testid={`countdown-${timer.id}`}
              data-state={reading?.state}
              className="flex flex-col gap-3 rounded-card border-2 border-accent bg-dark p-4 text-on-dark data-[state=complete]:border-highlight"
            >
              <h3 className="text-xl font-bold">{timer.title}</h3>
              <p className="text-sm text-on-dark">
                <Timestamp value={timer.target} prefix={timer.caption} fallback="" />
              </p>
              {reading?.state === "counting" ? (
                <>
                  <p aria-hidden="true" data-countdown-digits="" className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {reading.units.map((unit) => (
                      <span
                        key={unit.unit}
                        data-unit={unit.unit}
                        className="flex min-w-0 flex-col items-center rounded-control border-2 border-accent bg-page px-1 py-2 text-ink shadow-[inset_0_-2px_0_rgb(20_35_59/0.12)]"
                      >
                        <span data-countdown-value="" className="text-3xl font-extrabold tabular-nums">
                          {unit.value}
                        </span>
                        <span className="text-[0.62rem] font-bold tracking-wide uppercase sm:text-xs">{unit.label}</span>
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
