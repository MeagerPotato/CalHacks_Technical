import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";

import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import type { NoticeActionKind, NoticeActionView, NoticeTone, NoticeView } from "@/lib/view-models/types";

export type NoticeLive = "polite" | "assertive" | "off";

/** Tone styles: ink text on white, sky, or gold, with a tone edge. Coral is only an edge, never text. */
export const NOTICE_TONE_CLASSES = {
  info: "border-l-border bg-accent",
  success: "border-l-success bg-surface",
  warning: "border-l-border bg-highlight",
  error: "border-l-danger-edge bg-surface",
} as const satisfies Record<NoticeTone, string>;

const NOTICE_ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const satisfies Record<NoticeTone, LucideIcon>;

const LIVE_ROLES = {
  polite: "status",
  assertive: "alert",
  off: undefined,
} as const satisfies Record<NoticeLive, string | undefined>;

export interface NoticeProps {
  /** Stable identifier, rendered as `data-testid="notice-<id>"`. */
  id?: string;
  tone: NoticeTone;
  title?: string;
  children?: ReactNode;
  actions?: readonly NoticeActionView[];
  /** Handles non-link actions. Without it, only link actions render. */
  onAction?: (kind: NoticeActionKind) => void;
  /** "polite" renders role="status", "assertive" role="alert", "off" (default) no role. */
  live?: NoticeLive;
  ref?: Ref<HTMLDivElement>;
}

/** An inline message with a tone icon, optional body, and actions. */
export function Notice({ id, tone, title, children, actions = [], onAction, live = "off", ref }: NoticeProps) {
  const Icon = NOTICE_ICONS[tone];
  const visibleActions = actions.filter((action) => action.href !== undefined || onAction !== undefined);

  return (
    <div
      ref={ref}
      role={LIVE_ROLES[live]}
      data-testid={id ? `notice-${id}` : undefined}
      data-tone={tone}
      className={`flex gap-3 rounded-card border-2 border-l-8 border-border p-4 text-ink ${NOTICE_TONE_CLASSES[tone]}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-2">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
        {visibleActions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {visibleActions.map((action) =>
              action.href !== undefined ? (
                <AppLink key={action.kind} href={action.href} newTab variant="secondary">
                  {action.label}
                </AppLink>
              ) : (
                <Button key={action.kind} variant="secondary" onClick={() => onAction?.(action.kind)}>
                  {action.label}
                </Button>
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface NoticeFromViewProps {
  view: NoticeView;
  onAction?: (kind: NoticeActionKind) => void;
  live?: NoticeLive;
  ref?: Ref<HTMLDivElement>;
}

/** Renders a `NoticeView` built by the feedback mappers. */
export function NoticeFromView({ view, onAction, live, ref }: NoticeFromViewProps) {
  return (
    <Notice
      ref={ref}
      id={view.id}
      tone={view.tone}
      title={view.title}
      actions={view.actions}
      onAction={onAction}
      live={live}
    >
      {view.body}
    </Notice>
  );
}

export interface LiveStatusProps {
  message: string;
}

/** A visually hidden polite live region. Keep it mounted and change `message` to announce saves and progress. */
export function LiveStatus({ message }: LiveStatusProps) {
  return (
    <div data-testid="live-status" role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
