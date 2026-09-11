import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LANDING_DURATION_MS, LIFTOFF_DURATION_MS } from "@/components/art/motion";

const ROOT = process.cwd();
const CSS = readFileSync(path.join(ROOT, "app", "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const PALETTE_TOKENS = [
  "--color-navy",
  "--color-cream",
  "--color-sky",
  "--color-coral",
  "--color-gold",
  "--color-evergreen",
  "--color-white",
];

const SEMANTIC_TOKENS = [
  "--color-page",
  "--color-surface",
  "--color-ink",
  "--color-border",
  "--color-action",
  "--color-on-action",
  "--color-success",
  "--color-on-success",
  "--color-highlight",
  "--color-accent",
  "--color-dark",
  "--color-on-dark",
  "--color-focus",
  "--color-focus-on-dark",
  "--color-danger-edge",
  "--color-required",
];

const SHAPE_AND_MOTION_TOKENS = [
  "--radius-card",
  "--radius-control",
  "--shadow-card",
  "--duration-liftoff",
  "--duration-landing",
  "--duration-reveal",
  "--animate-float",
];

const TEXT_PAIRS = [
  ["--color-ink", "--color-page"],
  ["--color-ink", "--color-surface"],
  ["--color-on-action", "--color-action"],
  ["--color-on-success", "--color-success"],
  ["--color-ink", "--color-highlight"],
  ["--color-ink", "--color-accent"],
  ["--color-on-dark", "--color-dark"],
  ["--color-required", "--color-page"],
  ["--color-required", "--color-surface"],
] as const;

const NON_TEXT_PAIRS = [
  ["--color-focus", "--color-page"],
  ["--color-focus", "--color-surface"],
  ["--color-focus-on-dark", "--color-dark"],
  ["--color-danger-edge", "--color-surface"],
  ["--color-border", "--color-page"],
] as const;

const TEXT_MINIMUM = 4.5;
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const MOTION_SAFE_MEDIA = /@media\s*\(\s*prefers-reduced-motion:\s*no-preference\s*\)\s*/;

function readCustomProperties(css: string): Map<string, string> {
  const properties = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    properties.set(match[1], match[2].trim());
  }
  return properties;
}

const PROPERTIES = readCustomProperties(CSS);

function requireProperty(name: string): string {
  const value = PROPERTIES.get(name);
  if (value === undefined) {
    throw new Error(`${name} is not defined in app/globals.css`);
  }
  return value;
}

function resolveValue(name: string): string {
  const seen = new Set([name]);
  let value = requireProperty(name);
  for (let reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value); reference; ) {
    if (seen.has(reference[1])) {
      throw new Error(`Circular reference through ${reference[1]}`);
    }
    seen.add(reference[1]);
    value = requireProperty(reference[1]);
    reference = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
  }
  return value;
}

function hexToRgb(value: string): [number, number, number] {
  const match = HEX_COLOR.exec(value);
  if (!match) {
    throw new Error(`Expected a hex color, received "${value}"`);
  }
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16)) as [number, number, number];
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastBetween(foregroundHex: string, backgroundHex: string): number {
  const first = relativeLuminance(foregroundHex);
  const second = relativeLuminance(backgroundHex);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function contrastRatio(foreground: string, background: string): number {
  return contrastBetween(resolveValue(foreground), resolveValue(background));
}

/** The hex value behind `--color-<name>`, or null when app/globals.css defines no such color token. */
function colorToken(name: string): string | null {
  const property = `--color-${name}`;
  if (!PROPERTIES.has(property)) {
    return null;
  }
  try {
    const value = resolveValue(property);
    return HEX_COLOR.test(value) ? value : null;
  } catch {
    return null;
  }
}

interface BlockRange {
  /** Index of the prelude match. */
  start: number;
  /** Index just after the closing brace. */
  end: number;
  body: string;
}

/** Every block whose prelude matches `prelude`, brace-matched so nested blocks are included. */
function blockRanges(css: string, prelude: RegExp): BlockRange[] {
  const ranges: BlockRange[] = [];
  for (const match of css.matchAll(new RegExp(prelude.source, "g"))) {
    const start = match.index ?? 0;
    const open = css.indexOf("{", start + match[0].length);
    if (open === -1 || css.slice(start + match[0].length, open).trim() !== "") {
      continue;
    }
    let depth = 0;
    for (let index = open; index < css.length; index += 1) {
      if (css[index] === "{") {
        depth += 1;
      } else if (css[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          ranges.push({ start, end: index + 1, body: css.slice(open + 1, index) });
          break;
        }
      }
    }
  }
  return ranges;
}

/** Bodies of every block whose prelude matches `prelude`. */
function findBlocks(css: string, prelude: RegExp): string[] {
  return blockRanges(css, prelude).map((range) => range.body);
}

/** The stylesheet with every matching block removed, prelude included. */
function withoutBlocks(css: string, prelude: RegExp): string {
  let result = "";
  let cursor = 0;
  for (const range of blockRanges(css, prelude)) {
    if (range.start >= cursor) {
      result += css.slice(cursor, range.start);
      cursor = range.end;
    }
  }
  return result + css.slice(cursor);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasDeclaration(block: string, property: string, value: string): boolean {
  return new RegExp(`(^|[;{\\s])${escapeRegExp(property)}\\s*:\\s*${escapeRegExp(value)}\\s*(;|$)`).test(block);
}

function toMilliseconds(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Expected a CSS duration, received "${value}"`);
  }
  return match[2] === "s" ? Number(match[1]) * 1000 : Number(match[1]);
}

describe("design tokens", () => {
  it("defines every frozen token", () => {
    for (const name of [...PALETTE_TOKENS, ...SEMANTIC_TOKENS, ...SHAPE_AND_MOTION_TOKENS]) {
      expect(PROPERTIES.has(name), name).toBe(true);
    }
  });

  it("resolves every semantic color to a hex value", () => {
    for (const name of SEMANTIC_TOKENS) {
      expect(() => hexToRgb(resolveValue(name)), name).not.toThrow();
    }
  });

  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1 for text", (foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(TEXT_MINIMUM);
  });

  it.each(NON_TEXT_PAIRS)("%s against %s meets 3:1 for focus rings and edges", (foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it("computes WCAG contrast correctly", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000")).toBeCloseTo(0, 5);
    expect(contrastBetween("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("keeps the motion constants equal to the CSS duration tokens", () => {
    expect(toMilliseconds(resolveValue("--duration-liftoff"))).toBe(LIFTOFF_DURATION_MS);
    expect(toMilliseconds(resolveValue("--duration-landing"))).toBe(LANDING_DURATION_MS);
  });

  it("leaves Tailwind's infinite spin in place for loading spinners", () => {
    // A spinner marks work that is still running. A finite one stops mid-save, and the page looks frozen.
    expect(CSS).not.toMatch(/--animate-spin\s*:/);
  });
});

describe("global motion and focus rules", () => {
  it("keeps 16px body text in ink on the page color, with display headings", () => {
    const base = findBlocks(CSS, /@layer\s+base\s*/).join("\n");
    const body = findBlocks(base, /(?:^|[{};])\s*body\s*/).join(";");
    expect(hasDeclaration(body, "font-size", "1rem")).toBe(true);
    expect(hasDeclaration(body, "background-color", "var(--color-page)")).toBe(true);
    expect(hasDeclaration(body, "color", "var(--color-ink)")).toBe(true);

    const headings = findBlocks(base, /(?:^|[{};])\s*h1\s*,\s*h2\s*,\s*h3\s*/).join(";");
    expect(hasDeclaration(headings, "font-family", "var(--font-display)")).toBe(true);
  });

  it("collapses animations and transitions, including delays, under reduced motion", () => {
    const blocks = findBlocks(CSS, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*/);
    expect(blocks.length).toBeGreaterThan(0);
    const universal = blocks.flatMap((block) => findBlocks(block, /\*\s*,\s*::before\s*,\s*::after\s*/)).join(";");
    for (const [property, value] of [
      ["animation-duration", "0.01ms !important"],
      ["animation-iteration-count", "1 !important"],
      ["animation-delay", "0s !important"],
      ["transition-duration", "0.01ms !important"],
      ["transition-delay", "0s !important"],
      ["scroll-behavior", "auto !important"],
    ]) {
      expect(hasDeclaration(universal, property, value), `${property}: ${value}`).toBe(true);
    }
  });

  it("draws a 3px focus ring and swaps its color on dark surfaces", () => {
    const focus = findBlocks(CSS, /(?:^|[{};])\s*:focus-visible\s*/).join(";");
    expect(hasDeclaration(focus, "outline", "3px solid var(--color-focus)")).toBe(true);
    expect(hasDeclaration(focus, "outline-offset", "2px")).toBe(true);

    const dark = findBlocks(CSS, /\[data-surface="dark"\]\s+:focus-visible\s*/).join(";");
    expect(hasDeclaration(dark, "outline-color", "var(--color-focus-on-dark)")).toBe(true);
  });

  it("reveals the decision card after the landing moment only when motion is allowed", () => {
    const motionSafe = findBlocks(CSS, MOTION_SAFE_MEDIA).join("\n");
    const reveal = findBlocks(motionSafe, /\[data-reveal="after-landing"\]\s*/).join(";");
    expect(
      hasDeclaration(reveal, "animation", "reveal var(--duration-reveal) ease-out var(--duration-landing) backwards"),
    ).toBe(true);

    const drawIn = findBlocks(motionSafe, /\[data-just-completed="true"\]\s+\[data-progress-line\]\s*/).join(";");
    expect(drawIn).toMatch(/animation\s*:\s*draw-in\s/);
  });

  it("never hides or animates the decision card or progress line outside the motion-safe media query", () => {
    const outside = withoutBlocks(CSS, MOTION_SAFE_MEDIA);
    expect(outside).not.toMatch(/animation(?:-name)?\s*:[^;{}]*\b(?:reveal|draw-in)\b/);
    const revealRules = findBlocks(outside, /\[data-reveal="after-landing"\][^{]*/).join(";");
    expect(revealRules).not.toMatch(/(^|[;{\s])(opacity|visibility|display|animation)\s*:/);
  });

  it("declares keyframes used by plain CSS outside @theme so Tailwind always emits them", () => {
    const theme = findBlocks(CSS, /@theme[^{]*/).join("\n");
    for (const name of ["float", "reveal", "draw-in"]) {
      expect(CSS).toMatch(new RegExp(`@keyframes\\s+${name}\\s*\\{`));
      expect(theme).not.toMatch(new RegExp(`@keyframes\\s+${name}\\b`));
    }
  });
});

const BANNED_TEXT_UTILITIES = new Set(["text-coral", "text-action", "text-danger-edge"]);
const LIGHT_FILLS = new Set(["bg-action", "bg-coral", "bg-highlight", "bg-gold", "bg-accent", "bg-sky"]);
const STRING_LITERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;
// Pseudo-element variants style a separate box, so their fills never sit behind the element's own text.
const SEPARATE_BOX_VARIANT = /(?:^|:)(?:before|after|marker|file|backdrop|selection):/;

interface ClassToken {
  /** The variant chain with its trailing colon ("hover:", "data-[state=complete]:"), or "" for the base state. */
  variant: string;
  utility: string;
}

/** Splits variants from a class token and drops important markers and opacity modifiers from the utility. */
function parseClassToken(token: string): ClassToken {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < token.length; index += 1) {
    const character = token[index];
    if (character === "[" || character === "(") {
      depth += 1;
    } else if (character === "]" || character === ")") {
      depth -= 1;
    } else if (character === ":" && depth === 0) {
      start = index + 1;
    }
  }
  const utility = token
    .slice(start)
    .replace(/^!|!$/g, "")
    .replace(/\/(\d+|\[[^\]]*\])$/, "");
  return { variant: token.slice(0, start), utility };
}

function utilityOf(token: string): string {
  return parseClassToken(token).utility;
}

/**
 * Class strings in a source file. A template literal yields its static text alone and joined with each quoted string
 * inside its `${}` expressions, so the branches of `${done ? "a" : "b"}` are checked as separate class strings.
 */
function classStrings(source: string): string[] {
  const strings: string[] = [];
  for (const match of source.matchAll(STRING_LITERAL)) {
    if (match[3] === undefined) {
      strings.push(match[1] ?? match[2] ?? "");
      continue;
    }
    const staticText = match[3].replace(/\$\{[^}]*\}/g, " ");
    strings.push(staticText);
    for (const expression of match[3].matchAll(/\$\{([^}]*)\}/g)) {
      for (const inner of expression[1].matchAll(/"([^"\n]*)"|'([^'\n]*)'/g)) {
        strings.push(`${staticText} ${inner[1] ?? inner[2] ?? ""}`);
      }
    }
  }
  return strings;
}

function textColor(token: ClassToken): string | null {
  return token.utility.startsWith("text-") ? colorToken(token.utility.slice("text-".length)) : null;
}

function fillColor(token: ClassToken): string | null {
  return token.utility.startsWith("bg-") ? colorToken(token.utility.slice("bg-".length)) : null;
}

/** Whether a text color and a fill from one class string can style the element in the same state. */
function appliesTogether(text: ClassToken, fill: ClassToken, tokens: readonly ClassToken[]): boolean {
  if (text.variant === fill.variant) {
    return true;
  }
  if (SEPARATE_BOX_VARIANT.test(text.variant) || SEPARATE_BOX_VARIANT.test(fill.variant)) {
    return false;
  }
  // A base utility still applies in a variant state unless that state sets the same property.
  if (text.variant === "") {
    return !tokens.some((token) => token.variant === fill.variant && textColor(token) !== null);
  }
  if (fill.variant === "") {
    return !tokens.some((token) => token.variant === text.variant && fillColor(token) !== null);
  }
  return false;
}

/** Contrast-rule violations in one class string. */
function classStringViolations(classString: string): string[] {
  const tokens = classString
    .split(/\s+/)
    .map((token) => token.replace(/^["'`{}()$?,]+|["'`{}()?,]+$/g, ""))
    .filter(Boolean)
    .map(parseClassToken)
    .filter((token) => token.utility.length > 0);
  const utilities = tokens.map((token) => token.utility);
  const violations: string[] = [];

  for (const utility of utilities) {
    if (BANNED_TEXT_UTILITIES.has(utility)) {
      violations.push(`${utility} uses coral as text`);
    }
  }
  if (utilities.includes("text-white") && utilities.some((utility) => LIGHT_FILLS.has(utility))) {
    violations.push("text-white on a coral, gold, or sky fill");
  }
  for (const text of tokens) {
    const foreground = textColor(text);
    if (!foreground) {
      continue;
    }
    for (const fill of tokens) {
      const background = fillColor(fill);
      if (!background || !appliesTogether(text, fill, tokens)) {
        continue;
      }
      const ratio = contrastBetween(foreground, background);
      if (ratio < TEXT_MINIMUM) {
        violations.push(`${text.variant}${text.utility} on ${fill.variant}${fill.utility} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  return violations;
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => path.join(directory, file));
}

describe("component color usage", () => {
  it("normalizes class tokens before checking them", () => {
    expect(utilityOf("hover:text-coral/80")).toBe("text-coral");
    expect(utilityOf("data-[state=complete]:bg-accent")).toBe("bg-accent");
    expect(utilityOf("aspect-[4/3]")).toBe("aspect-[4/3]");
    expect(parseClassToken("supports-(display:grid):bg-accent")).toEqual({
      variant: "supports-(display:grid):",
      utility: "bg-accent",
    });
  });

  it("checks each branch of a template literal as its own class string", () => {
    const source = 'const c = `p-4 ${done ? "bg-success text-on-success" : "bg-highlight text-ink"}`;';
    expect(classStrings(source).map((value) => value.trim().replace(/\s+/g, " "))).toEqual([
      "p-4",
      "p-4 bg-success text-on-success",
      "p-4 bg-highlight text-ink",
    ]);
  });

  it.each([
    ["bg-action text-on-action", 0],
    ["bg-surface text-ink hover:bg-page", 0],
    ["bg-accent text-ink data-[state=complete]:bg-success data-[state=complete]:text-on-success", 0],
    ["bg-dark text-on-dark before:bg-highlight", 0],
    ["hover:text-coral/80", 1],
    ["bg-highlight text-on-success", 1],
    ["bg-success text-ink", 1],
    ["bg-dark text-on-dark hover:bg-accent", 1],
    ["bg-sky text-white", 2],
  ] as const)("finds in %s exactly %i violations", (classString, count) => {
    expect(classStringViolations(classString)).toHaveLength(count);
  });

  it("never uses coral as text, white text on coral, gold, or sky, or any text color below 4.5:1 on its fill", () => {
    const violations: string[] = [];
    for (const file of listSourceFiles(path.join(ROOT, "components"))) {
      const source = readFileSync(file, "utf8");
      for (const classString of classStrings(source)) {
        for (const violation of classStringViolations(classString)) {
          violations.push(`${path.relative(ROOT, file)}: ${violation} in "${classString.trim()}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
