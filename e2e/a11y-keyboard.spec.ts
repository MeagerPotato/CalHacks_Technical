import { expect, test } from "@playwright/test";

import { COPY, LOCKED } from "@/content/copy";
import { ACCOUNT_ROLE_LABELS } from "@/lib/application-config";
import { ROUTES } from "@/lib/routes";

import { partialHackerResponses, validHackerResponses } from "../tests/fixtures/applications";
import {
  createAccount,
  findApplicationId,
  newPassword,
  seedApplication,
  setDraftResponses,
  signInDataClient,
  uniqueEmail,
} from "./support/accounts";
import { expectNoAxeViolations, fieldConfig, fieldLabel, signInViaUi, tabTo } from "./support/ui";

test.describe("automated accessibility checks", () => {
  test("public pages have no WCAG A or AA violations", async ({ page }) => {
    for (const path of [ROUTES.home, ROUTES.login, `${ROUTES.login}?error=link_expired`, ROUTES.signup, "/no-such-page"]) {
      await page.goto(path);
      await expectNoAxeViolations(page);
    }

    await page.goto(ROUTES.signup);
    await page.getByRole("button", { name: LOCKED.auth.createAccount }).click();
    await expect(page.getByTestId("error-summary")).toBeFocused();
    await expectNoAxeViolations(page);
  });

  test("applicant pages have no WCAG A or AA violations in their key states", async ({ page }) => {
    const user = await createAccount("a11y-hacker", { role: "hacker" });
    await signInViaUi(page, user);
    await expect(page).toHaveURL(/\/onboarding$/);
    await expectNoAxeViolations(page);

    await seedApplication(user, "hacker", partialHackerResponses);
    await page.goto(ROUTES.portal);
    await expect(page.getByTestId("launch-readiness")).toBeVisible();
    await expectNoAxeViolations(page);

    await page.goto("/portal/application?section=education");
    await page.getByLabel(fieldLabel("hacker", "graduationYear")).fill("1900");
    await page.getByRole("button", { name: LOCKED.editor.saveAndContinue }).click();
    await expect(page.getByTestId("error-summary")).toBeFocused();
    await expectNoAxeViolations(page);

    // The invalid answer is unsaved, so leaving the page asks first.
    const dialogs: string[] = [];
    page.once("dialog", (dialog) => {
      dialogs.push(dialog.type());
      void dialog.accept();
    });
    await page.goto("/portal/application?section=review");
    expect(dialogs).toEqual(["beforeunload"]);
    await page.getByRole("button", { name: LOCKED.review.submit }).click();
    await expect(page.getByTestId("error-summary")).toBeFocused();
    await expectNoAxeViolations(page);
  });
});

test.describe("keyboard", () => {
  test("the skip link is the first stop, shows a focus ring, and moves focus to the main content", async ({ page }) => {
    await page.goto(ROUTES.home);
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: COPY.common.skipToContent });
    await expect(skipLink).toBeFocused();
    expect(await skipLink.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");

    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
    // No fragment history entry: the App Router cannot restore one, so Back would leave the page out of step.
    expect(new URL(page.url()).hash).toBe("");
  });

  test("a Hacker can sign up, onboard, fix an error, and submit using only the keyboard", async ({ page }) => {
    const email = uniqueEmail("keyboard-hacker");
    const password = newPassword();

    await page.goto(ROUTES.signup);
    const hackerCheckbox = page.getByRole("checkbox", { name: ACCOUNT_ROLE_LABELS.hacker });
    await tabTo(page, hackerCheckbox);
    await page.keyboard.press("Space");
    await expect(hackerCheckbox).toBeChecked();
    await tabTo(page, page.getByLabel(COPY.auth.signup.email));
    await page.keyboard.type(email);
    await tabTo(page, page.getByLabel(COPY.auth.signup.password));
    await page.keyboard.type(password);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/onboarding$/);
    await tabTo(page, page.getByLabel(COPY.onboarding.displayName));
    await page.keyboard.type("Keyboard Hacker");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/portal\/application\?type=hacker&section=about$/);

    // Everything except the Experience section is answered through the Data API to keep the test focused.
    const applicant = await signInDataClient(email, password);
    const applicationId = await findApplicationId(applicant);
    const experienceKeys = new Set(["experienceLevel", "skills", "previousHackathonCount"]);
    await setDraftResponses(
      applicant,
      applicationId,
      Object.fromEntries(Object.entries(validHackerResponses).filter(([key]) => !experienceKeys.has(key))),
    );

    await page.goto("/portal/application?section=experience");
    const levelOptions = fieldConfig("hacker", "experienceLevel").options ?? [];
    await tabTo(page, page.locator("#field-experienceLevel"));
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: levelOptions[1].label })).toBeChecked();

    const skillOptions = fieldConfig("hacker", "skills").options ?? [];
    const firstSkill = page.getByRole("checkbox", { name: skillOptions[0].label });
    await tabTo(page, firstSkill);
    await page.keyboard.press("Space");
    await expect(firstSkill).toBeChecked();

    const hackathons = page.getByLabel(fieldLabel("hacker", "previousHackathonCount"));
    await tabTo(page, hackathons);
    await page.keyboard.type("abc");
    await page.keyboard.press("Enter");

    const summary = page.getByTestId("error-summary");
    await expect(summary).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(summary.getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(hackathons).toBeFocused();

    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("2");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/section=short_answers$/);

    await page.goto("/portal/application?section=review");
    await tabTo(page, page.getByRole("button", { name: LOCKED.review.submit }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/portal\/mission\?type=hacker$/);
  });
});
