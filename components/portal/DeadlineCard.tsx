import { Clock } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Timestamp } from "@/components/ui/Timestamp";
import { COPY } from "@/content/copy";
import type { TimestampView } from "@/lib/view-models/types";

const TITLE_ID = "deadline-card-title";

export interface DeadlineCardProps {
  /** Null while the deadline is to be announced. */
  deadline: TimestampView | null;
}

/** The application deadline, or "to be announced" until a real deadline is configured. */
export function DeadlineCard({ deadline }: DeadlineCardProps) {
  return (
    <Card labelledBy={TITLE_ID} data-testid="deadline-card">
      <div className="flex flex-col gap-2">
        <h2 id={TITLE_ID} className="flex items-center gap-2 text-xl font-bold">
          <Clock aria-hidden="true" className="size-5 shrink-0" />
          {COPY.portal.deadlineTitle}
        </h2>
        <p className="text-lg font-semibold">
          <Timestamp value={deadline} fallback={COPY.portal.deadlineTba} />
        </p>
      </div>
    </Card>
  );
}
