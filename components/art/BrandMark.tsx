import { LOCKED } from "@/content/copy";
export function BrandMark() {
  return <span className="inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
    <svg aria-hidden="true" viewBox="0 0 44 44" className="pointer-events-none size-9 shrink-0" fill="none" stroke="var(--color-navy)" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M22 2L38 10L42 29L29 41L10 37L2 20L9 7Z" fill="var(--color-coral)" />
      <g transform="rotate(28 22 22)">
        <path d="M16 28Q12 15 22 7Q32 15 28 28Z" fill="var(--color-cream)" /><path d="M16 22L10 31L18 28M28 22L34 31L26 28" fill="var(--color-gold)" />
        <circle cx="22" cy="18" r="4" fill="var(--color-sky)" /><path d="M19 31L22 37L25 31" />
      </g>
    </svg>
    {LOCKED.brand}
  </span>;
}
