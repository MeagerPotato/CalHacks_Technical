import { CutoutStar, ModelRocket } from "./WorkshopParts";
export interface LandingMomentProps { decision: "accepted" | "waitlisted"; }
const PLANET_FILLS = { accepted: "var(--color-evergreen)", waitlisted: "var(--color-gold)" } as const;
/** Both outcomes get a gentle touchdown. Only acceptance gets celebratory stars. */
export function LandingMoment({ decision }: LandingMomentProps) {
  return <div aria-hidden="true" data-decision={decision} className="pointer-events-none relative aspect-[4/3] w-full max-w-sm overflow-hidden">
    <svg aria-hidden="true" viewBox="0 0 400 300" fill="none" className="size-full">
      <path d="M34 219C20 136 102 30 200 48S341 69 365 148" stroke="var(--color-navy)" strokeWidth="2" strokeDasharray="4 9" strokeLinecap="round" />
      <ellipse cx="202" cy="321" rx="188" ry="107" fill={PLANET_FILLS[decision]} stroke="var(--color-navy)" strokeWidth="3" />
      <g stroke={decision === "accepted" ? "var(--color-sky)" : "var(--color-navy)"} strokeWidth="2" opacity=".5">
        <ellipse cx="100" cy="268" rx="27" ry="8" /><ellipse cx="290" cy="280" rx="38" ry="11" /><path d="M161 282Q193 268 221 282" />
      </g>
      <ellipse cx="206" cy="226" rx="39" ry="7" fill="var(--color-navy)" opacity=".2" />
      <g className="art-touchdown"><g transform="translate(203 154) scale(.88)"><ModelRocket /></g></g>
      <g stroke="var(--color-navy)" strokeWidth="3" strokeLinejoin="round">
        <path d="M302 243V169" /><path d="M302 169L347 178L302 192Z" fill={decision === "accepted" ? "var(--color-sky)" : "var(--color-cream)"} />
      </g>
      {decision === "accepted" ? <g className="art-celebrate"><g transform="translate(87 126) rotate(-12) scale(.7)"><CutoutStar /></g><g transform="translate(306 85) scale(.5)"><CutoutStar /></g><path d="M114 62L120 74M335 122L324 130M59 177L71 180" stroke="var(--color-navy)" strokeWidth="3" strokeLinecap="round" /></g> : <g stroke="var(--color-navy)" strokeWidth="2"><circle cx="97" cy="134" r="15" fill="var(--color-sky)" /><path d="M74 144L119 124" /></g>}
    </svg>
  </div>;
}
