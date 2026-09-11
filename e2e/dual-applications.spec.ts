import { expect, test } from "@playwright/test";

import { COPY, LOCKED } from "@/content/copy";
import { ACCOUNT_ROLE_LABELS, APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import { ROUTES, portalRoute } from "@/lib/routes";

import { validJudgeResponses } from "../tests/fixtures/applications";
import {
  createAccount,
  findApplicationId,
  newPassword,
  queryRows,
  seedApplication,
  setDraftResponses,
  signInDataClient,
  uniqueEmail,
} from "./support/accounts";
import { expectNoAxeViolations, expectPathAndQuery, signInViaUi } from "./support/ui";

test("one account applies as a Hacker and a Judge and switches between the two applications", async ({ page }) => {
  const email = uniqueEmail("signup-both");
  const password = newPassword();

  await page.goto(ROUTES.signup);
  await page.getByRole("checkbox", { name: ACCOUNT_ROLE_LABELS.hacker }).check();
  await page.getByRole("checkbox", { name: ACCOUNT_ROLE_LABELS.judge }).check();
  await page.getByLabel(COPY.auth.signup.email).fill(email);
  await page.getByLabel(COPY.auth.signup.password).fill(password);
  await page.getByRole("button", { name: LOCKED.auth.createAccount }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  const main = page.getByRole("main");
  await expect(main.getByText(APPLICATION_TYPE_LABELS.hacker, { exact: true })).toBeVisible();
  await expect(main.getByText(APPLICATION_TYPE_LABELS.judge, { exact: true })).toBeVisible();
  await page.getByLabel(COPY.onboarding.displayName).fill("Both Applicant");
  await page.getByRole("button", { name: COPY.onboarding.submit }).click();

  // Onboarding creates both drafts and opens the portal dashboard.
  await expect(page).toHaveURL(/\/portal$/);
  const applicant = await signInDataClient(email, password);
  expect(
    await queryRows(
      "select application_type::text as type, status::text as status from public.applications where user_id = $1 order by application_type",
      [applicant.userId],
    ),
  ).toEqual([
    { type: "hacker", status: "draft" },
    { type: "judge", status: "draft" },
  ]);

  // The dashboard opens on the Hacker application and switches to the Judge application.
  await page.goto(ROUTES.portal);
  const switcher = page.getByRole("navigation", { name: COPY.portal.switcherLabel });
  const hackerLink = switcher.getByRole("link", { name: APPLICATION_TYPE_LABELS.hacker });
  const judgeLink = switcher.getByRole("link", { name: APPLICATION_TYPE_LABELS.judge });
  await expect(hackerLink).toHaveAttribute("aria-current", "page");
  await expect(judgeLink).not.toHaveAttribute("aria-current");
  await expect(page.getByText(new RegExp(`^${COPY.portal.reference("H-")}\\d+$`))).toBeVisible();
  await expectNoAxeViolations(page);

  await judgeLink.click();
  await expectPathAndQuery(page, portalRoute("judge"));
  await expect(judgeLink).toHaveAttribute("aria-current", "page");
  await expect(hackerLink).not.toHaveAttribute("aria-current");
  await expect(page.getByText(new RegExp(`^${COPY.portal.reference("J-")}\\d+$`))).toBeVisible();
  await expect(page.getByTestId("launch-readiness").getByTestId("readiness-item-professional")).toBeVisible();

  // Submitting the Judge application leaves the Hacker draft as it was.
  await setDraftResponses(applicant, await findApplicationId(applicant, "judge"), validJudgeResponses);
  await page.goto("/portal/application?type=judge&section=review");
  await page.getByRole("button", { name: LOCKED.review.submit }).click();
  await expect(page).toHaveURL(/\/portal\/mission\?type=judge$/);

  await page.goto(portalRoute("judge"));
  await expect(page.getByTestId("submitted-card")).toBeVisible();
  await switcher.getByRole("link", { name: APPLICATION_TYPE_LABELS.hacker }).click();
  await expectPathAndQuery(page, portalRoute("hacker"));
  await expect(page.getByTestId("progress-card")).toBeVisible();
});

test("a single-application account has no switcher, and a type it does not hold redirects to its own", async ({
  page,
}) => {
  const user = await createAccount("single-type", { role: "hacker" });
  await seedApplication(user, "hacker", {});

  await signInViaUi(page, user, `${ROUTES.portal}?type=judge`);
  await expectPathAndQuery(page, portalRoute("hacker"));
  await expect(page.getByTestId("application-switcher")).toHaveCount(0);
  await expect(page.getByText(APPLICATION_TYPE_LABELS.hacker, { exact: true })).toBeVisible();

  // An unknown type on the tracker goes to the Hacker tracker, and a draft there goes back to its dashboard.
  await page.goto(`${ROUTES.portalMission}?type=organizer`);
  await expectPathAndQuery(page, portalRoute("hacker"));

  await page.goto(`${ROUTES.portalApplication}?type=judge&section=review`);
  await expect(page).toHaveURL(/\/portal\/application\?type=hacker&section=about$/);
});
