import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { COPY } from "@/content/copy";
import { ROUTES } from "@/lib/routes";

import { partialHackerResponses, validHackerResponses } from "../tests/fixtures/applications";
import { createAccount, createOrganizer, seedApplication } from "./support/accounts";
import { expectPathAndQuery, signInViaUi } from "./support/ui";

test("signed-out visitors are sent to sign in with their destination preserved", async ({ page }) => {
  for (const path of [ROUTES.portal, ROUTES.onboarding, `${ROUTES.portalMission}?x=1`, ROUTES.organizer]) {
    await page.goto(path);
    await expectPathAndQuery(page, `${ROUTES.login}?next=${encodeURIComponent(path)}`);
  }
});

test("Organizers are kept out of the applicant portal", async ({ page }) => {
  const organizer = await createOrganizer("organizer-access");
  await signInViaUi(page, organizer);
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/organizer/);

  for (const path of [ROUTES.portal, ROUTES.onboarding, ROUTES.portalApplication]) {
    await page.goto(path);
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/organizer/);
    await expect(page.getByTestId("launch-readiness")).toHaveCount(0);
  }
});

test("applicants never see organizer pages or another applicant's answers", async ({ page }) => {
  const secretName = `Secret ${randomUUID().slice(0, 8)}`;
  const other = await createAccount("access-other", { role: "hacker" });
  await seedApplication(other, "hacker", { ...validHackerResponses, fullName: secretName }, { submit: true });

  const user = await createAccount("access-user", { role: "hacker" });
  await seedApplication(user, "hacker", partialHackerResponses);
  await signInViaUi(page, user);

  for (const path of [ROUTES.portal, `${ROUTES.portalApplication}?section=review`]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText(secretName);
  }

  // Applicants are redirected from every organizer page to their portal, and no organizer data reaches the page.
  for (const path of [ROUTES.organizer, ROUTES.organizerApplications]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.portal);
    await expect(page.locator("body")).not.toContainText(secretName);
  }
});

test("the development gallery is not served in production", async ({ page }) => {
  const response = await page.goto("/dev/gallery");
  expect(response?.status()).toBe(404);
});

test("an auth callback without a code lands on sign in with an explanation", async ({ page }) => {
  await page.goto(ROUTES.authCallback);
  await expectPathAndQuery(page, `${ROUTES.login}?error=invalid_link`);
  await expect(page.getByTestId("notice-callback-invalid_link")).toContainText(
    COPY.auth.callbackErrors.invalid_link.title,
  );
});
