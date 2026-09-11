import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { createRef, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineerArt } from "@/components/art/EngineerArt";
import { HeroArt } from "@/components/art/HeroArt";
import { CheckEmailNotice } from "@/components/auth/CheckEmailNotice";
import { GallerySection } from "@/components/dev/GallerySection";
import { AuthShell } from "@/components/layout/AuthShell";
import { PortalShell } from "@/components/layout/PortalShell";
import { LandingView } from "@/components/marketing/LandingView";
import { DecisionCard } from "@/components/mission/DecisionCard";
import { MissionTracker } from "@/components/mission/MissionTracker";
import { DeadlineCard } from "@/components/portal/DeadlineCard";
import { LaunchReadiness } from "@/components/portal/LaunchReadiness";
import { PortalDraftDashboard } from "@/components/portal/PortalDraftDashboard";
import { PortalSubmittedDashboard } from "@/components/portal/PortalSubmittedDashboard";
import { PortalWelcome } from "@/components/portal/PortalWelcome";
import { ProgressCard } from "@/components/portal/ProgressCard";
import { SubmittedStatusCard } from "@/components/portal/SubmittedStatusCard";
import { AppLink } from "@/components/ui/AppLink";
import { COPY, LOCKED } from "@/content/copy";
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import type { DecisionStatus } from "@/lib/domain/enums";
import { MISSION_STAGES, type MissionLeg, type MissionLegState } from "@/lib/domain/mission";
import { ROUTES } from "@/lib/routes";
import type {
  DecisionView,
  MissionLegView,
  MissionView,
  PortalDraftView,
  PortalSubmittedView,
  PortalWelcomeView,
  ReadinessItemView,
  TimestampView,
} from "@/lib/view-models/types";

// GuardedLink needs the App Router; a plain anchor marked data-guarded proves AppLink chose it.
vi.mock("@/lib/client/navigation-guard", async () => {
  const { createElement } = await import("react");
  return {
    GuardedLink: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
      createElement("a", { ...props, "data-guarded": "true" }, children),
  };
});

// ---------------------------------------------------------------------------
// Markup helpers
// ---------------------------------------------------------------------------

interface Tag {
  name: string;
  attrs: Record<string, string>;
}

interface LinkInfo {
  href: string | undefined;
  text: string;
  attrs: Record<string, string>;
  markup: string;
}

type AnyElement = ReactElement<Record<string, unknown>>;

// Groups: 1 end-tag slash, 2 name, 3 attributes, 4 self-closing slash.
const TAG_PATTERN = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>/g;
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "wbr",
]);

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attribute of source.matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) {
    attrs[attribute[1].toLowerCase()] = decodeEntities(attribute[2] ?? "");
  }
  return attrs;
}

/** Start tags in document order with decoded attributes. Names are lowercased because HTML ignores their case. */
function parseTags(html: string): Tag[] {
  return [...html.matchAll(TAG_PATTERN)]
    .filter((match) => match[1] === "")
    .map((match) => ({ name: match[2].toLowerCase(), attrs: parseAttributes(match[3]) }));
}

/** Outer markup of every element whose start tag matches, in document order. Nested same-name tags are balanced. */
function elementsWhere(html: string, predicate: (tag: Tag) => boolean): string[] {
  const matches = [...html.matchAll(TAG_PATTERN)];
  const found: string[] = [];
  matches.forEach((match, index) => {
    const tag = { name: match[2].toLowerCase(), attrs: parseAttributes(match[3]) };
    if (match[1] !== "" || !predicate(tag)) {
      return;
    }
    const start = match.index ?? 0;
    if (VOID_ELEMENTS.has(tag.name) || match[4] === "/") {
      found.push(match[0]);
      return;
    }
    let depth = 0;
    for (const candidate of matches.slice(index)) {
      if (candidate[2].toLowerCase() !== tag.name || candidate[4] === "/") {
        continue;
      }
      depth += candidate[1] === "" ? 1 : -1;
      if (depth === 0) {
        found.push(html.slice(start, (candidate.index ?? 0) + candidate[0].length));
        return;
      }
    }
    throw new Error(`Unclosed <${tag.name}>`);
  });
  return found;
}

function tagsNamed(html: string, name: string): Tag[] {
  return parseTags(html).filter((tag) => tag.name === name);
}

function onlyTag(html: string, name: string): Tag {
  const tags = tagsNamed(html, name);
  expect(tags, `exactly one <${name}>`).toHaveLength(1);
  return tags[0];
}

function tagById(html: string, id: string): Tag {
  const tags = parseTags(html).filter((tag) => tag.attrs.id === id);
  expect(tags, `exactly one #${id}`).toHaveLength(1);
  return tags[0];
}

function rootOf(markup: string): Tag {
  return parseTags(markup)[0];
}

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ""));
}

/** Text of every element with this tag name, in document order. */
function textsOf(html: string, name: string): string[] {
  return elementsWhere(html, (tag) => tag.name === name).map(textOf);
}

/** Outer markup of the single element with this test id. */
function byTestId(html: string, testId: string): string {
  const found = elementsWhere(html, (tag) => tag.attrs["data-testid"] === testId);
  expect(found, `exactly one [data-testid="${testId}"]`).toHaveLength(1);
  return found[0];
}

function linksIn(html: string): LinkInfo[] {
  return elementsWhere(html, (tag) => tag.name === "a").map((markup) => {
    const { attrs } = rootOf(markup);
    return { href: attrs.href, text: textOf(markup), attrs, markup };
  });
}

function hrefsAndTexts(html: string): [string | undefined, string][] {
  return linksIn(html).map((link) => [link.href, link.text]);
}

function testIdsIn(html: string): string[] {
  return parseTags(html)
    .map((tag) => tag.attrs["data-testid"])
    .filter((testId): testId is string => testId !== undefined);
}

/** Exactly one `main#main` with `tabindex="-1"`; returns its outer markup. */
function expectSingleMain(html: string): string {
  const main = onlyTag(html, "main");
  expect(main.attrs.id).toBe("main");
  expect(main.attrs.tabindex).toBe("-1");
  tagById(html, "main");
  return elementsWhere(html, (tag) => tag.name === "main")[0];
}

function expectNoMain(html: string): void {
  expect(tagsNamed(html, "main")).toHaveLength(0);
  expect(parseTags(html).some((tag) => tag.attrs.id === "main")).toBe(false);
}

/** Headings start at `first` and never go more than one level deeper than the heading before them. */
function expectHeadingOutline(html: string, first: number): void {
  const levels = parseTags(html)
    .filter((tag) => /^h[1-6]$/.test(tag.name))
    .map((tag) => Number(tag.name.slice(1)));
  expect(levels[0]).toBe(first);
  for (let index = 1; index < levels.length; index += 1) {
    expect(levels[index], `heading ${index + 1} after an h${levels[index - 1]}`).toBeLessThanOrEqual(
      levels[index - 1] + 1,
    );
  }
}

function expectUniqueIds(html: string): void {
  const ids = parseTags(html)
    .map((tag) => tag.attrs.id)
    .filter((id): id is string => id !== undefined);
  expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
}

/** Every `aria-labelledby` and `aria-describedby` id names exactly one element in the markup. */
function expectReferencesResolve(html: string): void {
  const tags = parseTags(html);
  for (const tag of tags) {
    for (const attribute of ["aria-labelledby", "aria-describedby"]) {
      for (const id of tag.attrs[attribute]?.split(" ") ?? []) {
        expect(tags.filter((candidate) => candidate.attrs.id === id), `${attribute} -> #${id}`).toHaveLength(1);
      }
    }
  }
}

function expectDecorativeIcons(html: string): void {
  for (const svg of tagsNamed(html, "svg")) {
    expect(svg.attrs["aria-hidden"]).toBe("true");
  }
}

/**
 * The tracker never shows a percentage, a progress bar, or an estimated time. Class names are skipped because the art
 * placeholders position shapes with percentage utilities such as `top-[14%]`.
 */
function expectNoPercentagesOrEstimates(html: string): void {
  const text = textOf(html);
  expect(text).not.toContain("%");
  expect(text).not.toMatch(/\bETA\b|estimat/i);
  for (const tag of parseTags(html)) {
    for (const [name, value] of Object.entries(tag.attrs)) {
      if (name !== "class") {
        expect(value, `<${tag.name} ${name}>`).not.toContain("%");
      }
    }
    expect(tag.attrs.role).not.toBe("progressbar");
    expect(["progress", "meter"]).not.toContain(tag.name);
  }
}

/** Host and component elements in a returned tree, without rendering nested components. */
function collectElements(node: ReactNode, found: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectElements(child, found);
    }
  } else if (isValidElement<Record<string, unknown>>(node)) {
    found.push(node);
    collectElements(node.props.children as ReactNode, found);
  }
  return found;
}

function elementsOfType(node: ReactNode, type: unknown): AnyElement[] {
  return collectElements(node).filter((element) => element.type === type);
}

const consoleErrors: unknown[][] = [];

beforeEach(() => {
  consoleErrors.length = 0;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // Any React warning (keys, invalid attributes, refs) fails the test.
  expect(consoleErrors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Hand-built view models (the builders in lib/view-models are tested separately)
// ---------------------------------------------------------------------------

const SAVED_AT: TimestampView = { iso: "2026-09-08T19:30:00.000Z", label: "Sep 8, 2026, 12:30 PM PDT" };
const LAUNCHED_AT: TimestampView = { iso: "2026-09-09T17:00:00.000Z", label: "Sep 9, 2026, 10:00 AM PDT" };
const REVIEW_STARTED_AT: TimestampView = { iso: "2026-09-10T16:15:00.000Z", label: "Sep 10, 2026, 9:15 AM PDT" };
const RELEASED_AT: TimestampView = { iso: "2026-09-12T01:45:00.000Z", label: "Sep 11, 2026, 6:45 PM PDT" };
const DEADLINE: TimestampView = { iso: "2026-10-01T06:59:00.000Z", label: "Sep 30, 2026, 11:59 PM PDT" };

function readinessItem(
  item: Pick<ReadinessItemView, "id" | "label" | "state"> & Partial<ReadinessItemView>,
): ReadinessItemView {
  return {
    stateLabel: COPY.readiness.states[item.state],
    isCurrent: false,
    justCompleted: false,
    needsAttention: false,
    progressText: COPY.readiness.progress(0, 3),
    href: `/portal/application?section=${item.id}`,
    ...item,
  };
}

const READINESS: ReadinessItemView[] = [
  readinessItem({
    id: "about",
    label: "About",
    state: "complete",
    justCompleted: true,
    progressText: COPY.readiness.progress(3, 3),
  }),
  readinessItem({
    id: "education",
    label: "Education",
    state: "in_progress",
    isCurrent: true,
    needsAttention: true,
    progressText: COPY.readiness.progress(1, 3),
  }),
  readinessItem({ id: "experience", label: "Experience", state: "not_started" }),
];

const WELCOME: PortalWelcomeView = {
  greeting: COPY.portal.greeting("Ada"),
  typeLabel: APPLICATION_TYPE_LABELS.hacker,
  reference: COPY.portal.reference("H-1042"),
};

const DRAFT_VIEW: PortalDraftView = {
  kind: "draft",
  welcome: WELCOME,
  progress: {
    percent: 40,
    valueText: COPY.portal.progressValue(40),
    nextStep: { label: "Education", href: "/portal/application?section=education" },
    lastSaved: SAVED_AT,
    cta: { label: COPY.portal.continueCta, href: "/portal/application?section=education" },
  },
  deadline: null,
  readiness: READINESS,
};

const SUBMITTED_VIEW: PortalSubmittedView = {
  kind: "submitted",
  welcome: WELCOME,
  status: "submitted",
  statusLabel: APPLICATION_STATUS_LABELS.submitted,
  launched: LAUNCHED_AT,
  deadline: DEADLINE,
  trackHref: ROUTES.portalMission,
  viewHref: ROUTES.portalApplication,
};

function missionLeg(
  leg: MissionLeg,
  state: MissionLegState,
  detail: string,
  time: TimestampView | null,
  timePrefix: string,
): MissionLegView {
  return {
    leg,
    name: LOCKED.mission.legs[leg],
    state,
    stateLabel: COPY.mission.legStates[state],
    detail,
    time,
    timePrefix: time ? timePrefix : null,
  };
}

function decisionView(status: DecisionStatus): DecisionView {
  return {
    status,
    label: APPLICATION_STATUS_LABELS[status],
    message: COPY.mission.decision[status],
    releasedAt: RELEASED_AT,
  };
}

function landedMission(status: DecisionStatus): MissionView {
  return {
    stage: "landing",
    status,
    statusLabel: APPLICATION_STATUS_LABELS[status],
    headline: LOCKED.mission.landed,
    legs: [
      missionLeg("launch", "complete", APPLICATION_STATUS_LABELS.submitted, LAUNCHED_AT, COPY.mission.launched),
      missionLeg(
        "cruise",
        "complete",
        APPLICATION_STATUS_LABELS.in_review,
        REVIEW_STARTED_AT,
        COPY.mission.reviewStarted,
      ),
      missionLeg("landing", "complete", APPLICATION_STATUS_LABELS[status], RELEASED_AT, COPY.mission.released),
    ],
    decision: decisionView(status),
    reviewNote: null,
  };
}

const MISSION_CASES = ["submitted", "in_review", "accepted", "waitlisted"] as const;
type MissionCase = (typeof MISSION_CASES)[number];

const MISSION_VIEWS: Record<MissionCase, MissionView> = {
  submitted: {
    stage: "cruise",
    status: "submitted",
    statusLabel: APPLICATION_STATUS_LABELS.submitted,
    headline: LOCKED.mission.cruising,
    legs: [
      missionLeg("launch", "complete", APPLICATION_STATUS_LABELS.submitted, LAUNCHED_AT, COPY.mission.launched),
      missionLeg("cruise", "current", APPLICATION_STATUS_LABELS.in_review, null, COPY.mission.reviewStarted),
      missionLeg("landing", "upcoming", COPY.mission.decisionPending, null, COPY.mission.released),
    ],
    decision: null,
    reviewNote: COPY.mission.received,
  },
  in_review: {
    stage: "cruise",
    status: "in_review",
    statusLabel: APPLICATION_STATUS_LABELS.in_review,
    headline: LOCKED.mission.cruising,
    legs: [
      missionLeg("launch", "complete", APPLICATION_STATUS_LABELS.submitted, LAUNCHED_AT, COPY.mission.launched),
      missionLeg(
        "cruise",
        "current",
        APPLICATION_STATUS_LABELS.in_review,
        REVIEW_STARTED_AT,
        COPY.mission.reviewStarted,
      ),
      missionLeg("landing", "upcoming", COPY.mission.decisionPending, null, COPY.mission.released),
    ],
    decision: null,
    reviewNote: COPY.mission.reviewNote,
  },
  accepted: landedMission("accepted"),
  waitlisted: landedMission("waitlisted"),
};

const CURRENT_LEG: Record<MissionCase, MissionLeg | null> = {
  submitted: "cruise",
  in_review: "cruise",
  accepted: null,
  waitlisted: null,
};

const TRACKER_PROPS = {
  backHref: ROUTES.portal,
  backLabel: COPY.mission.backToPortal,
  progressLabel: COPY.mission.progressLabel,
  releasedPrefix: COPY.mission.released,
};

const SIGN_OUT = <button type="button">{LOCKED.auth.signOut}</button>;

// ---------------------------------------------------------------------------
// Page frames
// ---------------------------------------------------------------------------

describe("LandingView", () => {
  it("renders the header navigation, then one main landmark with one h1", () => {
    const html = renderToStaticMarkup(<LandingView />);
    const main = expectSingleMain(html);
    expect(textsOf(html, "h1")).toEqual([LOCKED.landing.heroTitle]);
    expect(textsOf(main, "h1")).toEqual([LOCKED.landing.heroTitle]);
    expectHeadingOutline(html, 1);
    expectUniqueIds(html);
    expectReferencesResolve(html);

    const headers = elementsWhere(html, (tag) => tag.name === "header");
    expect(headers).toHaveLength(1);
    expect(html.indexOf("<header")).toBeLessThan(html.indexOf("<main"));
    expect(headers[0]).not.toContain("<main");
    expect(onlyTag(headers[0], "nav").attrs["aria-label"]).toBe(COPY.landing.navLabel);
    expect(hrefsAndTexts(headers[0])).toEqual([
      [ROUTES.home, LOCKED.brand],
      [ROUTES.login, LOCKED.landing.signIn],
      [ROUTES.signup, LOCKED.landing.applyNow],
    ]);
  });

  it("renders the locked hero, the tagline, and the three promise cards", () => {
    const html = renderToStaticMarkup(<LandingView />);
    const text = textOf(html);
    expect(text).toContain(LOCKED.landing.heroSubtitle);
    expect(text).toContain(COPY.landing.tagline);
    expect(textsOf(html, "h2")).toEqual([
      COPY.landing.portalCard.title,
      LOCKED.landing.promises.assemble,
      LOCKED.landing.promises.launch,
      LOCKED.landing.promises.explore,
    ]);
    for (const key of ["assemble", "launch", "explore"] as const) {
      expect(text).toContain(COPY.landing.promises[key]);
    }
  });

  it("renders the portal card inside main with Apply now and Sign in links", () => {
    const html = renderToStaticMarkup(<LandingView />);
    const card = byTestId(expectSingleMain(html), "landing-portal-card");
    const root = rootOf(card);
    expect(root.name).toBe("section");
    expect(tagById(card, root.attrs["aria-labelledby"]).name).toBe("h2");
    expect(textsOf(card, "h2")).toEqual([COPY.landing.portalCard.title]);
    expect(textOf(card)).toContain(COPY.landing.portalCard.body);
    expect(hrefsAndTexts(card)).toEqual([
      [ROUTES.signup, LOCKED.landing.applyNow],
      [ROUTES.login, LOCKED.landing.signIn],
    ]);
  });

  it("routes every link through AppLink and keeps the art decorative", () => {
    const html = renderToStaticMarkup(<LandingView />);
    const links = linksIn(html);
    expect(links.every((link) => link.attrs["data-guarded"] === "true")).toBe(true);
    expect(links.filter((link) => link.href === ROUTES.login).map((link) => link.text)).toEqual([
      LOCKED.landing.signIn,
      LOCKED.landing.signIn,
    ]);
    expect(links.filter((link) => link.href === ROUTES.signup).map((link) => link.text)).toEqual([
      LOCKED.landing.applyNow,
      LOCKED.landing.applyNow,
    ]);

    const engineer = parseTags(html).filter((tag) => tag.attrs["data-variant"] === "landing");
    expect(engineer.map((tag) => tag.attrs["aria-hidden"])).toEqual(["true"]);
    const stickers = parseTags(html).filter((tag) => "data-name" in tag.attrs);
    expect(stickers.length).toBeGreaterThan(0);
    expect(stickers.every((tag) => tag.attrs["aria-hidden"] === "true")).toBe(true);
    expectDecorativeIcons(html);

    // The hero and engineer art slots render inside main.
    const [main] = elementsOfType(LandingView(), "main");
    const mainChildren = main.props.children as ReactNode;
    expect(elementsOfType(mainChildren, HeroArt)).toHaveLength(1);
    expect(elementsOfType(mainChildren, EngineerArt).map((art) => art.props.variant)).toEqual(["landing"]);
  });

  it("keeps the promise cards a list in Safari, which drops list-style: none list semantics", () => {
    const main = expectSingleMain(renderToStaticMarkup(<LandingView />));
    const list = onlyTag(main, "ul");
    expect(list.attrs.role).toBe("list");
    const promises = ["assemble", "launch", "explore"] as const;
    expect(elementsWhere(main, (tag) => tag.name === "li").map(textOf)).toEqual(
      promises.map((key) => `${LOCKED.landing.promises[key]}${COPY.landing.promises[key]}`),
    );
  });
});

describe("AuthShell", () => {
  it("renders the header with the home link and actions, then one main with the h1, content, and footer", () => {
    const html = renderToStaticMarkup(
      <AuthShell
        title={COPY.onboarding.title}
        description={COPY.onboarding.description}
        actions={SIGN_OUT}
        footer={<p>{COPY.onboarding.wrongRole}</p>}
      >
        <p data-testid="auth-content">{COPY.onboarding.accountType}</p>
      </AuthShell>,
    );

    const main = expectSingleMain(html);
    expect(textsOf(html, "h1")).toEqual([COPY.onboarding.title]);
    expect(textsOf(main, "h1")).toEqual([COPY.onboarding.title]);
    expectHeadingOutline(html, 1);
    byTestId(main, "auth-content");
    const mainText = textOf(main);
    const order = [
      COPY.onboarding.title,
      COPY.onboarding.description,
      COPY.onboarding.accountType,
      COPY.onboarding.wrongRole,
    ];
    expect(order.map((part) => mainText.indexOf(part))).toEqual(
      [...order.map((part) => mainText.indexOf(part))].sort((a, b) => a - b),
    );
    expect(order.every((part) => mainText.includes(part))).toBe(true);
    // The wrong-role footer mentions signing out, so check for the action control rather than its text.
    expect(tagsNamed(main, "button")).toHaveLength(0);

    const [header] = elementsWhere(html, (tag) => tag.name === "header");
    expect(html.indexOf("<header")).toBeLessThan(html.indexOf("<main"));
    expect(hrefsAndTexts(header)).toEqual([[ROUTES.home, LOCKED.brand]]);
    expect(linksIn(header)[0].attrs["data-guarded"]).toBe("true");
    expect(textsOf(header, "button")).toEqual([LOCKED.auth.signOut]);
  });

  it("omits the description, footer, and actions when they are not passed", () => {
    const html = renderToStaticMarkup(
      <AuthShell title={COPY.auth.login.title}>
        <p data-testid="auth-content">{COPY.auth.login.email}</p>
      </AuthShell>,
    );
    const main = expectSingleMain(html);
    expect(textOf(main)).toBe(`${COPY.auth.login.title}${COPY.auth.login.email}`);
    const [header] = elementsWhere(html, (tag) => tag.name === "header");
    expect(tagsNamed(header, "button")).toHaveLength(0);
    expect(hrefsAndTexts(header)).toEqual([[ROUTES.home, LOCKED.brand]]);
  });
});

describe("PortalShell", () => {
  it("renders the header with the home link and actions, and one main around the page content", () => {
    const html = renderToStaticMarkup(
      <PortalShell homeHref={ROUTES.portal} actions={SIGN_OUT}>
        <p data-testid="portal-content">{COPY.common.loading}</p>
      </PortalShell>,
    );
    const main = expectSingleMain(html);
    byTestId(main, "portal-content");
    expect(tagsNamed(html, "h1")).toHaveLength(0);
    expect(textOf(main)).not.toContain(LOCKED.auth.signOut);

    const [header] = elementsWhere(html, (tag) => tag.name === "header");
    expect(html.indexOf("<header")).toBeLessThan(html.indexOf("<main"));
    const links = linksIn(header);
    expect(links.map((link) => [link.href, link.text, link.attrs["data-guarded"]])).toEqual([
      [ROUTES.portal, LOCKED.brand, "true"],
    ]);
    expect(textsOf(header, "button")).toEqual([LOCKED.auth.signOut]);
  });

  it.each([
    ["draft dashboard", <PortalDraftDashboard key="draft" view={DRAFT_VIEW} />, WELCOME.greeting],
    ["submitted dashboard", <PortalSubmittedDashboard key="submitted" view={SUBMITTED_VIEW} />, WELCOME.greeting],
    [
      "mission tracker",
      <MissionTracker key="mission" view={MISSION_VIEWS.accepted} {...TRACKER_PROPS} />,
      LOCKED.mission.landed,
    ],
  ] as [string, ReactElement, string][])("hosts the %s with exactly one main and one h1", (_, page, heading) => {
    const html = renderToStaticMarkup(
      <PortalShell homeHref={ROUTES.portal} actions={SIGN_OUT}>
        {page}
      </PortalShell>,
    );
    expectSingleMain(html);
    expect(textsOf(html, "h1")).toEqual([heading]);
    expectHeadingOutline(html, 1);
    expectUniqueIds(html);
    expectReferencesResolve(html);
  });
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("CheckEmailNotice", () => {
  const email = "ada@example.com";

  it("renders a focusable heading, the email, and the sign-in link", () => {
    const html = renderToStaticMarkup(<CheckEmailNotice email={email} signInHref={ROUTES.login} />);
    const root = rootOf(html);
    expect(root.attrs["data-testid"]).toBe("check-email");
    const heading = onlyTag(html, "h2");
    expect(heading.attrs.tabindex).toBe("-1");
    expect(root.attrs["aria-labelledby"]).toBe(heading.attrs.id);
    expect(textsOf(html, "h2")).toEqual([COPY.auth.checkEmail.title]);
    expect(textOf(html)).toContain(COPY.auth.checkEmail.body(email));
    expect(hrefsAndTexts(html)).toEqual([[ROUTES.login, COPY.auth.checkEmail.signInLink]]);
    expect(tagsNamed(html, "h1")).toHaveLength(0);
    expectNoMain(html);
    expectReferencesResolve(html);
  });

  it("attaches the heading ref so the signup form can focus the heading", () => {
    const headingRef = createRef<HTMLHeadingElement>();
    const headings = elementsOfType(CheckEmailNotice({ email, signInHref: ROUTES.login, headingRef }), "h2");
    expect(headings).toHaveLength(1);
    expect(headings[0].props.ref).toBe(headingRef);
  });
});

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

describe("PortalWelcome", () => {
  it("renders the greeting as the page h1 with the type badge and the reference", () => {
    const html = renderToStaticMarkup(<PortalWelcome view={WELCOME} />);
    expect(textsOf(html, "h1")).toEqual([WELCOME.greeting]);
    expect(textOf(html)).toContain(WELCOME.typeLabel);
    expect(textOf(html)).toContain(WELCOME.reference);
    expectNoMain(html);
  });
});

describe("LaunchReadiness", () => {
  it("renders a labelled ordered checklist with every item attribute", () => {
    const html = renderToStaticMarkup(<LaunchReadiness items={READINESS} />);
    const section = rootOf(html);
    expect(section.name).toBe("section");
    expect(section.attrs["data-testid"]).toBe("launch-readiness");
    expect(section.attrs["aria-labelledby"]).toBe("launch-readiness-title");
    expect(tagById(html, "launch-readiness-title").name).toBe("h2");
    expect(textsOf(html, "h2")).toEqual([LOCKED.editor.launchReadiness]);
    expect(tagsNamed(html, "h3")).toHaveLength(0);
    expectUniqueIds(html);
    expectReferencesResolve(html);
    expectNoMain(html);

    // role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none.
    expect(onlyTag(html, "ol").attrs.role).toBe("list");
    const items = elementsWhere(html, (tag) => tag.name === "li");
    expect(items).toHaveLength(READINESS.length);

    READINESS.forEach((item, index) => {
      const markup = items[index];
      const li = rootOf(markup);
      expect(li.attrs).toMatchObject({
        "data-testid": `readiness-item-${item.id}`,
        "data-state": item.state,
        "data-current": String(item.isCurrent),
        "data-just-completed": String(item.justCompleted),
        "data-needs-attention": String(item.needsAttention),
      });
      expect(li.attrs).not.toHaveProperty("aria-current");

      const [link, ...otherLinks] = linksIn(markup);
      expect(otherLinks).toHaveLength(0);
      expect(link.href).toBe(item.href);
      expect(link.text).toBe(item.label);
      if (item.isCurrent) {
        expect(link.attrs["aria-current"]).toBe("step");
      } else {
        expect(link.attrs).not.toHaveProperty("aria-current");
      }

      const text = textOf(markup);
      expect(text).toContain(item.stateLabel);
      expect(text).toContain(item.progressText);
      expect(text.includes(COPY.readiness.needsAttention)).toBe(item.needsAttention);
      // The current section is named in visible text, not only by its sky fill and the link's aria-current.
      expect(text.includes(COPY.readiness.current)).toBe(item.isCurrent);

      // The state, progress, and attention text describe the link.
      const description = link.attrs["aria-describedby"]
        .split(" ")
        .map((id) => textOf(elementsWhere(markup, (tag) => tag.attrs.id === id)[0]))
        .join(" ");
      expect(description).toContain(item.stateLabel);
      expect(description).toContain(item.progressText);
      expect(description.includes(COPY.readiness.needsAttention)).toBe(item.needsAttention);

      const lines = parseTags(markup).filter((tag) => "data-progress-line" in tag.attrs);
      expect(lines.map((tag) => tag.attrs["aria-hidden"])).toEqual(["true"]);
      expect(tagsNamed(markup, "svg").length).toBeGreaterThan(0);
      expectDecorativeIcons(markup);
    });

    const current = parseTags(html).filter((tag) => tag.attrs["aria-current"] !== undefined);
    expect(current.map((tag) => [tag.name, tag.attrs.href])).toEqual([["a", READINESS[1].href]]);
  });

  it("renders an h3 with a custom heading id for the review step", () => {
    const html = renderToStaticMarkup(
      <LaunchReadiness items={READINESS} headingLevel={3} headingId="review-readiness-title" />,
    );
    expect(rootOf(html).attrs["aria-labelledby"]).toBe("review-readiness-title");
    expect(tagById(html, "review-readiness-title").name).toBe("h3");
    expect(textsOf(html, "h3")).toEqual([LOCKED.editor.launchReadiness]);
    expect(tagsNamed(html, "h2")).toHaveLength(0);
    expectReferencesResolve(html);
  });

  it("keeps ids unique when two checklists use different heading ids", () => {
    const html = renderToStaticMarkup(
      <>
        <LaunchReadiness items={READINESS} />
        <LaunchReadiness items={READINESS} headingLevel={3} headingId="review-readiness-title" />
      </>,
    );
    expectUniqueIds(html);
    expectReferencesResolve(html);
  });

  it("attaches onSelect only when provided and passes the item and event", () => {
    const withoutHandler = elementsOfType(LaunchReadiness({ items: READINESS }), AppLink);
    expect(withoutHandler.map((link) => link.props.onClick)).toEqual(READINESS.map(() => undefined));

    const onSelect = vi.fn();
    const links = elementsOfType(LaunchReadiness({ items: READINESS, onSelect }), AppLink);
    expect(links).toHaveLength(READINESS.length);
    const event = { preventDefault: vi.fn() };
    (links[1].props.onClick as (event: unknown) => void)(event);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(READINESS[1], event);
  });
});

describe("ProgressCard", () => {
  it("renders the progress bar, the next step, the last-saved time, and the call to action", () => {
    const { progress } = DRAFT_VIEW;
    const html = renderToStaticMarkup(<ProgressCard view={progress} />);
    const card = rootOf(html);
    expect(card.name).toBe("section");
    expect(card.attrs["data-testid"]).toBe("progress-card");
    expect(tagById(html, card.attrs["aria-labelledby"]).name).toBe("h2");
    expect(textsOf(html, "h2")).toEqual([COPY.portal.progressTitle]);
    expectReferencesResolve(html);
    expectNoMain(html);

    const bar = parseTags(html).filter((tag) => tag.attrs.role === "progressbar");
    expect(bar).toHaveLength(1);
    expect(bar[0].attrs["aria-valuenow"]).toBe("40");
    expect(bar[0].attrs["aria-valuetext"]).toBe(COPY.portal.progressValue(40));

    const text = textOf(html);
    expect(text).toContain(COPY.portal.nextStep);
    expect(hrefsAndTexts(html)).toEqual([
      [progress.nextStep?.href, progress.nextStep?.label],
      [progress.cta.href, progress.cta.label],
    ]);
    expect(onlyTag(html, "time").attrs.datetime).toBe(SAVED_AT.iso);
    expect(text).toContain(`${COPY.portal.lastSaved} ${SAVED_AT.label}`);
    expect(text).not.toContain(COPY.portal.notSaved);
  });

  it("shows the not-saved fallback and omits the next-step line when they are absent", () => {
    const cta = { label: COPY.portal.startCta, href: "/portal/application?section=about" };
    const html = renderToStaticMarkup(
      <ProgressCard
        view={{ percent: 0, valueText: COPY.portal.progressValue(0), nextStep: null, lastSaved: null, cta }}
      />,
    );
    expect(tagsNamed(html, "time")).toHaveLength(0);
    expect(textOf(html)).toContain(COPY.portal.notSaved);
    expect(textOf(html)).not.toContain(COPY.portal.nextStep);
    expect(hrefsAndTexts(html)).toEqual([[cta.href, cta.label]]);
  });
});

describe("DeadlineCard", () => {
  it("shows to be announced without a time element while the deadline is unset", () => {
    const html = renderToStaticMarkup(<DeadlineCard deadline={null} />);
    const card = rootOf(html);
    expect(card.attrs["data-testid"]).toBe("deadline-card");
    expect(tagById(html, card.attrs["aria-labelledby"]).name).toBe("h2");
    expect(textsOf(html, "h2")).toEqual([COPY.portal.deadlineTitle]);
    expect(textOf(html)).toContain(COPY.portal.deadlineTba);
    expect(tagsNamed(html, "time")).toHaveLength(0);
    expectDecorativeIcons(html);
  });

  it("renders a time element for a set deadline", () => {
    const html = renderToStaticMarkup(<DeadlineCard deadline={DEADLINE} />);
    expect(onlyTag(html, "time").attrs.datetime).toBe(DEADLINE.iso);
    expect(textOf(html)).toContain(DEADLINE.label);
    expect(textOf(html)).not.toContain(COPY.portal.deadlineTba);
  });
});

describe("SubmittedStatusCard", () => {
  it("renders the status, the launch time, and the mission and application links", () => {
    const html = renderToStaticMarkup(<SubmittedStatusCard view={SUBMITTED_VIEW} />);
    const card = rootOf(html);
    expect(card.attrs["data-testid"]).toBe("submitted-card");
    expect(tagById(html, card.attrs["aria-labelledby"]).name).toBe("h2");
    expect(textsOf(html, "h2")).toEqual([COPY.portal.statusTitle]);
    expect(parseTags(html).filter((tag) => "data-status" in tag.attrs).map((tag) => tag.attrs["data-status"])).toEqual([
      "submitted",
    ]);
    expect(textOf(html)).toContain(SUBMITTED_VIEW.statusLabel);
    expect(onlyTag(html, "time").attrs.datetime).toBe(LAUNCHED_AT.iso);
    expect(textOf(html)).toContain(`${COPY.portal.launched} ${LAUNCHED_AT.label}`);
    expect(hrefsAndTexts(html)).toEqual([
      [ROUTES.portalMission, LOCKED.portal.trackMission],
      [ROUTES.portalApplication, COPY.portal.viewApplication],
    ]);
    expectDecorativeIcons(html);
  });

  it("omits the launch time when none is recorded", () => {
    const html = renderToStaticMarkup(<SubmittedStatusCard view={{ ...SUBMITTED_VIEW, launched: null }} />);
    expect(tagsNamed(html, "time")).toHaveLength(0);
    expect(textOf(html)).not.toContain(COPY.portal.launched);
  });
});

describe("PortalDraftDashboard", () => {
  it("composes the welcome, progress, deadline, readiness, and art in reading order", () => {
    const html = renderToStaticMarkup(<PortalDraftDashboard view={DRAFT_VIEW} />);
    expectNoMain(html);
    expect(textsOf(html, "h1")).toEqual([WELCOME.greeting]);
    expectHeadingOutline(html, 1);
    expectUniqueIds(html);
    expectReferencesResolve(html);
    expectDecorativeIcons(html);

    expect(testIdsIn(html).filter((testId) => !testId.startsWith("readiness-item-"))).toEqual([
      "progress-card",
      "deadline-card",
      "launch-readiness",
    ]);
    expect(tagById(html, "launch-readiness-title").name).toBe("h2");
    for (const item of READINESS) {
      byTestId(html, `readiness-item-${item.id}`);
    }
    expect(textOf(byTestId(html, "deadline-card"))).toContain(COPY.portal.deadlineTba);
    const art = parseTags(html).filter((tag) => tag.attrs["data-variant"] === "dashboard");
    expect(art.map((tag) => tag.attrs["aria-hidden"])).toEqual(["true"]);
  });
});

describe("PortalSubmittedDashboard", () => {
  it("replaces the editing controls with the status card and the mission link", () => {
    const html = renderToStaticMarkup(<PortalSubmittedDashboard view={SUBMITTED_VIEW} />);
    expectNoMain(html);
    expect(textsOf(html, "h1")).toEqual([WELCOME.greeting]);
    expectHeadingOutline(html, 1);
    expectUniqueIds(html);
    expectReferencesResolve(html);

    expect(testIdsIn(html)).toEqual(["submitted-card", "deadline-card"]);
    expect(parseTags(html).some((tag) => tag.attrs.role === "progressbar")).toBe(false);
    const trackLinks = linksIn(html).filter((link) => link.text === LOCKED.portal.trackMission);
    expect(trackLinks.map((link) => link.href)).toEqual([ROUTES.portalMission]);
    const deadlineTimes = tagsNamed(byTestId(html, "deadline-card"), "time");
    expect(deadlineTimes.map((tag) => tag.attrs.datetime)).toEqual([DEADLINE.iso]);
  });
});

// ---------------------------------------------------------------------------
// Mission
// ---------------------------------------------------------------------------

describe("MissionTracker", () => {
  it.each(MISSION_CASES)("renders the %s mission from its real status and timestamps", (name) => {
    const view = MISSION_VIEWS[name];
    const html = renderToStaticMarkup(<MissionTracker view={view} {...TRACKER_PROPS} />);

    const root = rootOf(html);
    expect(root.attrs["data-testid"]).toBe("mission-tracker");
    expect(root.attrs["data-stage"]).toBe(view.stage);
    expectNoMain(html);
    expect(textsOf(html, "h1")).toEqual([view.headline]);
    expectHeadingOutline(html, 1);
    expectUniqueIds(html);
    expectReferencesResolve(html);
    expectDecorativeIcons(html);
    expectNoPercentagesOrEstimates(html);

    const [back] = linksIn(html);
    expect([back.href, back.text]).toEqual([ROUTES.portal, COPY.mission.backToPortal]);
    expect(tagsNamed(back.markup, "svg")).toHaveLength(1);

    // The first status badge is the tracker's; a decision card adds its own after it.
    const badges = parseTags(html).filter((tag) => "data-status" in tag.attrs && !("data-testid" in tag.attrs));
    expect(badges[0].attrs["data-status"]).toBe(view.status);
    const text = textOf(html);
    expect(text).toContain(view.statusLabel);
    for (const note of [COPY.mission.received, COPY.mission.reviewNote]) {
      expect(text.includes(note)).toBe(note === view.reviewNote);
    }

    const rocket = parseTags(html).filter((tag) => "data-stage" in tag.attrs && tag.attrs["aria-hidden"] === "true");
    expect(rocket.map((tag) => tag.attrs["data-stage"])).toEqual([view.stage]);

    const legList = onlyTag(html, "ol");
    expect(legList.attrs["aria-label"]).toBe(COPY.mission.progressLabel);
    // role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none.
    expect(legList.attrs.role).toBe("list");
    const legs = elementsWhere(html, (tag) => tag.name === "li");
    expect(legs).toHaveLength(3);
    view.legs.forEach((leg, index) => {
      const markup = legs[index];
      const item = rootOf(markup);
      expect(item.attrs["data-testid"]).toBe(`mission-leg-${leg.leg}`);
      expect(item.attrs["data-state"]).toBe(leg.state);
      expect(textsOf(markup, "h2")).toEqual([leg.name]);
      const legText = textOf(markup);
      expect(legText).toContain(leg.stateLabel);
      if (leg.detail) {
        expect(legText).toContain(leg.detail);
      }
      const times = tagsNamed(markup, "time");
      if (leg.time) {
        expect(times.map((tag) => tag.attrs.datetime)).toEqual([leg.time.iso]);
        expect(legText).toContain(`${leg.timePrefix} ${leg.time.label}`);
      } else {
        expect(times).toHaveLength(0);
      }
    });

    const currentLeg = CURRENT_LEG[name];
    const current = parseTags(html).filter((tag) => tag.attrs["aria-current"] !== undefined);
    expect(current.map((tag) => [tag.name, tag.attrs["aria-current"], tag.attrs["data-testid"]])).toEqual(
      currentLeg ? [["li", "step", `mission-leg-${currentLeg}`]] : [],
    );

    const decisionCards = elementsWhere(html, (tag) => tag.attrs["data-testid"] === "decision-card");
    const landing = parseTags(html).filter((tag) => "data-decision" in tag.attrs);
    if (view.decision) {
      expect(decisionCards).toHaveLength(1);
      const card = rootOf(decisionCards[0]);
      expect(card.attrs["data-status"]).toBe(view.decision.status);
      expect(card.attrs["data-reveal"]).toBe("after-landing");
      expect(textsOf(decisionCards[0], "h2")).toEqual([view.decision.label]);
      expect(textOf(decisionCards[0])).toContain(view.decision.message);
      expect(landing.map((tag) => [tag.attrs["data-decision"], tag.attrs["aria-hidden"]])).toEqual([
        [view.decision.status, "true"],
      ]);
    } else {
      expect(decisionCards).toHaveLength(0);
      expect(landing).toHaveLength(0);
      expect(parseTags(html).some((tag) => "data-reveal" in tag.attrs)).toBe(false);
    }
  });

  it("maps every mission stage to a rocket scene", () => {
    const scenes = { assembly: "launch", launch: "launch", cruise: "cruise", landing: "landing" } as const;
    expect(Object.keys(scenes).sort()).toEqual([...MISSION_STAGES].sort());
    for (const stage of MISSION_STAGES) {
      const view = { ...MISSION_VIEWS.submitted, stage };
      const html = renderToStaticMarkup(<MissionTracker view={view} {...TRACKER_PROPS} />);
      expect(rootOf(html).attrs["data-stage"]).toBe(stage);
      const rocket = parseTags(html).filter((tag) => "data-stage" in tag.attrs && tag.attrs["aria-hidden"] === "true");
      expect(rocket.map((tag) => tag.attrs["data-stage"])).toEqual([scenes[stage]]);
    }
  });
});

describe("DecisionCard", () => {
  it.each(["accepted", "waitlisted"] as const)(
    "renders the %s decision in the DOM with the after-landing reveal hook",
    (status) => {
      const decision = decisionView(status);
      const html = renderToStaticMarkup(<DecisionCard decision={decision} releasedPrefix={COPY.mission.released} />);
      const root = rootOf(html);
      expect(root.name).toBe("section");
      expect(root.attrs).toMatchObject({
        "data-testid": "decision-card",
        "data-status": status,
        "data-reveal": "after-landing",
      });
      expect(tagById(html, root.attrs["aria-labelledby"]).name).toBe("h2");
      expect(textsOf(html, "h2")).toEqual([decision.label]);
      // The card and its status badge both carry the status.
      expect(parseTags(html).filter((tag) => tag.attrs["data-status"] === status)).toHaveLength(2);
      const text = textOf(html);
      expect(text).toContain(decision.message);
      expect(text).toContain(`${COPY.mission.released} ${RELEASED_AT.label}`);
      expect(onlyTag(html, "time").attrs.datetime).toBe(RELEASED_AT.iso);
      expectDecorativeIcons(html);
      expectNoPercentagesOrEstimates(html);
      expectNoMain(html);
    },
  );

  it("omits the release time when none is recorded", () => {
    const html = renderToStaticMarkup(
      <DecisionCard
        decision={{ ...decisionView("accepted"), releasedAt: null }}
        releasedPrefix={COPY.mission.released}
      />,
    );
    expect(tagsNamed(html, "time")).toHaveLength(0);
    expect(textOf(html)).not.toContain(COPY.mission.released);
  });
});

// ---------------------------------------------------------------------------
// Styling guard
// ---------------------------------------------------------------------------

// Matches a data or aria attribute variant whose value holds an underscore, such as a state value of in_progress.
const UNDERSCORE_ATTRIBUTE_VARIANT = /(?:data|aria)-\[[^\]=]+=[^\]]*_[^\]]*\]/g;

describe("component class names", () => {
  // Tailwind reads an underscore in an arbitrary value as a space, so such a variant compiles to a selector like
  // [data-state="in progress"] and never styles the element. The readiness progress line once lost its fill this way.
  it("never put an underscore in a data or aria attribute variant value", () => {
    const root = path.join(process.cwd(), "components");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((name) => /\.tsx?$/.test(name));
    const offenders: string[] = [];
    for (const file of files) {
      for (const match of readFileSync(path.join(root, file), "utf8").matchAll(UNDERSCORE_ATTRIBUTE_VARIANT)) {
        offenders.push(`components/${file.split(path.sep).join("/")}: ${match[0]}`);
      }
    }
    expect(files.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("recognizes the variant shape it guards against", () => {
    const sample = "group-data-[state=complete]:bg-success group-data-[state=in_progress]:bg-highlight";
    expect([...sample.matchAll(UNDERSCORE_ATTRIBUTE_VARIANT)].map((match) => match[0])).toEqual([
      "data-[state=in_progress]",
    ]);
    expect("md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] data-[current=true]:bg-accent").not.toMatch(
      new RegExp(UNDERSCORE_ATTRIBUTE_VARIANT.source),
    );
  });
});

// ---------------------------------------------------------------------------
// Development gallery
// ---------------------------------------------------------------------------

describe("GallerySection", () => {
  it("is a section labelled by its h2", () => {
    const html = renderToStaticMarkup(
      <GallerySection id="gallery-mission" title="Mission tracker" description="Every launched status.">
        <p data-testid="gallery-child">{LOCKED.mission.cruising}</p>
      </GallerySection>,
    );
    const root = rootOf(html);
    expect(root.name).toBe("section");
    expect(root.attrs["aria-labelledby"]).toBe("gallery-mission");
    expect(tagById(html, "gallery-mission").name).toBe("h2");
    expect(textsOf(html, "h2")).toEqual(["Mission tracker"]);
    expect(textOf(html)).toContain("Every launched status.");
    byTestId(html, "gallery-child");
    expectNoMain(html);
  });

  it("omits the description when none is passed", () => {
    const html = renderToStaticMarkup(
      <GallerySection id="gallery-art" title="Art slots">
        <span>{LOCKED.brand}</span>
      </GallerySection>,
    );
    expect(textOf(html)).toBe(`Art slots${LOCKED.brand}`);
    expect(tagsNamed(html, "p")).toHaveLength(0);
  });
});
