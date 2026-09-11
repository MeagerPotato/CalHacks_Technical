import { Check, Circle, CircleDot, Clock, Rocket, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { ApplicationStatus } from "@/lib/domain/enums";

export type BadgeTone = "neutral" | "info" | "highlight" | "success";

/** Badge fills with their paired text colors. White text appears only on evergreen. */
export const BADGE_TONE_CLASSES = {
  neutral: "bg-surface text-ink",
  info: "bg-accent text-ink shadow-[0_2px_0_rgb(20_35_59/0.12)]",
  highlight: "bg-highlight text-ink",
  success: "bg-success text-on-success",
} as const satisfies Record<BadgeTone, string>;

const BADGE_BASE_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full border-2 border-border px-2.5 py-0.5 text-sm font-bold";

export interface BadgeProps {
  tone: BadgeTone;
  /** Decorative icon shown before the text; always hidden from assistive technology. */
  icon?: LucideIcon;
  children: ReactNode;
}

function BadgeFrame({ tone, icon: Icon, children, status }: BadgeProps & { status?: ApplicationStatus }) {
  return (
    <span data-status={status} className={`${BADGE_BASE_CLASSES} ${BADGE_TONE_CLASSES[tone]}`}>
      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
      {children}
    </span>
  );
}

/** A small text label. Meaning is always carried by the text, never by color alone. */
export function Badge({ tone, icon, children }: BadgeProps) {
  return (
    <BadgeFrame tone={tone} icon={icon}>
      {children}
    </BadgeFrame>
  );
}

const STATUS_BADGES = {
  draft: { tone: "neutral", icon: Circle },
  submitted: { tone: "info", icon: Rocket },
  in_review: { tone: "info", icon: CircleDot },
  accepted: { tone: "success", icon: Check },
  waitlisted: { tone: "highlight", icon: Clock },
} as const satisfies Record<ApplicationStatus, { tone: BadgeTone; icon: LucideIcon }>;

export interface StatusBadgeProps {
  status: ApplicationStatus;
  /** Display label, usually from `APPLICATION_STATUS_LABELS`. */
  label: string;
}

/** An application status badge with a status icon and `data-status`. */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const { tone, icon } = STATUS_BADGES[status];
  return (
    <BadgeFrame tone={tone} icon={icon} status={status}>
      {label}
    </BadgeFrame>
  );
}
