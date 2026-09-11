import type { ReactNode } from "react";

import { COPY } from "@/content/copy";

export interface EditorLayoutProps {
  /** The title row, usually `EditorHeader`. */
  header: ReactNode;
  /** Progress and save status. */
  progress: ReactNode;
  /** Section navigation for wide screens, usually `SectionNav`. Hidden below the lg breakpoint. */
  nav: ReactNode;
  /** Section navigation for small screens, usually `SectionSelect`. Hidden from the lg breakpoint up. */
  mobileNav: ReactNode;
  /** Notices and the error summary, shown above the step content. */
  notices?: ReactNode;
  /** The current section panel or the review step. */
  children: ReactNode;
  /** Optional section help, rendered as a labelled complementary region after the content. */
  rail?: ReactNode;
}

/**
 * The application editor layout. It renders no `main`, because `PortalShell` owns the page's `main#main`.
 *
 * DOM order is header, progress, mobile nav, nav, notices, content, rail at every breakpoint, so reading and tab order
 * never change with the viewport. From lg up the nav moves into a sticky side column.
 */
export function EditorLayout({ header, progress, nav, mobileNav, notices, children, rail }: EditorLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      {header}
      {progress}
      <div className="lg:hidden">{mobileNav}</div>
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        {/* Hidden rather than moved off-screen below lg, so only one section navigation is ever exposed. */}
        <div className="hidden lg:sticky lg:top-6 lg:block">{nav}</div>
        <div className="flex min-w-0 flex-col gap-6">
          {notices ? <div className="flex flex-col gap-4 empty:hidden">{notices}</div> : null}
          {children}
          {rail ? (
            <aside aria-label={COPY.editor.railLabel} className="rounded-card border-2 border-border bg-surface p-5">
              {rail}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
