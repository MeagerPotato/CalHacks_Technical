import type { Metadata } from "next";

import { SkipToContent } from "@/app/_components/SkipToContent";
import { COPY, LOCKED } from "@/content/copy";

import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: LOCKED.brand, template: `%s | ${LOCKED.brand}` },
  description: COPY.meta.description,
};

/** Root layout: font variables on `<html>`, and the skip link as the first focusable element on every page. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <SkipToContent />
        {children}
      </body>
    </html>
  );
}
