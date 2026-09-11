export interface LandingMomentProps {
  decision: "accepted" | "waitlisted";
}

const PLANET_CLASSES = {
  accepted: "bg-success",
  waitlisted: "bg-highlight",
} as const satisfies Record<LandingMomentProps["decision"], string>;

/**
 * Landing moment placeholder shown with a released decision. The rocket settles over `--duration-landing`, the same
 * token that delays the decision card reveal. Decorative only; motion is CSS and motion-safe.
 */
export function LandingMoment({ decision }: LandingMomentProps) {
  return (
    <div
      aria-hidden="true"
      data-decision={decision}
      className="pointer-events-none relative aspect-[4/3] w-full max-w-sm overflow-hidden"
    >
      <div
        className={`absolute inset-x-[10%] -bottom-[20%] h-[56%] rounded-full border-2 border-border ${PLANET_CLASSES[decision]}`}
      />
      <div className="absolute bottom-[30%] left-1/2 h-[40%] w-[14%] -translate-x-1/2 rounded-t-full border-2 border-border bg-surface motion-safe:animate-[reveal_var(--duration-landing)_ease-out_both]" />
    </div>
  );
}
