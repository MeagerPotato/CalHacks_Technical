import type { TimestampView } from "@/lib/view-models/types";

export interface TimestampProps {
  /** Server-formatted instant, or null when there is nothing to show. */
  value: TimestampView | null;
  /** Text before the time, for example "Last saved". */
  prefix?: string;
  /** Shown when `value` is null, for example "Not saved yet". */
  fallback: string;
}

/** A `time[dateTime]` element with its server-formatted label (the client never formats dates). */
export function Timestamp({ value, prefix, fallback }: TimestampProps) {
  if (!value) {
    return <span>{fallback}</span>;
  }

  return (
    <span>
      {prefix ? `${prefix} ` : null}
      <time dateTime={value.iso}>{value.label}</time>
    </span>
  );
}
