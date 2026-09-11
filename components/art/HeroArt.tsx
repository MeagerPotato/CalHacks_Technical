/** Landing hero illustration placeholder: a model rocket on its pad beside a planet. Decorative only. */
export function HeroArt() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative aspect-[4/3] w-full overflow-hidden rounded-card border-2 border-border bg-accent"
    >
      <div className="absolute top-[12%] right-[12%] aspect-square w-[22%] rounded-full border-2 border-border bg-highlight" />
      <div className="absolute top-[18%] left-[14%] size-3 rounded-full bg-surface motion-safe:animate-float" />
      <div className="absolute top-[40%] left-[30%] size-2 rounded-full bg-surface motion-safe:animate-float" />
      <div className="absolute bottom-[16%] left-1/2 h-[48%] w-[16%] -translate-x-1/2 rounded-t-full border-2 border-border bg-surface" />
      <div className="absolute bottom-[10%] left-1/2 h-[8%] w-[40%] -translate-x-1/2 rounded-full border-2 border-border bg-dark" />
    </div>
  );
}
