/**
 * Liftoff moment placeholder shown by the launch transition. It takes no props: the application workspace owns the
 * liftoff timing (`LIFTOFF_DURATION_MS`). Decorative only; motion is CSS and motion-safe.
 */
export function LiftoffMoment() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative aspect-[3/4] w-full max-w-xs">
      <div className="absolute inset-x-[20%] bottom-0 h-[10%] rounded-full border-2 border-border bg-dark" />
      <div className="absolute bottom-[10%] left-1/2 h-[18%] w-[16%] -translate-x-1/2 rounded-b-full bg-highlight" />
      <div className="absolute bottom-[26%] left-1/2 h-[46%] w-[22%] -translate-x-1/2 rounded-t-full border-2 border-border bg-surface motion-safe:animate-float" />
    </div>
  );
}
