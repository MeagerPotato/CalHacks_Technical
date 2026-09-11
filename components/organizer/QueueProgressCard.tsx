import { Card } from "@/components/ui/Card";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import type { QueueProgressView } from "@/lib/view-models/organizer-types";

export interface QueueProgressCardProps {
  title: string;
  progress: QueueProgressView;
  /** Shown when nothing needs review. */
  emptyText: string | null;
}

/** Review queue progress: a labelled progress bar of reviewed applications and the count still needing review. */
export function QueueProgressCard({ title, progress, emptyText }: QueueProgressCardProps) {
  return (
    <Card labelledBy="queue-title" data-testid="queue-progress-card" tone="accent">
      <div className="flex flex-col gap-4">
        <h2 id="queue-title" className="text-xl font-bold">
          {title}
        </h2>
        <ProgressMeter
          id="queue-progress"
          value={progress.percent}
          label={progress.label}
          valueText={progress.valueText}
        />
        <p data-testid="queue-remaining">{progress.remainingText}</p>
        {emptyText ? <p>{emptyText}</p> : null}
      </div>
    </Card>
  );
}
