import { CutoutStar, ModelRocket, SkyDetails } from "./WorkshopParts";
export interface RocketArtProps { stage: "launch" | "cruise" | "landing"; }
const ROCKET_TRANSFORMS = { launch: "translate(159 198) rotate(12) scale(.82)", cruise: "translate(178 169) rotate(48) scale(.85)", landing: "translate(241 227) rotate(8) scale(.65)" } as const;
export function RocketArt({ stage }: RocketArtProps) {
  return <div aria-hidden="true" data-stage={stage} className="pointer-events-none relative aspect-square w-full overflow-hidden rounded-card border-2 border-border bg-dark">
    <svg aria-hidden="true" viewBox="0 0 360 360" fill="none" className="size-full">
      <SkyDetails />
      <circle cx="288" cy="66" r="28" fill="var(--color-gold)" /><path d="M253 84L325 49" stroke="var(--color-cream)" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 300C80 303 69 193 170 167S286 156 276 267" stroke="var(--color-sky)" strokeWidth="2" strokeDasharray="3 8" strokeLinecap="round" />
      <path d="M18 322L32 291H74L88 322ZM28 322H80" fill="var(--color-sky)" stroke="var(--color-cream)" strokeWidth="2" />
      <ellipse cx="286" cy="347" rx="89" ry="61" fill="var(--color-evergreen)" stroke="var(--color-sky)" strokeWidth="2" />
      <path d="M215 328Q238 314 256 331T313 321M262 358Q288 338 333 349" stroke="var(--color-sky)" strokeWidth="2" opacity=".5" />
      <g transform={ROCKET_TRANSFORMS[stage]}><g className={stage === "cruise" ? "art-drift" : ""}>
        {stage !== "landing" ? <path d="M-15 64Q-20 93 0 118Q20 93 15 64Z" fill="var(--color-gold)" stroke="var(--color-navy)" strokeWidth="3" /> : null}
        <ModelRocket />
      </g></g>
      <g transform="translate(73 124) scale(.55)"><g className="art-drift"><CutoutStar /></g></g>
      <path d="M16 24V16H24M336 16H344V24M16 336V344H24M336 344H344V336" stroke="var(--color-sky)" strokeWidth="2" />
    </svg>
  </div>;
}
