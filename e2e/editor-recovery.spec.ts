import { expect, test, type Page, type Route } from "@playwright/test";

import { COPY, LOCKED } from "@/content/copy";
import { getSectionLabel } from "@/lib/view-models/fields";

import { validHackerResponses } from "../tests/fixtures/applications";
import { createAccount, queryRows, seedApplication } from "./support/accounts";
import { editorLiveStatus, fieldLabel, signInViaUi } from "./support/ui";

// Server Action calls are POST requests with a Next-Action header. Intercepting only those keeps page loads and router
// refreshes (GET requests) working. Returns a function that removes the interception.
async function interceptServerActions(
  page: Page,
  respond: (route: Route) => Promise<void>,
): Promise<() => Promise<void>> {
  const matcher = (url: URL) => url.pathname.startsWith("/portal");
  const handler = async (route: Route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      await respond(route);
      return;
    }
    await route.fallback();
  };
  await page.route(matcher, handler);
  return () => page.unroute(matcher, handler);
}

/** A dropped connection, which the editor reports as a network failure. */
function dropServerActions(page: Page): Promise<() => Promise<void>> {
  return interceptServerActions(page, (route) => route.abort("internetdisconnected"));
}

test("a failed save can be retried, repeats its notice title, and returns focus when the retry succeeds", async ({
  page,
}) => {
  const user = await createAccount("recovery-save", { role: "hacker" });
  await seedApplication(user, "hacker", {});
  await signInViaUi(page, user, "/portal/application?section=about");

  const restore = await dropServerActions(page);
  await page.getByLabel(fieldLabel("hacker", "preferredName")).fill("Offline Ada");
  await page.getByRole("button", { name: LOCKED.editor.saveDraft }).click();

  const notice = page.getByTestId("notice-network");
  await expect(notice).toBeVisible();
  const tryAgain = notice.getByRole("button", { name: COPY.notices.actions.retry });
  await tryAgain.click();

  // The unchanged alert is not read again, so the live status repeats its title, and the focused button stays put.
  await expect(editorLiveStatus(page)).toContainText(COPY.notices.network.title);
  await expect(tryAgain).toBeFocused();

  await restore();
  await tryAgain.click();
  await expect(notice).toHaveCount(0);
  await expect(page.locator("#section-heading-about")).toBeFocused();
  await expect(editorLiveStatus(page)).toContainText(COPY.editor.announce.saved);
});

test("a repeated failure is still announced when the error summary takes focus", async ({ page }) => {
  const user = await createAccount("recovery-invalid", { role: "hacker" });
  await seedApplication(user, "hacker", {});
  await signInViaUi(page, user, "/portal/application?section=education");

  await dropServerActions(page);
  await page.getByLabel(fieldLabel("hacker", "school")).fill("Example University");
  await page.getByLabel(fieldLabel("hacker", "graduationYear")).fill("1900");
  await page.getByRole("button", { name: LOCKED.editor.saveDraft }).click();
  const summary = page.getByTestId("error-summary");
  await expect(summary).toBeFocused();

  await page.getByTestId("notice-network").getByRole("button", { name: COPY.notices.actions.retry }).click();
  await expect(editorLiveStatus(page)).toContainText(COPY.notices.network.title);
  await expect(summary).toBeFocused();
});

test("a retry that fails another way moves focus to the new notice's action", async ({ page }) => {
  const user = await createAccount("recovery-swap", { role: "hacker" });
  await seedApplication(user, "hacker", {});
  await signInViaUi(page, user, "/portal/application?section=about");

  const restore = await dropServerActions(page);
  await page.getByLabel(fieldLabel("hacker", "preferredName")).fill("Offline Ada");
  await page.getByRole("button", { name: LOCKED.editor.saveDraft }).click();
  const tryAgain = page.getByTestId("notice-network").getByRole("button", { name: COPY.notices.actions.retry });
  await expect(tryAgain).toBeVisible();
  await restore();

  // A new deployment no longer recognizes this tab's Server Action, so the network notice becomes a reload notice.
  await interceptServerActions(page, (route) =>
    route.fulfill({ status: 404, headers: { "x-nextjs-action-not-found": "1" }, body: "" }),
  );
  await tryAgain.click();
  await expect(
    page.getByTestId("notice-stale_deployment").getByRole("button", { name: COPY.notices.actions.reload }),
  ).toBeFocused();
});

test("Check status keeps focus in the editor, and Try again after a failed section save never submits", async ({
  page,
}) => {
  const user = await createAccount("recovery-submit", { role: "hacker" });
  const applicationId = await seedApplication(user, "hacker", validHackerResponses);
  await signInViaUi(page, user, "/portal/application?section=review");

  // The submission never reaches the server, so the editor cannot confirm it and asks the applicant to check.
  let restore = await dropServerActions(page);
  await page.getByRole("button", { name: LOCKED.review.submit }).click();
  const unconfirmed = page.getByTestId("notice-unconfirmed_submit");
  await expect(unconfirmed).toBeVisible();

  await restore();
  await unconfirmed.getByRole("button", { name: COPY.notices.actions.checkStatus }).click();
  await expect(unconfirmed).toHaveCount(0);
  await expect(page.locator("#section-heading-review")).toBeFocused();

  // A background save now fails while the failed submission is still the last thing the applicant tried.
  restore = await dropServerActions(page);
  const nav = page.getByTestId("section-nav");
  await nav.getByRole("link", { name: getSectionLabel("hacker", "about") }).click();
  await page.getByLabel(fieldLabel("hacker", "preferredName")).fill("Renamed Ada");
  await nav.getByRole("link", { name: getSectionLabel("hacker", "education") }).click();
  const network = page.getByTestId("notice-network");
  await expect(network).toBeVisible();

  // Try again repeats the save that failed. Submitting here would be irreversible.
  await restore();
  await network.getByRole("button", { name: COPY.notices.actions.retry }).click();
  await expect(editorLiveStatus(page)).toContainText(COPY.editor.announce.saved);
  await expect(page).toHaveURL(/section=education$/);
  expect(await queryRows("select status from public.applications where id = $1", [applicationId])).toEqual([
    { status: "draft" },
  ]);
});
