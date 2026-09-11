import { expect, test } from "@playwright/test";

import { COPY, LOCKED } from "@/content/copy";
import { ROUTES, portalRoute } from "@/lib/routes";

import { validHackerResponses, validJudgeResponses } from "../tests/fixtures/applications";
import { createAccount, createOrganizer, seedApplication, submitViaApi } from "./support/accounts";
import { completeReviewAndDecide, startReview } from "./support/mission";
import { expectNoAxeViolations, expectPathAndQuery, signInViaUi } from "./support/ui";

test("the tracker follows review and an Accepted decision from real workflow data", async ({ page }) => {
  const organizer = await createOrganizer("organizer-accepted");
  const user = await createAccount("mission-accepted", { role: "hacker" });
  const applicationId = await seedApplication(user, "hacker", validHackerResponses, { submit: true });
  await signInViaUi(page, user, ROUTES.portalMission);

  const tracker = page.getByTestId("mission-tracker");
  await expect(tracker).toHaveAttribute("data-stage", "cruise");
  await expect(page.getByText(COPY.mission.received)).toBeVisible();
  await expect(page.getByTestId("decision-card")).toHaveCount(0);
  await expectNoAxeViolations(page);

  await startReview(organizer, applicationId);
  await page.reload();
  await expect(page.getByText(COPY.mission.reviewNote)).toBeVisible();
  await expect(page.getByTestId("mission-leg-cruise").locator("time[datetime]")).toHaveCount(1);
  await expectNoAxeViolations(page);

  await completeReviewAndDecide(organizer, applicationId, "hacker", "accepted");
  await page.reload();
  await expect(tracker).toHaveAttribute("data-stage", "landing");
  await expect(page.getByRole("heading", { level: 1, name: LOCKED.mission.landed })).toBeVisible();
  await expect(page.getByTestId("mission-leg-landing")).toHaveAttribute("data-state", "complete");
  const card = page.getByTestId("decision-card");
  await expect(card).toHaveAttribute("data-status", "accepted");
  await expect(card).toContainText(COPY.mission.decision.accepted);
  await expectNoAxeViolations(page);
});

test("drafts go back to the portal, and a Waitlisted decision is revealed only after the landing", async ({ page }) => {
  const organizer = await createOrganizer("organizer-waitlisted");
  const user = await createAccount("mission-waitlisted", { role: "judge" });
  const applicationId = await seedApplication(user, "judge", validJudgeResponses);

  await signInViaUi(page, user, ROUTES.portalMission);
  await expectPathAndQuery(page, portalRoute("judge"));

  await submitViaApi(user, applicationId);
  await startReview(organizer, applicationId);
  await completeReviewAndDecide(organizer, applicationId, "judge", "waitlisted");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(ROUTES.portalMission);
  const card = page.getByTestId("decision-card");
  await expect(card).toHaveAttribute("data-status", "waitlisted");
  await expect(card).toHaveAttribute("data-reveal", "after-landing");
  // The card is in the DOM immediately but its reveal waits for the landing moment.
  expect(await card.evaluate((element) => getComputedStyle(element).animationName)).toBe("reveal");
  expect(await card.evaluate((element) => getComputedStyle(element).animationDelay)).not.toBe("0s");
  await expect.poll(() => card.evaluate((element) => getComputedStyle(element).opacity), { timeout: 5_000 }).toBe("1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  expect(await card.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
});
