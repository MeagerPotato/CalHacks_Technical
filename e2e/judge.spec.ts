import { expect, test } from "@playwright/test";

import { COPY, LOCKED } from "@/content/copy";
import { ACCOUNT_ROLE_LABELS, APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import { ROUTES } from "@/lib/routes";

import { validJudgeResponses } from "../tests/fixtures/applications";
import {
  createAccount,
  findApplicationId,
  newPassword,
  seedApplication,
  setDraftResponses,
  signInDataClient,
  uniqueEmail,
} from "./support/accounts";
import { editorLiveStatus, fieldLabel, signInViaUi, tabTo } from "./support/ui";

test("a new Judge signs up, onboards, saves a partial draft, sees Launch Readiness update, and submits", async ({
  page,
}) => {
  const email = uniqueEmail("signup-judge");
  const password = newPassword();

  await page.goto(ROUTES.signup);
  await page.getByRole("radio", { name: ACCOUNT_ROLE_LABELS.judge }).check();
  await page.getByLabel(COPY.auth.signup.email).fill(email);
  await page.getByLabel(COPY.auth.signup.password).fill(password);
  await page.getByRole("button", { name: LOCKED.auth.createAccount }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("main").getByText(ACCOUNT_ROLE_LABELS.judge, { exact: true })).toBeVisible();
  await page.getByLabel(COPY.onboarding.displayName).fill("Signup Judge");
  await page.getByRole("button", { name: COPY.onboarding.submit }).click();

  await expect(page).toHaveURL(/\/portal\/application\?section=about$/);
  await expect(
    page.getByRole("heading", { level: 1, name: COPY.editor.title(APPLICATION_TYPE_LABELS.judge) }),
  ).toBeVisible();

  await page.goto("/portal/application?section=review");
  const reviewProfessional = page.getByTestId("launch-readiness").getByTestId("readiness-item-professional");
  await expect(reviewProfessional).toHaveAttribute("data-state", "not_started");

  await reviewProfessional.getByRole("link").click();
  await expect(page).toHaveURL(/section=professional$/);
  await page.getByLabel(fieldLabel("judge", "roleTitle")).fill("Staff Engineer");
  await page.getByRole("button", { name: LOCKED.editor.saveDraft }).click();
  await expect(editorLiveStatus(page)).toContainText(COPY.editor.announce.saved);

  await page.goto(ROUTES.portal);
  await expect(
    page.getByTestId("launch-readiness").getByTestId("readiness-item-professional"),
  ).toHaveAttribute("data-state", "in_progress");

  // The remaining answers go in through the Data API, as the Judge, to keep the test on the journey itself.
  const judge = await signInDataClient(email, password);
  await setDraftResponses(judge, await findApplicationId(judge), validJudgeResponses);
  await page.goto("/portal/application?section=review");
  await page.getByRole("button", { name: LOCKED.review.submit }).click();

  await expect(page).toHaveURL(/\/portal\/mission$/);
  await expect(page.getByTestId("mission-tracker")).toHaveAttribute("data-stage", "cruise");
});

test.describe("Judge application on a small screen", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("shows Judge questions, switches sections from the menu, and saves with the keyboard", async ({ page }) => {
    const user = await createAccount("judge-mobile", { role: "judge" });
    await seedApplication(user, "judge", {});
    await signInViaUi(page, user, "/portal/application?section=about");

    await expect(page.getByLabel(fieldLabel("judge", "preferredName"))).toBeVisible();
    await expect(page.getByText(fieldLabel("hacker", "school"), { exact: true })).toHaveCount(0);
    await expect(page.getByRole("progressbar")).toBeVisible();

    await page.getByTestId("section-select").selectOption("professional");
    await page.getByTestId("section-go").click();
    await expect(page).toHaveURL(/section=professional$/);

    const roleTitle = page.getByLabel(fieldLabel("judge", "roleTitle"));
    await expect(roleTitle).toBeVisible();
    await roleTitle.fill("Staff Engineer");
    await tabTo(page, page.getByRole("button", { name: LOCKED.editor.saveDraft }));
    await page.keyboard.press("Enter");

    await expect(editorLiveStatus(page)).toContainText(COPY.editor.announce.saved);
  });
});

test("a complete Judge application submits and reaches the mission tracker", async ({ page }) => {
  const user = await createAccount("judge-submit", { role: "judge" });
  await seedApplication(user, "judge", validJudgeResponses);
  await signInViaUi(page, user, "/portal/application?section=review");

  await page.getByRole("button", { name: LOCKED.review.submit }).click();
  await expect(page).toHaveURL(/\/portal\/mission$/);
  await expect(page.getByTestId("mission-tracker")).toHaveAttribute("data-stage", "cruise");
});
