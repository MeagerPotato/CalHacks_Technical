import { expect, test } from "@playwright/test";

import { COPY, LOCKED } from "@/content/copy";
import { APPLICATION_DEADLINE } from "@/lib/event";
import { toTimestampView } from "@/lib/format/datetime";
import { ROUTES } from "@/lib/routes";
import { getSectionLabel } from "@/lib/view-models/fields";

import { validHackerResponses } from "../tests/fixtures/applications";
import { createAccount, seedApplication, setDraftResponses, type E2EUser } from "./support/accounts";
import { editorLiveStatus, fieldConfig, fieldLabel, signInViaUi } from "./support/ui";

// One Hacker moves through the whole journey, so later tests build on earlier ones.
test.describe.configure({ mode: "serial" });

test.describe("Hacker application journey", () => {
  let user: E2EUser;
  let applicationId: string;

  test.beforeAll(async () => {
    user = await createAccount("journey-hacker", { role: "hacker", displayName: "Journey Hacker" });
    applicationId = await seedApplication(user, "hacker", {});
  });

  test.beforeEach(async ({ page }) => {
    await signInViaUi(page, user, "/portal/application?section=about");
  });

  test("saves a draft answer that survives a reload", async ({ page }) => {
    await page.getByLabel(fieldLabel("hacker", "preferredName")).fill("Ada Builder");
    await page.getByRole("button", { name: LOCKED.editor.saveDraft }).click();

    await expect(editorLiveStatus(page)).toContainText(COPY.editor.announce.saved);
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved");
    await page.reload();
    await expect(page.getByLabel(fieldLabel("hacker", "preferredName"))).toHaveValue("Ada Builder");
  });

  test("Save & continue moves to the next section and focuses its heading", async ({ page }) => {
    await page.getByRole("button", { name: LOCKED.editor.saveAndContinue }).click();

    await expect(page).toHaveURL(/section=education$/);
    await expect(page.locator("#section-heading-education")).toBeFocused();
    await expect(
      page.getByTestId("section-nav").getByRole("link", { name: getSectionLabel("hacker", "education") }),
    ).toHaveAttribute("aria-current", "step");
  });

  test("an invalid answer keeps the applicant on the section while valid answers still save", async ({ page }) => {
    await page.goto("/portal/application?section=education");
    await page.getByLabel(fieldLabel("hacker", "school")).fill("Example University");
    await page.getByLabel(fieldLabel("hacker", "graduationYear")).fill("1900");
    await page.getByRole("button", { name: LOCKED.editor.saveAndContinue }).click();

    await expect(page.getByTestId("error-summary")).toBeFocused();
    await expect(page.locator("#field-graduationYear-error")).toBeVisible();
    await expect(page).toHaveURL(/section=education$/);

    // The invalid answer is still unsaved, so leaving asks first.
    const dialogs: string[] = [];
    page.once("dialog", (dialog) => {
      dialogs.push(dialog.type());
      void dialog.accept();
    });
    await page.reload();
    expect(dialogs).toEqual(["beforeunload"]);
    await expect(page.getByLabel(fieldLabel("hacker", "school"))).toHaveValue("Example University");
    await expect(page.getByLabel(fieldLabel("hacker", "graduationYear"))).toHaveValue("");
  });

  test("browser Back saves the answers on the section being left", async ({ page }) => {
    await page.goto("/portal/application?section=education");
    await page.getByTestId("section-nav").getByRole("link", { name: getSectionLabel("hacker", "experience") }).click();
    await expect(page.locator("#section-heading-experience")).toBeFocused();

    const hackathons = page.getByLabel(fieldLabel("hacker", "previousHackathonCount"));
    await hackathons.fill("3");
    await page.goBack();

    await expect(page).toHaveURL(/section=education$/);
    await expect(page.locator("#section-heading-education")).toBeFocused();
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved");
    await page.goto("/portal/application?section=experience");
    await expect(hackathons).toHaveValue("3");
  });

  test("multi-choice answers stop at the maximum number of selections", async ({ page }) => {
    await page.goto("/portal/application?section=experience");
    const maxItems = fieldConfig("hacker", "skills").maxItems ?? 0;
    const boxes = page.getByRole("group", { name: fieldLabel("hacker", "skills") }).getByRole("checkbox");

    for (let index = 0; index < maxItems; index += 1) {
      await boxes.nth(index).check();
    }
    await expect(boxes.nth(maxItems)).toBeDisabled();
    await expect(boxes.nth(0)).toBeEnabled();
  });

  test("the portal shows progress, the deadline, and Launch Readiness links into the editor", async ({ page }) => {
    await page.goto(ROUTES.portal);
    await expect(page.getByTestId("progress-card")).toBeVisible();

    // The configured deadline, formatted in the event time zone, or "To be announced" while none is set.
    const deadline = toTimestampView(APPLICATION_DEADLINE);
    const deadlineCard = page.getByTestId("deadline-card");
    if (deadline) {
      await expect(deadlineCard.locator("time")).toHaveAttribute("datetime", deadline.iso);
      await expect(deadlineCard).toContainText(deadline.label);
    } else {
      await expect(deadlineCard).toContainText(COPY.portal.deadlineTba);
    }

    const readiness = page.getByTestId("launch-readiness");
    await expect(readiness.getByTestId("readiness-item-about")).toHaveAttribute("data-state", /complete|in_progress/);
    await readiness.getByTestId("readiness-item-education").getByRole("link").click();

    await expect(page).toHaveURL(/\/portal\/application\?section=education$/);
    await expect(page.locator("#section-heading-education")).toBeVisible();
  });

  test("submitting an incomplete application explains what is missing and links to it", async ({ page }) => {
    await page.goto("/portal/application?section=review");
    await expect(page.getByTestId("answer-summary").getByText(COPY.review.notAnsweredRequired).first()).toBeVisible();

    await page.getByRole("button", { name: LOCKED.review.submit }).click();
    const summary = page.getByTestId("error-summary");
    await expect(summary).toBeFocused();

    const firstLink = summary.getByRole("link").first();
    const key = /#field-([A-Za-z0-9_]+)$/.exec((await firstLink.getAttribute("href")) ?? "")?.[1];
    expect(key).toBeTruthy();
    await firstLink.click();
    await expect(page.locator(`#field-${key}`)).toBeFocused();
  });

  test("a complete application submits, lifts off, and opens the mission tracker", async ({ page }) => {
    await setDraftResponses(user, applicationId, validHackerResponses);
    await page.goto("/portal/application?section=review");
    await page.getByRole("button", { name: LOCKED.review.submit }).click();

    await expect(page).toHaveURL(/\/portal\/mission$/);
    await expect(page.getByRole("heading", { level: 1, name: LOCKED.mission.cruising })).toBeVisible();
    await expect(page.getByTestId("mission-leg-launch")).toHaveAttribute("data-state", "complete");
    await expect(page.getByTestId("mission-leg-launch").locator("time[datetime]")).toHaveCount(1);
    await expect(page.getByTestId("mission-leg-cruise")).toHaveAttribute("data-state", "current");
  });

  test("a submitted application is read-only and points to the tracker", async ({ page }) => {
    await expect(page.getByTestId("submitted-application")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("link", { name: LOCKED.portal.trackMission })).toBeVisible();

    await page.goto(ROUTES.portal);
    await expect(page.getByTestId("submitted-card").getByRole("link", { name: LOCKED.portal.trackMission })).toBeVisible();
  });
});
