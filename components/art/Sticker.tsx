export type StickerName = "star" | "wrench" | "planet" | "antenna" | "bolt" | "patch";

export interface StickerProps {
  name: StickerName;
}

const STICKER_SHAPE_CLASSES = {
  star: "rotate-45 rounded-sm bg-highlight",
  wrench: "rounded-control bg-accent",
  planet: "rounded-full bg-success",
  antenna: "rounded-t-full bg-surface",
  bolt: "skew-x-12 bg-highlight",
  patch: "rounded-card bg-action",
} as const satisfies Record<StickerName, string>;

/** Small decorative sticker placeholder. */
export function Sticker({ name }: StickerProps) {
  return (
    <span
      aria-hidden="true"
      data-name={name}
      className="pointer-events-none inline-block aspect-square size-12 shrink-0 p-1.5"
    >
      <span className={`block size-full border-2 border-border ${STICKER_SHAPE_CLASSES[name]}`} />
    </span>
  );
}
