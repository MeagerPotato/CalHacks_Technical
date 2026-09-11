export interface ProgressMeterProps {
  /** Percent complete. Clamped to 0-100 and rounded. */
  value: number;
  label: string;
  /** Visible value text, also used as `aria-valuetext` (for example "40% complete"). */
  valueText: string;
  /** Id of the progress bar; the visible label gets `<id>-label`. Pass a unique id when a page shows two meters. */
  id?: string;
}

function toPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** A labelled progress bar with visible value text. */
export function ProgressMeter({ value, label, valueText, id = "progress-meter" }: ProgressMeterProps) {
  const percent = toPercent(value);
  const labelId = `${id}-label`;

  return (
    <div data-complete={percent === 100 ? "true" : "false"} className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span id={labelId} className="font-semibold">
          {label}
        </span>
        <span className="text-sm">{valueText}</span>
      </div>
      <div
        id={id}
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={valueText}
        className="h-3 w-full overflow-hidden rounded-full border-2 border-border bg-surface"
      >
        <div className="h-full bg-success" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
