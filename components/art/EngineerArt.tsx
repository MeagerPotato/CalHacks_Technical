import { CutoutStar, ModelRocket, OtterEngineer } from "./WorkshopParts";
export interface EngineerArtProps { variant: "landing" | "dashboard"; }
const ASPECT_CLASSES = { landing: "aspect-square", dashboard: "aspect-[3/2]" } as const satisfies Record<EngineerArtProps["variant"], string>;
export function EngineerArt({ variant }: EngineerArtProps) {
  return <div aria-hidden="true" data-variant={variant} className={`pointer-events-none relative w-full ${ASPECT_CLASSES[variant]}`}>
    <svg aria-hidden="true" viewBox={variant === "landing" ? "0 0 360 360" : "0 40 360 240"} className="size-full" fill="none">
      <path d="M38 170Q24 71 153 73Q300 53 325 180Q337 280 196 288Q49 298 38 170Z" fill="var(--color-gold)" opacity=".35" />
      <path d="M41 277H329M57 284H109M288 284H315" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" />
      <g transform="translate(267 188) rotate(13) scale(.82)"><ModelRocket /></g>
      <g transform="translate(134 181) scale(.85)"><OtterEngineer /></g>
      <g transform="translate(260 84) scale(.7)"><g className="art-drift"><CutoutStar /></g></g>
      <path d="M36 121L44 116M37 99L46 102M66 77L68 87" stroke="var(--color-navy)" strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(213 271) rotate(-8)" stroke="var(--color-navy)" strokeWidth="2">
        <path d="M-36-10H36V10H-36Z" fill="var(--color-cream)" /><path d="M-26-10V-2M-15-10V3M-4-10V-2M7-10V3M18-10V-2M29-10V3" />
      </g>
    </svg>
  </div>;
}
