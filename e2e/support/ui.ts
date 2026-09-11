import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

import { COPY, LOCKED } from "@/content/copy";
import { APPLICATION_FORMS, type ApplicationFieldConfig } from "@/lib/application-config";
import type { ApplicationType } from "@/lib/domain/enums";
import { resolveFieldCopy } from "@/lib/view-models/fields";

// Selectors use roles, labels resolved from the real copy, and the frozen data-testid and ARIA contract,
// never class names or DOM depth, so visual changes cannot break these tests.

export function fieldConfig(type: ApplicationType, key: string): ApplicationFieldConfig {
  for (const section of APPLICATION_FORMS[type].sections) {
    const field = section.fields.find((candidate) => candidate.key === key);
    if (field) {
      return field;
    }
  }
  throw new Error(`Unknown ${type} field: ${key}`);
}

/** The field's accessible label, resolved exactly as the editor renders it. */
export function fieldLabel(type: ApplicationType, key: string): string {
  return resolveFieldCopy(type, fieldConfig(type, key)).label;
}

export async function signInViaUi(
  page: Page,
  user: { email: string; password: string },
  next?: string,
): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel(COPY.auth.login.email).fill(user.email);
  await page.getByLabel(COPY.auth.login.password).fill(user.password);
  await page.getByRole("button", { name: LOCKED.auth.signIn }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

export async function signOutViaUi(page: Page): Promise<void> {
  await page.getByRole("button", { name: LOCKED.auth.signOut }).click();
  await page.waitForURL((url) => url.pathname === "/login");
}

/** Current path plus query string, for exact redirect assertions. */
export function pathAndQuery(page: Page): string {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
}

export async function expectPathAndQuery(page: Page, expected: string): Promise<void> {
  await expect.poll(() => pathAndQuery(page)).toBe(expected);
}

/** The editor's announcement region (the header has its own for sign-out). */
export function editorLiveStatus(page: Page): Locator {
  return page.locator("main").getByTestId("live-status");
}

/** Presses Tab until the target has focus, failing if it never does. */
export async function tabTo(page: Page, target: Locator, maxPresses = 60): Promise<void> {
  for (let press = 0; press < maxPresses; press += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

/** Fails on any WCAG 2.1 A or AA violation reported by axe. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const violations = results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(violations, `axe violations on ${page.url()}`).toEqual([]);
}
