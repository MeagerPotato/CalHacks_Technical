import type { ReactNode } from "react";

export interface GallerySectionProps {
  /** Id of the section heading, which labels the section. */
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

/** One titled group in the development component gallery. */
export function GallerySection({ id, title, description, children }: GallerySectionProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t-2 border-border px-4 py-8">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-2xl font-bold">
          {title}
        </h2>
        {description ? <p>{description}</p> : null}
      </div>
      {/* Short primitives share a row; wide views wrap onto their own line. */}
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}
