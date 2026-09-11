import { ArrowLeft } from "lucide-react";

import { AppLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/Badge";
import type { ApplicationStatus } from "@/lib/domain/enums";

export interface EditorHeaderProps {
  /** The page heading, for example "Hacker application". */
  title: string;
  status: ApplicationStatus;
  /** Status display text, usually from `APPLICATION_STATUS_LABELS`. */
  statusLabel: string;
  backHref: string;
  backLabel: string;
}

/** The editor title row: a back link, the page `h1`, and the application status badge. */
export function EditorHeader({ title, status, statusLabel, backHref, backLabel }: EditorHeaderProps) {
  return (
    <div className="flex flex-col items-start gap-2">
      <AppLink href={backHref} variant="quiet">
        <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
        {backLabel}
      </AppLink>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <StatusBadge status={status} label={statusLabel} />
      </div>
    </div>
  );
}
