import { expect, test } from "@playwright/test";

import { COPY, LOCKED } from "@/content/copy";
import { ACCOUNT_ROLE_LABELS } from "@/lib/application-config";
import { ROUTES } from "@/lib/routes";

import { createAccount, newPassword, queryRows, seedApplication, uniqueEmail } from "./support/accounts";
import { expectPathAndQuery, signInViaUi, signOutViaUi } from "./support/ui";

test.describe("authentication", () => {
  test("public signup offers only Hacker and Judge and rejects a tampered Organizer role", async ({ page }) => {
    await page.goto(ROUTES.signup);
    await expect(page.getByRole("radio")).toHaveCount(2);
    await expect(page.getByRole("radio", { name: ACCOUNT_ROLE_LABELS.hacker })).toBeVisible();
    await expect(page.getByRole("radio", { name: ACCOUNT_ROLE_LABELS.judge })).toBeVisible();

    const email = uniqueEmail("tampered-role");
    await page.getByRole("radio", { name: ACCOUNT_ROLE_LABELS.hacker }).evaluate((element) => {
      const input = element as HTMLInputElement;
      input.value = "organizer";
      input.checked = true;
    });
    await page.getByLabel(COPY.auth.signup.email).fill(email);
    await page.getByLabel(COPY.auth.signup.password).fill(newPassword());
    await page.getByRole("button", { name: LOCKED.auth.createAccount }).click();

    await expect(page.getByTestId("error-summary")).toBeFocused();
    await expect(page).toHaveURL(/\/signup$/);
    expect(await queryRows("select 1 from auth.users where email = $1", [email])).toHaveLength(0);
  });

  test("a new Hacker signs up, finishes onboarding, and starts the application", async ({ page }) => {
    await page.goto(ROUTES.signup);
    await page.getByRole("radio", { name: ACCOUNT_ROLE_LABELS.hacker }).check();
    await page.getByLabel(COPY.auth.signup.email).fill(uniqueEmail("signup-hacker"));
    await page.getByLabel(COPY.auth.signup.password).fill(newPassword());
    await page.getByRole("button", { name: LOCKED.auth.createAccount }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { level: 1, name: COPY.onboarding.title })).toBeVisible();
    await page.getByLabel(COPY.onboarding.displayName).fill("Signup Hacker");
    await page.getByRole("button", { name: COPY.onboarding.submit }).click();

    await expect(page).toHaveURL(/\/portal\/application\?section=about$/);
    await expect(page.locator("#section-heading-about")).toBeVisible();
  });

  test("a wrong password shows an error and keeps the email", async ({ page }) => {
    const user = await createAccount("wrong-password", { role: "judge" });
    await page.goto(ROUTES.login);
    await page.getByLabel(COPY.auth.login.email).fill(user.email);
    await page.getByLabel(COPY.auth.login.password).fill("not-the-password");
    await page.getByRole("button", { name: LOCKED.auth.signIn }).click();

    await expect(page.getByText(COPY.authNotices.invalid_credentials.title)).toBeVisible();
    await expect(page.getByLabel(COPY.auth.login.email)).toHaveValue(user.email);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signing in returns to the requested page, unsafe destinations fall back, and sign-out protects the portal", async ({
    page,
  }) => {
    const user = await createAccount("next-redirect", { role: "hacker" });
    await seedApplication(user, "hacker", {});

    await page.goto("/portal/application?section=education");
    await expectPathAndQuery(page, `/login?next=${encodeURIComponent("/portal/application?section=education")}`);
    await page.getByLabel(COPY.auth.login.email).fill(user.email);
    await page.getByLabel(COPY.auth.login.password).fill(user.password);
    await page.getByRole("button", { name: LOCKED.auth.signIn }).click();
    await expectPathAndQuery(page, "/portal/application?section=education");

    await signOutViaUi(page);
    await page.goto(ROUTES.portal);
    await expectPathAndQuery(page, `/login?next=${encodeURIComponent(ROUTES.portal)}`);

    await signInViaUi(page, user, "https://evil.example/steal");
    await expectPathAndQuery(page, ROUTES.portal);
  });
});
