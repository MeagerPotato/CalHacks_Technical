export interface EngineerArtProps {
  variant: "landing" | "dashboard";
}

const ASPECT_CLASSES = {
  landing: "aspect-square",
  dashboard: "aspect-[3/2]",
} as const satisfies Record<EngineerArtProps["variant"], string>;

/** Animal engineer placeholder for the landing page and the draft dashboard. Decorative only. */
export function EngineerArt({ variant }: EngineerArtProps) {
  return (
    <div
      aria-hidden="true"
      data-variant={variant}
      className={`pointer-events-none relative w-full overflow-hidden rounded-card border-2 border-border bg-page ${ASPECT_CLASSES[variant]}`}
    >
      <div className="absolute top-[18%] left-[18%] aspect-square w-[22%] rounded-full border-2 border-border bg-highlight" />
      <div className="absolute bottom-0 left-[12%] h-[44%] w-[34%] rounded-t-card border-2 border-border bg-accent" />
      <div className="absolute right-[18%] bottom-[12%] h-[56%] w-[14%] rounded-t-full border-2 border-border bg-surface" />
      <div className="absolute right-[20%] bottom-[12%] h-[14%] w-[10%] border-2 border-border bg-action" />
    </div>
  );
}
