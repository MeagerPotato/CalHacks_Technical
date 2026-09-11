import { CutoutStar } from "./WorkshopParts";
export type StickerName = "star" | "wrench" | "planet" | "antenna" | "bolt" | "patch";
export interface StickerProps { name: StickerName; }
/** Die-cut stickers with a white paper edge and an offset ink shadow. */
export function Sticker({ name }: StickerProps) {
  return <span aria-hidden="true" data-name={name} className="pointer-events-none inline-block aspect-square size-14 shrink-0 -rotate-6">
    <svg aria-hidden="true" viewBox="0 0 64 64" className="size-full overflow-visible" fill="none" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M33 4L53 12L61 33L52 54L31 61L11 51L4 30L13 11Z" fill="var(--color-navy)" stroke="none" transform="translate(1 2)" />
      <path d="M33 4L53 12L61 33L52 54L31 61L11 51L4 30L13 11Z" fill="var(--color-white)" strokeWidth="1.5" />
      {name === "star" ? <g transform="translate(32 30)"><CutoutStar /></g> : null}
      {name === "wrench" ? <path d="M22 51L14 43L33 25Q27 11 42 12L36 20L43 26L51 19Q55 34 41 34Z" fill="var(--color-sky)" /> : null}
      {name === "planet" ? <g transform="rotate(-25 32 32)"><circle cx="32" cy="32" r="17" fill="var(--color-evergreen)" /><ellipse cx="32" cy="33" rx="26" ry="7" /><path d="M24 22L28 19" stroke="var(--color-white)" /></g> : null}
      {name === "antenna" ? <g><path d="M20 46H46M32 45V30M19 17Q19 42 44 33Z" fill="var(--color-sky)" /><path d="M33 27L44 16M42 10Q54 11 54 23" /><circle cx="45" cy="15" r="3" fill="var(--color-coral)" /></g> : null}
      {name === "bolt" ? <path d="M33 10L15 35H29L25 54L49 27H34L42 10Z" fill="var(--color-gold)" /> : null}
      {name === "patch" ? <g><path d="M32 11L49 19V39L32 52L15 39V19Z" fill="var(--color-coral)" /><path d="M22 36L32 19L42 36M25 32H39M25 42H39" /></g> : null}
    </svg>
  </span>;
}
