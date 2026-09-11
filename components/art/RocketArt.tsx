export interface RocketArtProps {
  stage: "launch" | "cruise" | "landing";
}

// Where the rocket sits in the scene for each mission stage.
const ROCKET_POSITION_CLASSES = {
  launch: "bottom-[22%]",
  cruise: "bottom-[38%] motion-safe:animate-float",
  landing: "bottom-[30%]",
} as const satisfies Record<RocketArtProps["stage"], string>;

/** Three-state mission rocket placeholder: launch plume, space cruise, planet landing. Decorative only. */
export function RocketArt({ stage }: RocketArtProps) {
  return (
    <div
      aria-hidden="true"
      data-stage={stage}
      className="pointer-events-none relative aspect-square w-full overflow-hidden rounded-card border-2 border-border bg-dark"
    >
      <div className="absolute top-[14%] left-[18%] size-2 rounded-full bg-on-dark motion-safe:animate-float" />
      <div className="absolute top-[26%] right-[22%] size-1.5 rounded-full bg-on-dark motion-safe:animate-float" />
      {stage === "launch" ? (
        <div className="absolute bottom-[8%] left-1/2 h-[16%] w-[12%] -translate-x-1/2 rounded-b-full bg-highlight" />
      ) : null}
      {stage === "landing" ? (
        <div className="absolute inset-x-[8%] -bottom-[18%] h-[48%] rounded-full border-2 border-accent bg-success" />
      ) : null}
      <div
        className={`absolute left-1/2 h-[34%] w-[14%] -translate-x-1/2 rounded-t-full border-2 border-accent bg-surface ${ROCKET_POSITION_CLASSES[stage]}`}
      />
    </div>
  );
}
