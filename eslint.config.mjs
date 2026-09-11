import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const LOGIC_ONLY_MESSAGE =
  "Route files and containers in app/ hold logic only. Put markup styling in a components/ view (see CLAUDE.md).";
const VIEW_BOUNDARY_MESSAGE =
  "components/ views are presentational. Load data, call actions, and build view models in app/ containers, then pass display-ready props.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.tsx"],
    // The root layout sets font variables on <html>; global-error must render its own <html> and <body>.
    ignores: ["app/layout.tsx", "app/global-error.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='className']", message: LOGIC_ONLY_MESSAGE },
        { selector: "JSXAttribute[name.name='style']", message: LOGIC_ONLY_MESSAGE },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "next/navigation", message: VIEW_BOUNDARY_MESSAGE },
            { name: "next/headers", message: VIEW_BOUNDARY_MESSAGE },
            { name: "next/cache", message: VIEW_BOUNDARY_MESSAGE },
            {
              name: "next/link",
              message: "Use AppLink from components/ui so internal links respect the unsaved-changes guard.",
            },
            { name: "server-only", message: VIEW_BOUNDARY_MESSAGE },
            { name: "@/lib/application-config", allowTypeImports: true, message: VIEW_BOUNDARY_MESSAGE },
            { name: "@/lib/env", message: VIEW_BOUNDARY_MESSAGE },
            { name: "@/lib/event", message: VIEW_BOUNDARY_MESSAGE },
          ],
          patterns: [
            { group: ["@/app", "@/app/**"], message: VIEW_BOUNDARY_MESSAGE },
            { group: ["@supabase/*"], message: VIEW_BOUNDARY_MESSAGE },
            {
              group: [
                "@/lib/actions",
                "@/lib/actions/**",
                "@/lib/auth",
                "@/lib/auth/**",
                "@/lib/data",
                "@/lib/data/**",
                "@/lib/editor",
                "@/lib/editor/**",
                "@/lib/format",
                "@/lib/format/**",
                "@/lib/supabase",
                "@/lib/supabase/**",
                "@/lib/validation",
                "@/lib/validation/**",
                "@/lib/view-models",
                "@/lib/view-models/**",
              ],
              allowTypeImports: true,
              message: VIEW_BOUNDARY_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "content/**/*.ts", "lib/**/*.{ts,tsx}", "proxy.ts"],
    // The development gallery is the only product-tree code allowed to render fixture data.
    ignores: ["app/dev/gallery/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/dev", "@/app/dev/**", "@/tests", "@/tests/**", "**/tests/**", "**/_fixtures"],
              message: "Product code must not import tests, fixtures, or the development gallery.",
            },
          ],
        },
      ],
    },
  },
  {
    // Playwright fixtures call a `use` callback that the React hooks rule mistakes for a hook.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright output and saved sign-in state:
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    "playwright/.cache/**",
    "e2e/.auth/**",
  ]),
]);

export default eslintConfig;
