import { CutoutStar, ModelRocket, SkyDetails } from "./WorkshopParts";
/** Ignition, ascent, then a held flight frame. */
export function LiftoffMoment() {
  return <div aria-hidden="true" className="pointer-events-none relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-card bg-dark">
    <svg aria-hidden="true" viewBox="0 0 360 480" className="size-full" fill="none">
      <SkyDetails />
      <path d="M72 36V300M288 158V372M115 189V350" stroke="var(--color-sky)" opacity=".3" strokeDasharray="8 12" />
      <ellipse cx="180" cy="448" rx="108" ry="14" fill="var(--color-sky)" />
      <path d="M90 432L114 414H246L270 432Z" fill="var(--color-coral)" stroke="var(--color-navy)" strokeWidth="3" />
      <g className="art-exhaust" fill="var(--color-cream)" stroke="var(--color-navy)" strokeWidth="2">
        <path d="M48 441Q30 419 54 408Q55 383 82 392Q98 367 126 390Q157 366 180 402Q203 368 236 391Q263 373 278 397Q308 389 314 415Q337 426 314 442Z" />
      </g>
      <g className="art-liftoff"><g transform="translate(180 164) scale(1.2)">
        <g className="art-flame"><path d="M-16 62Q-24 107 0 137Q24 107 16 62Z" fill="var(--color-gold)" /><path d="M-8 63Q-13 93 0 111Q13 93 8 63Z" fill="var(--color-cream)" /></g>
        <ModelRocket />
      </g></g>
      <g transform="translate(278 60) scale(.6)"><CutoutStar /></g>
      <g transform="translate(59 287) scale(.4)"><CutoutStar /></g>
    </svg>
  </div>;
}
