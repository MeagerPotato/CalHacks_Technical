import type { Metadata } from "next";
import "./globals.css";

// Framework layout kept deliberately unstyled. Fonts, colors, and visual design are
// owned by the frontend phase.
export const metadata: Metadata = {
  title: "Launchpad",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
