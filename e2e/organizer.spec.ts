import { randomUUID } from "node:crypto";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { ORGANIZER_COPY, ORGANIZER_LOCKED } from "@/content/copy";
import {
  APPLICATION_FORMS,
  APPLICATION_STATUS_LABELS,
  RECOMMENDATION_LABELS,
  RUBRIC_FORMS,
} from "@/lib/application-config";
import { formatApplicantReference } from "@/lib/domain/applicant-identity";
import { DECISION_STATUSES, type ApplicationType, type Recommendation } from "@/lib/domain/enums";
import { ROUTES, organizerApplicationRoute } from "@/lib/routes";
import {
  REVIEW_RECOMMENDATION_ID,
  overallScoreText,
  reviewScoreControlId,
} from "@/lib/view-models/organizer-scorecard";

import { partialHackerResponses, validHackerResponses, validJudgeResponses } from "../tests/fixtures/applications";
import { createAccount, createOrganizer, queryRows, seedApplication } from "./support/accounts";
import { expectNoAxeViolations, expectPathAndQuery, signInViaUi, signOutViaUi, tabTo } from "./support/ui";

// Organizer pages end to end. Applicants and their applications are created through Supabase Auth and the Data API;
// every organizer step goes through the UI. Selectors use roles, copy, and the data-testid, id, and ARIA contract in
// docs/frontend/organizer.md, never class names or DOM depth.

type ReviewRow = {
  reviewer_id: string;
  rubric_scores: Record<string, number>;
  notes: string;
  recommendation: string | null;
  completed: boolean;
  status: string;
  released: boolean;
};

const REVIEW_SQL = `
  select r.reviewer_id, r.rubric_scores, r.notes, r.recommendation, r.completed_at is not null as completed,
         a.status, a.decision_released_at is not null as released
  from public.reviews r
  join public.applications a on a.id = r.application_id
  where r.application_id = $1`;

/** The page's announcement region inside `main` (the header keeps its own for sign-out). */
function mainLiveStatus(page: Page): Locator {
  return page.locator("main").getByTestId("live-status");
}

function rubricRadio(page: Page, dimension: string, score: number): Locator {
  return page.getByTestId(`rubric-${dimension}`).getByRole("radio", { name: String(score), exact: true });
}

/**
 * The answers with every identifying free-text answer set to the secret. Identifying fields come from the form
 * configuration, so this follows changes to the About you section without naming response keys.
 */
function withIdentitySecret(
  type: ApplicationType,
  responses: Record<string, unknown>,
  secret: string,
): Record<string, unknown> {
  const keys = APPLICATION_FORMS[type].sections
    .flatMap((section) => section.fields)
    .filter((field) => field.identifying && field.kind === "short_text")
    .map((field) => field.key);
  expect(keys.length, `the ${type} form has identifying text answers`).toBeGreaterThan(0);
  return { ...responses, ...Object.fromEntries(keys.map((key) => [key, secret])) };
}

async function applicantReference(applicationId: string): Promise<string> {
  const [row] = await queryRows<{ application_type: ApplicationType; reference_number: number | string }>(
    "select application_type, reference_number from public.applications where id = $1",
    [applicationId],
  );
  return formatApplicantReference(row.application_type, Number(row.reference_number));
}

async function reviewRow(applicationId: string): Promise<ReviewRow> {
  const [row] = await queryRows<ReviewRow>(REVIEW_SQL, [applicationId]);
  expect(row, `a review exists for ${applicationId}`).toBeDefined();
  return row;
}

test.describe("organizer access", () => {
  test("signed-out visitors are sent to sign in with their organizer destination preserved", async ({ page }) => {
    for (const path of [
      ROUTES.organizer,
      `${ROUTES.organizerApplications}?type=judge`,
      `${organizerApplicationRoute(randomUUID())}?identity=revealed`,
    ]) {
      await page.goto(path);
      await expectPathAndQuery(page, `${ROUTES.login}?next=${encodeURIComponent(path)}`);
      await expect(page.getByTestId("organizer-header")).toHaveCount(0);
    }
  });

  test("applicants are sent away from organizer pages and never see identifying details", async ({ page }) => {
    const secret = `Secret ${randomUUID().slice(0, 8)}`;
    const other = await createAccount("organizer-access-other", { role: "judge" });
    const otherId = await seedApplication(other, "judge", withIdentitySecret("judge", validJudgeResponses, secret), {
      submit: true,
    });

    const applicant = await createAccount("organizer-access-applicant", { role: "hacker" });
    await seedApplication(applicant, "hacker", partialHackerResponses);
    await signInViaUi(page, applicant);

    for (const path of [
      ROUTES.organizer,
      `${ROUTES.organizerApplications}?search=${encodeURIComponent(secret)}`,
      `${organizerApplicationRoute(otherId)}?identity=revealed`,
    ]) {
      await page.goto(path);
      await expect.poll(() => new URL(page.url()).pathname).not.toMatch(/^\/organizer/);
      await expect(page.getByTestId("organizer-header")).toHaveCount(0);
      const html = await page.content();
      expect(html).not.toContain(secret);
      expect(html).not.toContain(other.email);
    }
  });
});

test("an organizer signs in to Mission Control and moves between organizer pages", async ({ page }) => {
  const applicant = await createAccount("organizer-dashboard-hacker", { role: "hacker" });
  await seedApplication(applicant, "hacker", validHackerResponses, { submit: true });

  const organizer = await createOrganizer("organizer-dashboard");
  await signInViaUi(page, organizer);
  await expectPathAndQuery(page, ROUTES.organizer);

  const locked = ORGANIZER_LOCKED.dashboard;
  await expect(page.getByRole("heading", { level: 1, name: locked.heading, exact: true })).toBeVisible();
  await expect(page.getByTestId("organizer-dashboard")).toHaveAttribute("data-empty", "false");
  await expect(page.getByTestId("organizer-nav-dashboard")).toHaveAttribute("aria-current", "page");

  const kpis = page.getByTestId("kpi-cards");
  for (const label of Object.values(locked.kpis)) {
    await expect(kpis).toContainText(label);
  }
  await expect(page.getByTestId("queue-progress-card")).toBeVisible();
  await expect(page.getByTestId("status-breakdown")).toBeVisible();
  await expect(page.getByTestId("recent-submissions")).toBeVisible();

  await expect(page.getByRole("heading", { level: 2, name: locked.expertiseRadar, exact: true })).toBeVisible();
  await expect(page.getByTestId("expertise-radar-chart")).toHaveAttribute("role", "img");
  await expect(page.getByRole("table", { name: ORGANIZER_COPY.dashboard.radarTableCaption })).toBeVisible();
  await expect(page.getByTestId("coverage-gap")).toContainText(locked.coverageGap);
  await expectNoAxeViolations(page);

  await page.getByTestId("start-reviewing").click();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toMatch(new RegExp(`^${ROUTES.organizerApplications}/[0-9a-f-]{36}$`));
  await expect(page.getByTestId("review-workspace")).toHaveAttribute("data-blind", "true");
  await expect(page.getByTestId("organizer-nav-applications")).toHaveAttribute("aria-current", "true");

  await page.getByTestId("back-to-applications").click();
  await expectPathAndQuery(page, ROUTES.organizerApplications);
  await expect(
    page.getByRole("heading", { level: 1, name: ORGANIZER_COPY.applications.heading, exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("organizer-nav-applications")).toHaveAttribute("aria-current", "page");

  await page.getByTestId("organizer-nav-dashboard").click();
  await expectPathAndQuery(page, ROUTES.organizer);

  await signOutViaUi(page);
  await page.goto(ROUTES.organizer);
  await expectPathAndQuery(page, `${ROUTES.login}?next=${encodeURIComponent(ROUTES.organizer)}`);
});

test("applications table filters, sorting, and empty states live in the URL", async ({ page }) => {
  // Both accounts share a token in their email address, so a search finds exactly these two applications.
  const token = randomUUID().slice(0, 8);
  const hacker = await createAccount(`table-${token}-hacker`, { role: "hacker" });
  const hackerId = await seedApplication(hacker, "hacker", validHackerResponses, { submit: true });
  const judge = await createAccount(`table-${token}-judge`, { role: "judge" });
  const judgeId = await seedApplication(judge, "judge", validJudgeResponses, { submit: true });

  const organizer = await createOrganizer("organizer-table");
  await signInViaUi(page, organizer, ROUTES.organizerApplications);
  await expectPathAndQuery(page, ROUTES.organizerApplications);

  const copy = ORGANIZER_COPY.applications;
  const base = ROUTES.organizerApplications;
  const search = page.getByRole("searchbox", { name: copy.search, exact: true });
  const type = page.getByRole("combobox", { name: copy.type, exact: true });
  const sort = page.getByRole("combobox", { name: copy.sort, exact: true });
  const apply = page.getByTestId("apply-filters");
  const results = page.getByTestId("application-results");
  const hackerRow = page.getByTestId(`application-row-${hackerId}`);
  const judgeRow = page.getByTestId(`application-row-${judgeId}`);
  const submittedHeader = page.locator('th[data-column="submitted"]');

  await search.fill(token);
  await type.selectOption("hacker");
  await apply.click();
  await expectPathAndQuery(page, `${base}?search=${token}&type=hacker`);
  await expect(results).toHaveAttribute("data-state", "results");
  await expect(page.getByRole("heading", { level: 2, name: copy.resultCount(1), exact: true })).toBeVisible();
  await expect(hackerRow).toBeVisible();
  await expect(hackerRow).toHaveAttribute("data-status", "submitted");
  await expect(judgeRow).toHaveCount(0);
  await expect(submittedHeader).toHaveAttribute("aria-sort", "descending");
  expect(await page.locator('th[data-column="score"]').getAttribute("aria-sort")).toBeNull();
  await expectNoAxeViolations(page);

  // The URL is the table's state, so a reload keeps the filters and the results.
  await page.reload();
  await expect(search).toHaveValue(token);
  await expect(type).toHaveValue("hacker");
  await expect(hackerRow).toBeVisible();

  // A sort header is a link that keeps the filters, and the form follows the URL.
  await page.getByTestId("sort-submitted").click();
  await expectPathAndQuery(page, `${base}?search=${token}&type=hacker&sort=submitted_asc`);
  await expect(submittedHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(sort).toHaveValue("submitted_asc");

  await type.selectOption({ label: copy.anyType });
  await apply.click();
  await expectPathAndQuery(page, `${base}?search=${token}&sort=submitted_asc`);
  await expect(page.getByRole("heading", { level: 2, name: copy.resultCount(2), exact: true })).toBeVisible();
  const rows = page.getByTestId("applications-table").locator("tbody > tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute("data-testid", `application-row-${hackerId}`);
  await expect(judgeRow).toBeVisible();

  const noMatch = `${token}-none`;
  await search.fill(noMatch);
  await apply.click();
  await expectPathAndQuery(page, `${base}?search=${noMatch}&sort=submitted_asc`);
  await expect(results).toHaveAttribute("data-state", "no-results");
  const message = page.getByTestId("application-results-message");
  await expect(message.getByRole("heading", { name: copy.noResultsTitle, exact: true })).toBeVisible();
  await expectNoAxeViolations(page);

  // Clear filters keeps the sort; Back restores the filtered URL and the form follows it.
  await message.getByRole("link", { name: copy.clear, exact: true }).click();
  await expectPathAndQuery(page, `${base}?sort=submitted_asc`);
  await expect(search).toHaveValue("");

  await page.goBack();
  await expectPathAndQuery(page, `${base}?search=${noMatch}&sort=submitted_asc`);
  await expect(search).toHaveValue(noMatch);
});

test("blind review keeps identifying details out of the page until an organizer reveals them", async ({ page }) => {
  const secret = `Secret ${randomUUID().slice(0, 8)}`;
  const hacker = await createAccount("blind-hacker", { role: "hacker" });
  const applicationId = await seedApplication(
    hacker,
    "hacker",
    withIdentitySecret("hacker", validHackerResponses, secret),
    { submit: true },
  );
  const route = organizerApplicationRoute(applicationId);
  const reference = await applicantReference(applicationId);

  const organizer = await createOrganizer("organizer-blind");
  await signInViaUi(page, organizer, route);
  await expectPathAndQuery(page, route);

  const blind = ORGANIZER_COPY.workspace.blind;
  const workspace = page.getByTestId("review-workspace");
  const toggle = page.getByTestId("identity-toggle");
  const identity = page.getByTestId("identity-panel");

  await expect(
    page.getByRole("heading", { level: 1, name: ORGANIZER_LOCKED.workspace.applicant(reference), exact: true }),
  ).toBeVisible();
  await expect(workspace).toHaveAttribute("data-blind", "true");
  await expect(page.locator("#blind-mode-status")).toHaveText(blind.on);
  await expect(page.getByTestId("narrative-panel")).toBeVisible();
  await expect(identity).toHaveCount(0);
  // Blind means absent from the document and its page data, not only hidden.
  const blindHtml = await page.content();
  expect(blindHtml).not.toContain(secret);
  expect(blindHtml).not.toContain(hacker.email);
  await expectNoAxeViolations(page);

  await expect(toggle).toHaveText(blind.reveal);
  await toggle.click();
  await expectPathAndQuery(page, `${route}?identity=revealed`);
  await expect(workspace).toHaveAttribute("data-blind", "false");
  await expect(identity).toContainText(secret);
  await expect(identity).toContainText(hacker.email);
  await expect(toggle).toHaveText(blind.hide);
  await expect(toggle).toBeFocused();
  await expect(mainLiveStatus(page)).toHaveText(blind.off);
  await expectNoAxeViolations(page);

  await page.reload();
  await expect(identity).toContainText(secret);

  await toggle.click();
  await expectPathAndQuery(page, route);
  await expect(workspace).toHaveAttribute("data-blind", "true");
  await expect(identity).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(secret);
  await expect(mainLiveStatus(page)).toHaveText(blind.on);
});

test("an organizer drafts and completes a review, continues to the next application, and releases a decision", async ({
  page,
}) => {
  const first = await createAccount("review-first", { role: "hacker" });
  const firstId = await seedApplication(first, "hacker", validHackerResponses, { submit: true });
  // Submitted right after the first application, so it is next in the review queue (tests run one at a time).
  const second = await createAccount("review-second", { role: "judge" });
  const secondId = await seedApplication(second, "judge", validJudgeResponses, { submit: true });
  const firstReference = await applicantReference(firstId);
  const secondReference = await applicantReference(secondId);
  const firstRoute = organizerApplicationRoute(firstId);

  const organizer = await createOrganizer("organizer-review");
  await signInViaUi(page, organizer, firstRoute);
  await expectPathAndQuery(page, firstRoute);

  const copy = ORGANIZER_COPY.workspace;
  const scorecard = page.getByTestId("scorecard");
  const status = mainLiveStatus(page);
  const dimensions = RUBRIC_FORMS.hacker;

  await expect(scorecard).toHaveAttribute("data-access", "editable");
  await expect(page.getByTestId("scorecard-saved")).toContainText(copy.scorecard.notSaved);
  await expect(page.getByTestId("decision-release")).toHaveAttribute("data-state", "unavailable");

  // Completing without answers reports each missing answer and focuses the error summary.
  await page.getByTestId("save-review-and-continue").click();
  await expect(page.getByTestId("error-summary")).toBeFocused();
  for (const dimension of dimensions) {
    await expect(page.getByTestId(`rubric-${dimension.key}`)).toHaveAttribute("data-invalid", "true");
  }
  await expectPathAndQuery(page, firstRoute);
  await expectNoAxeViolations(page);

  // A draft keeps a partial scorecard and starts the review.
  await rubricRadio(page, dimensions[0].key, dimensions[0].maxScore).check();
  await page.getByTestId("save-draft").click();
  await expect(status).toHaveText(copy.status.draftSaved);
  await expect(page.getByTestId("scorecard-saved")).toContainText(copy.scorecard.draftSavedAt);
  await expect(page.getByTestId("workspace-header")).toContainText(APPLICATION_STATUS_LABELS.in_review);
  expect(await reviewRow(firstId)).toMatchObject({
    reviewer_id: organizer.userId,
    completed: false,
    status: "in_review",
  });

  const scores = Object.fromEntries(
    dimensions.map((dimension, index) => [dimension.key, index % 2 === 0 ? dimension.maxScore : dimension.maxScore - 1]),
  );
  for (const [key, score] of Object.entries(scores)) {
    await rubricRadio(page, key, score).check();
  }
  await expect(page.getByTestId("overall-score")).toHaveText(overallScoreText("hacker", scores));
  const recommendation: Recommendation = "yes";
  await page
    .locator("#review-form")
    .getByRole("radio", { name: RECOMMENDATION_LABELS[recommendation], exact: true })
    .check();
  const notes = "Clear evidence of building and learning.";
  await page.getByLabel(ORGANIZER_LOCKED.workspace.notes, { exact: true }).fill(notes);

  await page.getByTestId("save-review-and-continue").click();
  await expectPathAndQuery(page, organizerApplicationRoute(secondId));
  await expect(page.getByTestId("notice-review-continued")).toContainText(copy.continued.title(firstReference));
  await expect(
    page.getByRole("heading", { level: 1, name: ORGANIZER_LOCKED.workspace.applicant(secondReference), exact: true }),
  ).toBeFocused();
  await expect(status).toHaveText(copy.continued.title(firstReference));
  expect(await reviewRow(firstId)).toMatchObject({
    reviewer_id: organizer.userId,
    rubric_scores: scores,
    notes,
    recommendation,
    completed: true,
    status: "in_review",
  });

  // Releasing the official decision is a separate, confirmed step.
  await page.goto(firstRoute);
  await expect(page.getByTestId("notice-review-completed")).toBeVisible();
  await expect(scorecard).toHaveAttribute("data-completed", "true");
  await expect(page.getByTestId("save-draft")).toHaveCount(0);

  const decisionCopy = copy.decision;
  const decision = page.getByTestId("decision-release");
  const release = page.getByTestId("release-decision");
  const confirm = page.getByTestId("decision-confirm");
  const accepted = APPLICATION_STATUS_LABELS.accepted;
  await expect(decision).toHaveAttribute("data-state", "available");

  await release.click();
  await expect(decision).toContainText(decisionCopy.chooseError);
  await expect(page.locator("#decision-choice")).toBeFocused();

  await decision.getByRole("radio", { name: accepted, exact: true }).check();
  await release.click();
  await expect(confirm).toBeFocused();
  await expect(confirm).toContainText(decisionCopy.confirmTitle(accepted));

  await page.getByTestId("cancel-decision").click();
  await expect(confirm).toHaveCount(0);
  await expect(release).toBeFocused();
  expect(await reviewRow(firstId)).toMatchObject({ status: "in_review", released: false });

  await release.click();
  await expect(confirm).toBeFocused();
  await expectNoAxeViolations(page);
  await page.getByTestId("confirm-decision").click();

  await expect(page.getByTestId("decision-released")).toHaveAttribute("data-decision", "accepted");
  await expect(page.locator("#decision-release-title")).toBeFocused();
  await expect(status).toHaveText(decisionCopy.released(accepted));
  await expect(scorecard).toHaveAttribute("data-access", "locked");
  await expect(page.getByTestId("notice-review-decided")).toBeVisible();
  await expectNoAxeViolations(page);
  expect(await reviewRow(firstId)).toMatchObject({ status: "accepted", released: true });
});

test("an organizer can find, reveal, score, and decide an application using only the keyboard", async ({ page }) => {
  const token = randomUUID().slice(0, 8);
  const hacker = await createAccount(`keyboard-${token}`, { role: "hacker" });
  const applicationId = await seedApplication(hacker, "hacker", validHackerResponses, { submit: true });
  const route = organizerApplicationRoute(applicationId);

  const organizer = await createOrganizer("organizer-keyboard");
  await signInViaUi(page, organizer);
  await expectPathAndQuery(page, ROUTES.organizer);

  await tabTo(page, page.getByTestId("organizer-nav-applications"));
  await page.keyboard.press("Enter");
  await expectPathAndQuery(page, ROUTES.organizerApplications);

  await tabTo(page, page.getByRole("searchbox", { name: ORGANIZER_COPY.applications.search, exact: true }));
  await page.keyboard.type(token);
  await page.keyboard.press("Enter");
  await expectPathAndQuery(page, `${ROUTES.organizerApplications}?search=${token}`);

  await tabTo(page, page.getByTestId(`application-row-${applicationId}`).getByRole("link"));
  await page.keyboard.press("Enter");
  await expectPathAndQuery(page, route);

  const toggle = page.getByTestId("identity-toggle");
  await tabTo(page, toggle);
  await page.keyboard.press("Enter");
  await expectPathAndQuery(page, `${route}?identity=revealed`);
  await expect(page.getByTestId("identity-panel")).toContainText(hacker.email);
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expectPathAndQuery(page, route);
  await expect(page.getByTestId("identity-panel")).toHaveCount(0);
  await expect(toggle).toBeFocused();

  // Tab reaches each rubric row; the arrow keys choose within it.
  for (const dimension of RUBRIC_FORMS.hacker) {
    await tabTo(page, page.locator(`#${reviewScoreControlId(dimension.key)}`));
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(rubricRadio(page, dimension.key, dimension.minScore + 2)).toBeChecked();
  }

  const firstRecommendation = page.locator(`#${REVIEW_RECOMMENDATION_ID}`);
  await tabTo(page, firstRecommendation);
  await page.keyboard.press("Space");
  await expect(firstRecommendation).toBeChecked();

  await tabTo(page, page.getByTestId("save-review"));
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("scorecard")).toHaveAttribute("data-completed", "true");
  await expect(mainLiveStatus(page)).toHaveText(ORGANIZER_COPY.workspace.status.reviewSaved);

  const decision = page.getByTestId("decision-release");
  const secondDecision = DECISION_STATUSES[1];
  await expect(decision).toHaveAttribute("data-state", "available");
  await tabTo(page, page.locator("#decision-choice"));
  await page.keyboard.press("ArrowDown");
  await expect(
    decision.getByRole("radio", { name: APPLICATION_STATUS_LABELS[secondDecision], exact: true }),
  ).toBeChecked();

  await tabTo(page, page.getByTestId("release-decision"));
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("decision-confirm")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("confirm-decision")).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("decision-released")).toHaveAttribute("data-decision", secondDecision);
  await expect(page.locator("#decision-release-title")).toBeFocused();
  expect(await reviewRow(applicationId)).toMatchObject({ status: secondDecision, released: true, completed: true });
});
