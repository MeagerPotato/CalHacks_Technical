import { expect, test, type Page } from "@playwright/test";

import { LOCKED } from "@/content/copy";
import { ROUTES } from "@/lib/routes";

/**
 * Presses a pressable control 1px inside one edge. The control lifts on hover and sinks on press, and a transform moves
 * its hit area too, so without the utility's compensating layer the mouseup lands outside and the click is lost.
 */
async function pressNearEdge(page: Page, edge: "top" | "bottom"): Promise<void> {
  const link = page.getByRole("link", { name: LOCKED.landing.applyNow }).first();
  const box = await link.boundingBox();
  if (!box) {
    throw new Error("The Apply now link is not rendered");
  }
  const x = box.x + box.width / 2;
  const y = edge === "top" ? box.y + 1 : box.y + box.height - 1;
  await page.mouse.move(x, edge === "top" ? box.y - 30 : box.y + box.height + 30);
  await page.mouse.move(x, y, { steps: 5 });
  // Let the hover lift settle, then hold the button about as long as a quick click.
  await page.waitForTimeout(250);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
}

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  for (const edge of ["top", "bottom"] as const) {
    test(`a pressable control takes a click 1px inside its ${edge} edge (${reducedMotion} motion)`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await page.goto(ROUTES.home);
      await pressNearEdge(page, edge);
      await expect(page).toHaveURL(new RegExp(`${ROUTES.signup}$`));
    });
  }
}
