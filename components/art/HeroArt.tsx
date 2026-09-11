import { CutoutStar, ModelRocket, OtterEngineer } from "./WorkshopParts";

/** A cut-paper model-rocket workshop, drawn entirely in SVG. */
export function HeroArt() {
  return <div aria-hidden="true" className="pointer-events-none relative aspect-[4/3] w-full">
    <svg aria-hidden="true" viewBox="0 0 600 450" fill="none" className="size-full overflow-visible">
      <path d="M81 85Q180 8 372 44Q571 72 573 260Q582 392 393 405L113 406Q9 383 29 247Q15 146 81 85Z" fill="var(--color-sky)" />
      <g stroke="var(--color-navy)" opacity=".12">
        {[100,140,180,220,260,300,340,380].map(y => <path key={y} d={`M53 ${y}H548`} />)}
        {[100,140,180,220,260,300,340,380,420,460,500].map(x => <path key={x} d={`M${x} 82V394`} />)}
      </g>
      <path d="M45 323C-1 208 218 40 377 79S565 192 505 249" stroke="var(--color-navy)" strokeWidth="2" strokeDasharray="5 9" strokeLinecap="round" />
      <g transform="translate(484 85) rotate(-18)">
        <circle r="41" fill="var(--color-gold)" stroke="var(--color-navy)" strokeWidth="3" />
        <ellipse rx="64" ry="13" stroke="var(--color-navy)" strokeWidth="3" />
        <path d="M-31-26Q-10-43 15-29" stroke="var(--color-cream)" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g transform="translate(107 105)"><g className="art-drift"><CutoutStar /></g></g>
      <g transform="translate(539 303) scale(.65)"><CutoutStar /></g>
      <g transform="translate(81 162) rotate(-10)" stroke="var(--color-navy)" strokeWidth="2">
        <path d="M0 0H103V111H0Z" fill="var(--color-cream)" /><path d="M28-7H75V7H28Z" fill="var(--color-gold)" stroke="none" />
        <path d="M48 17Q24 42 33 75H63Q73 43 48 17ZM34 59L22 78M63 59L75 78M48 72V91M15 96H87" strokeDasharray="3 3" /><circle cx="48" cy="48" r="9" />
      </g>
      <ellipse cx="307" cy="403" rx="220" ry="14" fill="var(--color-navy)" opacity=".1" />
      <g transform="translate(365 231) rotate(9) scale(1.65)"><ModelRocket /></g>
      <g stroke="var(--color-navy)" strokeWidth="3" strokeLinejoin="round">
        <path d="M290 354H459L450 370H300Z" fill="var(--color-gold)" /><path d="M310 369L303 401M438 369L446 401" />
        <path d="M467 191V356M458 214H477M458 238H477M458 262H477M458 286H477M458 310H477" />
      </g>
      <g transform="translate(211 278) scale(1.08)"><OtterEngineer /></g>
      <g transform="translate(477 360) rotate(12)" stroke="var(--color-navy)" strokeWidth="2.5">
        <rect x="-24" y="-17" width="48" height="34" rx="7" fill="var(--color-coral)" /><path d="M-9-17V-25H9V-17M-24-2H24M-3-7V4" />
      </g>
      <path d="M41 414H145M450 414H570M560 406L570 414L560 422" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </div>;
}
