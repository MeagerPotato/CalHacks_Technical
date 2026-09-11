import { Bricolage_Grotesque, Inter } from "next/font/google";

// Body and interface face (PROJECT_PLAN.md section 13).
const bodyFace = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body-face",
});

// Astra may swap the display face here (the plan also allows Space Grotesk). Keep the CSS variable name.
const displayFace = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-face",
});

/** Class names that define the font CSS variables read by `@theme inline` in app/globals.css. Applied to `<html>`. */
export const fontVariables = `${bodyFace.variable} ${displayFace.variable}`;
