import { createRef, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnswerSummary } from "@/components/application/AnswerSummary";
import { EditorHeader } from "@/components/application/EditorHeader";
import { EditorLayout } from "@/components/application/EditorLayout";
import { LaunchTransition } from "@/components/application/LaunchTransition";
import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { SaveStatus } from "@/components/application/SaveStatus";
import { SectionNav } from "@/components/application/SectionNav";
import { SectionPanel } from "@/components/application/SectionPanel";
import { SectionSelect } from "@/components/application/SectionSelect";
import { SubmittedApplicationView } from "@/components/application/SubmittedApplicationView";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Form } from "@/components/ui/Form";
import { COPY, LOCKED } from "@/content/copy";
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from "@/lib/application-config";
import type {
  AnswerSectionView,
  SaveStatusState,
  SaveStatusView,
  SectionNavItemView,
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
// Helpers
// ---------------------------------------------------------------------------

interface Tag {
  name: string;
  attrs: Record<string, string>;
}

type AnyElement = ReactElement<Record<string, unknown>>;

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Start tags in document order with decoded attributes. Names are lowercased because HTML ignores their case. */
function parseTags(html: string): Tag[] {
  const tags: Tag[] = [];
  for (const match of html.matchAll(/<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const attribute of match[2].matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) {
      attrs[attribute[1].toLowerCase()] = decodeEntities(attribute[2] ?? "");
    }
    tags.push({ name: match[1].toLowerCase(), attrs });
  }
  return tags;
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

function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ""));
}

/** Outer markup of every `<name>` element, in order. Use only for elements that never nest inside themselves. */
function markupOf(html: string, name: string): string[] {
  const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>[\\s\\S]*?</${name}>`, "g");
  return [...html.matchAll(pattern)].map((match) => match[0]);
}

function classesOf(tag: Tag): string[] {
  return (tag.attrs.class ?? "").split(/\s+/).filter(Boolean);
}

/** The `data-slot` markers the tests pass into view slots, in document order. */
function slotOrder(html: string): string[] {
  return parseTags(html).flatMap((tag) => (tag.attrs["data-slot"] ? [tag.attrs["data-slot"]] : []));
}

/** The start tag directly before a slot marker, which is the element that wraps the slot. */
function wrapperOfSlot(html: string, slot: string): Tag {
  const tags = parseTags(html);
  const index = tags.findIndex((tag) => tag.attrs["data-slot"] === slot);
  expect(index, `slot ${slot} has a wrapper`).toBeGreaterThan(0);
  return tags[index - 1];
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

function click(element: AnyElement, event: unknown = { preventDefault: vi.fn() }): void {
  (element.props.onClick as (event: unknown) => void)(event);
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
  // Any React warning (controlled fields, keys, invalid attributes) fails the test.
  expect(consoleErrors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Hand-built view models (never the builders, so these tests pin the views alone)
// ---------------------------------------------------------------------------

const SAVED_AT: TimestampView = { iso: "2026-09-10T22:04:00.000Z", label: "Sep 10, 2026, 3:04 PM PDT" };
const LAUNCHED_AT: TimestampView = { iso: "2026-09-11T01:30:00.000Z", label: "Sep 10, 2026, 6:30 PM PDT" };

const NAV_ITEMS: SectionNavItemView[] = [
  {
    step: "about",
    label: "About you",
    state: "complete",
    stateLabel: COPY.readiness.states.complete,
    isActive: false,
    needsAttention: false,
    justCompleted: true,
    href: "/portal/application?section=about",
  },
  {
    step: "education",
    label: "Education",
    state: "in_progress",
    stateLabel: COPY.readiness.states.in_progress,
    isActive: true,
    needsAttention: true,
    justCompleted: false,
    href: "/portal/application?section=education",
  },
  {
    step: "experience",
    label: "Experience",
    state: "not_started",
    stateLabel: COPY.readiness.states.not_started,
    isActive: false,
    needsAttention: false,
    justCompleted: false,
    href: "/portal/application?section=experience",
  },
  {
    step: "review",
    label: COPY.editor.reviewStep,
    state: "review",
    stateLabel: COPY.readiness.states.not_started,
    isActive: false,
    needsAttention: false,
    justCompleted: false,
    href: "/portal/application?section=review",
  },
];

const LINKS = ["https://example.com/ada", "https://github.com/ada/analytical-engine"];
const SCHOOL_ERROR = "Enter your school.";
const YEAR_ERROR = COPY.editor.hints.wholeNumber(2020, 2035);

const EDITABLE_SECTIONS: AnswerSectionView[] = [
  {
    id: "about",
    label: "About you",
    editLabel: COPY.review.editSection("About you"),
    editHref: "/portal/application?section=about",
    answers: [
      { key: "preferredName", label: "Preferred name", value: "Ada", missingText: null, errors: [] },
      { key: "bio", label: "Bio", value: null, missingText: COPY.review.notAnswered, errors: [] },
      { key: "links", label: "Links", value: LINKS, missingText: null, errors: [] },
    ],
  },
  {
    id: "education",
    label: "Education",
    editLabel: COPY.review.editSection("Education"),
    editHref: "/portal/application?section=education",
    answers: [
      {
        key: "school",
        label: "School",
        value: null,
        missingText: COPY.review.notAnsweredRequired,
        errors: [SCHOOL_ERROR],
      },
      { key: "graduationYear", label: "Graduation year", value: "1900", missingText: null, errors: ["", YEAR_ERROR] },
    ],
  },
];

const LOCKED_SECTIONS: AnswerSectionView[] = EDITABLE_SECTIONS.map((section) => ({
  ...section,
  editLabel: null,
  editHref: null,
}));

// ---------------------------------------------------------------------------
// EditorLayout
// ---------------------------------------------------------------------------

describe("EditorLayout", () => {
  function renderLayout(slots: { notices?: ReactNode; rail?: ReactNode }): string {
    return renderToStaticMarkup(
      <EditorLayout
        header={<div data-slot="header" />}
        progress={<div data-slot="progress" />}
        nav={<nav data-slot="nav" aria-label={COPY.editor.sectionNavLabel} />}
        mobileNav={<div data-slot="mobileNav" />}
        notices={slots.notices}
        rail={slots.rail}
      >
        <div data-slot="content" />
      </EditorLayout>,
    );
  }

  it("renders every slot in the frozen DOM order and no main landmark", () => {
    const html = renderLayout({ notices: <div data-slot="notices" />, rail: <div data-slot="rail" /> });
    expect(slotOrder(html)).toEqual(["header", "progress", "mobileNav", "nav", "notices", "content", "rail"]);
    expect(tagsNamed(html, "main")).toHaveLength(0);
    expect(html).not.toContain('id="main"');

    const aside = onlyTag(html, "aside");
    expect(aside.attrs["aria-label"]).toBe(COPY.editor.railLabel);
    expect(wrapperOfSlot(html, "rail")).toEqual(aside);
  });

  it("exposes one section navigation per breakpoint: the select below lg, the sticky list from lg up", () => {
    const html = renderLayout({});
    expect(classesOf(wrapperOfSlot(html, "mobileNav"))).toContain("lg:hidden");
    expect(classesOf(wrapperOfSlot(html, "nav"))).toEqual(expect.arrayContaining(["hidden", "lg:block", "lg:sticky"]));
  });

  it("renders the rail landmark only when a rail is provided", () => {
    const html = renderLayout({});
    expect(slotOrder(html)).toEqual(["header", "progress", "mobileNav", "nav", "content"]);
    expect(tagsNamed(html, "aside")).toHaveLength(0);
    expect(tagsNamed(html, "main")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// EditorHeader
// ---------------------------------------------------------------------------

describe("EditorHeader", () => {
  it("renders a back link with a hidden arrow, then the page h1 and the status badge", () => {
    const title = COPY.editor.title(APPLICATION_TYPE_LABELS.hacker);
    const html = renderToStaticMarkup(
      <EditorHeader
        title={title}
        status="draft"
        statusLabel={APPLICATION_STATUS_LABELS.draft}
        backHref="/portal"
        backLabel={COPY.editor.backToPortal}
      />,
    );

    const link = onlyTag(html, "a");
    expect(link.attrs.href).toBe("/portal");
    expect(link.attrs["data-guarded"]).toBe("true");
    const [linkMarkup] = markupOf(html, "a");
    expect(textOf(linkMarkup)).toBe(COPY.editor.backToPortal);
    expect(tagsNamed(linkMarkup, "svg").map((svg) => svg.attrs["aria-hidden"])).toEqual(["true"]);

    expect(markupOf(html, "h1").map(textOf)).toEqual([title]);
    const tags = parseTags(html);
    const badgeIndex = tags.findIndex((tag) => tag.attrs["data-status"] === "draft");
    expect(badgeIndex).toBeGreaterThan(-1);
    expect(textOf(html)).toContain(APPLICATION_STATUS_LABELS.draft);

    const linkIndex = tags.findIndex((tag) => tag.name === "a");
    const headingIndex = tags.findIndex((tag) => tag.name === "h1");
    expect(linkIndex).toBeLessThan(headingIndex);
    expect(headingIndex).toBeLessThan(badgeIndex);
  });
});

// ---------------------------------------------------------------------------
// SectionNav
// ---------------------------------------------------------------------------

describe("SectionNav", () => {
  const renderNav = () => renderToStaticMarkup(<SectionNav label={COPY.editor.sectionNavLabel} items={NAV_ITEMS} />);

  it("is a labelled navigation landmark with an ordered list carrying each step's state attributes", () => {
    const html = renderNav();
    const nav = onlyTag(html, "nav");
    expect(nav.attrs["aria-label"]).toBe(COPY.editor.sectionNavLabel);
    expect(nav.attrs["data-testid"]).toBe("section-nav");
    expect(tagsNamed(html, "ol")).toHaveLength(1);

    const items = tagsNamed(html, "li");
    expect(items.map((item) => item.attrs["data-state"])).toEqual(["complete", "in_progress", "not_started", "review"]);
    expect(items.map((item) => item.attrs["data-needs-attention"])).toEqual(["false", "true", "false", "false"]);
    expect(items.map((item) => item.attrs["data-just-completed"])).toEqual(["true", "false", "false", "false"]);
  });

  it("links every step and marks only the active one with aria-current=step", () => {
    const links = tagsNamed(renderNav(), "a");
    expect(links.map((link) => link.attrs.href)).toEqual(NAV_ITEMS.map((item) => item.href));
    expect(links.map((link) => link.attrs["aria-current"])).toEqual([undefined, "step", undefined, undefined]);
    expect(links.every((link) => link.attrs["data-guarded"] === "true")).toBe(true);
  });

  it("names each link with its label and state, flags attention in text, and always shows the state icon", () => {
    const html = renderNav();
    expect(markupOf(html, "a").map(textOf)).toEqual([
      `About you ${COPY.readiness.states.complete}`,
      `Education ${COPY.readiness.states.in_progress} ${COPY.readiness.needsAttention}`,
      `Experience ${COPY.readiness.states.not_started}`,
      `${COPY.editor.reviewStep} ${COPY.readiness.states.not_started}`,
    ]);

    // Each step leads with its state icon; needing attention adds an alert icon beside that text, never replacing it.
    const icons = markupOf(html, "li").map((item) =>
      tagsNamed(item, "svg").map((svg) => [
        svg.attrs["aria-hidden"],
        classesOf(svg).find((name) => name.startsWith("lucide-")),
      ]),
    );
    expect(icons).toEqual([
      [["true", "lucide-check"]],
      [
        ["true", "lucide-circle-dot"],
        ["true", "lucide-circle-alert"],
      ],
      [["true", "lucide-circle"]],
      [["true", "lucide-rocket"]],
    ]);
  });

  it("attaches link handlers only with onSelect and passes the item and the event", () => {
    const withoutHandler = elementsOfType(
      SectionNav({ label: COPY.editor.sectionNavLabel, items: NAV_ITEMS }),
      AppLink,
    );
    expect(withoutHandler).toHaveLength(NAV_ITEMS.length);
    expect(withoutHandler.map((link) => link.props.onClick)).toEqual(NAV_ITEMS.map(() => undefined));

    const onSelect = vi.fn();
    const links = elementsOfType(
      SectionNav({ label: COPY.editor.sectionNavLabel, items: NAV_ITEMS, onSelect }),
      AppLink,
    );
    const event = { preventDefault: vi.fn() };
    click(links[2], event);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(NAV_ITEMS[2], event);
  });
});

// ---------------------------------------------------------------------------
// SectionSelect
// ---------------------------------------------------------------------------

describe("SectionSelect", () => {
  const baseProps = {
    id: "editor-section-select",
    label: COPY.editor.sectionSelectLabel,
    items: NAV_ITEMS,
    value: "education",
    goLabel: COPY.editor.goToSection,
  };

  it("renders a labelled native select with one option per step and a type=button Go button", () => {
    const html = renderToStaticMarkup(<SectionSelect {...baseProps} />);
    expect(onlyTag(html, "label").attrs.for).toBe("editor-section-select");
    expect(markupOf(html, "label").map(textOf)).toEqual([COPY.editor.sectionSelectLabel]);

    const select = onlyTag(html, "select");
    expect(select.attrs.id).toBe("editor-section-select");
    expect(select.attrs["data-testid"]).toBe("section-select");

    const options = tagsNamed(html, "option");
    expect(options.map((option) => option.attrs.value)).toEqual(["about", "education", "experience", "review"]);
    expect(markupOf(html, "option").map(textOf)).toEqual(NAV_ITEMS.map((item) => `${item.label} (${item.stateLabel})`));
    expect(options.map((option) => "selected" in option.attrs)).toEqual([false, true, false, false]);

    const go = onlyTag(html, "button");
    expect(go.attrs.type).toBe("button");
    expect(go.attrs["data-testid"]).toBe("section-go");
    expect(markupOf(html, "button").map(textOf)).toEqual([COPY.editor.goToSection]);
  });

  it("is controlled with onChange only when onValueChange is provided, and uncontrolled otherwise", () => {
    const onValueChange = vi.fn();
    const [controlled] = elementsOfType(SectionSelect({ ...baseProps, onValueChange }), "select");
    expect(controlled.props.value).toBe("education");
    expect(controlled.props).not.toHaveProperty("defaultValue");
    (controlled.props.onChange as (event: unknown) => void)({ target: { value: "review" } });
    expect(onValueChange).toHaveBeenCalledWith("review");

    const [uncontrolled] = elementsOfType(SectionSelect(baseProps), "select");
    expect(uncontrolled.props.defaultValue).toBe("education");
    expect(uncontrolled.props).not.toHaveProperty("value");
    expect(uncontrolled.props.onChange).toBeUndefined();

    // Both modes must render without React's controlled-field warning; afterEach fails on any console.error.
    const controlledHtml = renderToStaticMarkup(<SectionSelect {...baseProps} onValueChange={onValueChange} />);
    const uncontrolledHtml = renderToStaticMarkup(<SectionSelect {...baseProps} />);
    for (const html of [controlledHtml, uncontrolledHtml]) {
      const selected = tagsNamed(html, "option").map((option) => "selected" in option.attrs);
      expect(selected).toEqual([false, true, false, false]);
    }
  });

  it("attaches the Go handler only with onGo and calls it without arguments", () => {
    const [withoutHandler] = elementsOfType(SectionSelect(baseProps), Button);
    expect(withoutHandler.props.onClick).toBeUndefined();

    const onGo = vi.fn();
    const [go] = elementsOfType(SectionSelect({ ...baseProps, onGo }), Button);
    click(go);
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(onGo).toHaveBeenCalledWith();
  });
});

// ---------------------------------------------------------------------------
// SectionPanel
// ---------------------------------------------------------------------------

describe("SectionPanel", () => {
  const actions = (
    <>
      <Button type="submit">{LOCKED.editor.saveAndContinue}</Button>
      <Button variant="secondary">{LOCKED.editor.saveDraft}</Button>
    </>
  );

  it("labels the section with a focusable h2 and puts the fields, then the actions, inside the form", () => {
    const html = renderToStaticMarkup(
      <SectionPanel
        step="education"
        headingId="section-heading-education"
        title="Education"
        intro={COPY.review.intro}
        actions={actions}
        onSubmit={vi.fn()}
      >
        <div data-slot="fields" />
      </SectionPanel>,
    );

    const section = onlyTag(html, "section");
    expect(section.attrs["aria-labelledby"]).toBe("section-heading-education");
    expect(section.attrs["data-step"]).toBe("education");
    const heading = tagById(html, "section-heading-education");
    expect(heading.name).toBe("h2");
    expect(heading.attrs.tabindex).toBe("-1");
    expect(markupOf(html, "h2").map(textOf)).toEqual(["Education"]);
    expect(markupOf(html, "p").map(textOf)).toEqual([COPY.review.intro]);

    const form = onlyTag(html, "form");
    expect(form.attrs).toHaveProperty("novalidate");
    expect(form.attrs["aria-labelledby"]).toBe("section-heading-education");

    const [formMarkup] = markupOf(html, "form");
    expect(formMarkup).not.toContain("<h2");
    const fieldsAt = formMarkup.indexOf('data-slot="fields"');
    expect(fieldsAt).toBeGreaterThan(-1);
    expect(formMarkup.indexOf("<button")).toBeGreaterThan(fieldsAt);
    expect(tagsNamed(formMarkup, "button").map((button) => button.attrs.type)).toEqual(["submit", "button"]);
  });

  it("passes onSubmit and formRef to the form", () => {
    const onSubmit = vi.fn();
    const formRef = createRef<HTMLFormElement>();
    const tree = SectionPanel({
      step: "about",
      headingId: "section-heading-about",
      title: "About you",
      children: null,
      actions,
      onSubmit,
      formRef,
    });
    const [form] = elementsOfType(tree, Form);
    expect(form.props.onSubmit).toBe(onSubmit);
    expect(form.props.ref).toBe(formRef);
    expect(form.props["aria-labelledby"]).toBe("section-heading-about");
  });

  it("renders the same content without a form when there is no onSubmit", () => {
    const html = renderToStaticMarkup(
      <SectionPanel
        step="review"
        headingId="section-heading-review"
        title={LOCKED.review.heading}
        intro={null}
        actions={actions}
      >
        <div data-slot="fields" />
      </SectionPanel>,
    );
    expect(tagsNamed(html, "form")).toHaveLength(0);
    expect(tagById(html, "section-heading-review").attrs.tabindex).toBe("-1");
    expect(onlyTag(html, "section").attrs["aria-labelledby"]).toBe("section-heading-review");
    expect(tagsNamed(html, "p")).toHaveLength(0);
    expect(html.indexOf("<button")).toBeGreaterThan(html.indexOf('data-slot="fields"'));
    expect(tagsNamed(html, "button")).toHaveLength(2);

    const tree = SectionPanel({
      step: "review",
      headingId: "section-heading-review",
      title: "t",
      children: null,
      actions,
    });
    expect(elementsOfType(tree, Form)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SaveStatus
// ---------------------------------------------------------------------------

describe("SaveStatus", () => {
  const TEXT = {
    saved: COPY.editor.saveStatus.saved,
    saving: COPY.editor.saveStatus.saving,
    dirty: COPY.editor.saveStatus.dirty,
    invalid: COPY.editor.saveStatus.invalid(2),
    error: COPY.editor.saveStatus.error,
    blocked: COPY.editor.saveStatus.blocked,
  } satisfies Record<SaveStatusState, string>;
  const VIEWS: SaveStatusView[] = (Object.keys(TEXT) as SaveStatusState[]).map((state) => ({
    state,
    text: TEXT[state],
  }));
  const UNSAVED_VIEWS = VIEWS.filter((view) => view.state !== "saved");

  function renderStatus(view: SaveStatusView, lastSaved: TimestampView | null): string {
    return renderToStaticMarkup(
      <SaveStatus view={view} lastSaved={lastSaved} lastSavedPrefix={COPY.editor.lastSaved} />,
    );
  }

  it("covers all six states", () => {
    expect(VIEWS.map((view) => view.state)).toEqual(["saved", "saving", "dirty", "invalid", "error", "blocked"]);
  });

  it.each(VIEWS)("renders $state as visible text with data-state, a hidden icon, and no live region", (view) => {
    const html = renderStatus(view, null);
    const tags = parseTags(html);
    expect(tags[0].attrs["data-testid"]).toBe("save-status");
    expect(tags[0].attrs["data-state"]).toBe(view.state);
    expect(tags.some((tag) => "role" in tag.attrs || "aria-live" in tag.attrs)).toBe(false);
    expect(onlyTag(html, "svg").attrs["aria-hidden"]).toBe("true");
    expect(textOf(html)).toBe(view.text);
    expect(tagsNamed(html, "time")).toHaveLength(0);
  });

  it("shows the last-saved time with its prefix in the saved state", () => {
    const html = renderStatus(VIEWS[0], SAVED_AT);
    expect(onlyTag(html, "time").attrs.datetime).toBe(SAVED_AT.iso);
    expect(textOf(html)).toBe(`${COPY.editor.saveStatus.saved} ${COPY.editor.lastSaved} ${SAVED_AT.label}`);
  });

  it.each(UNSAVED_VIEWS)("hides the last-saved time in the $state state", (view) => {
    const html = renderStatus(view, SAVED_AT);
    expect(tagsNamed(html, "time")).toHaveLength(0);
    expect(textOf(html)).toBe(view.text);
  });

  it("animates only the saving spinner, and only under motion-safe", () => {
    for (const view of VIEWS) {
      const classes = classesOf(onlyTag(renderStatus(view, null), "svg"));
      expect(classes).not.toContain("animate-spin");
      expect(classes.includes("motion-safe:animate-spin"), view.state).toBe(view.state === "saving");
    }
  });
});

// ---------------------------------------------------------------------------
// AnswerSummary
// ---------------------------------------------------------------------------

describe("AnswerSummary", () => {
  const ANSWERS = EDITABLE_SECTIONS.flatMap((section) => section.answers);

  it("renders an h3 and a dl of dt and dd pairs per section, with no form controls", () => {
    const html = renderToStaticMarkup(<AnswerSummary sections={EDITABLE_SECTIONS} />);
    expect(parseTags(html)[0].attrs["data-testid"]).toBe("answer-summary");
    expect(markupOf(html, "h3").map(textOf)).toEqual(["About you", "Education"]);
    expect(tagsNamed(html, "h2")).toHaveLength(0);
    expect(tagsNamed(html, "dl")).toHaveLength(EDITABLE_SECTIONS.length);
    expect(markupOf(html, "dt").map(textOf)).toEqual(ANSWERS.map((answer) => answer.label));
    expect(tagsNamed(html, "dd")).toHaveLength(ANSWERS.length);
    for (const name of ["form", "input", "select", "textarea", "button"]) {
      expect(tagsNamed(html, name), name).toHaveLength(0);
    }
  });

  it("shows strings, link lists as plain-text items, and missing-answer text", () => {
    const html = renderToStaticMarkup(<AnswerSummary sections={LOCKED_SECTIONS} />);
    const values = markupOf(html, "dd");
    expect(markupOf(values[0], "p").map(textOf)).toEqual(["Ada"]);
    expect(markupOf(values[1], "p").map(textOf)).toEqual([COPY.review.notAnswered]);
    // role="list" keeps the list semantics that Safari drops from unstyled lists.
    expect(onlyTag(values[2], "ul").attrs.role).toBe("list");
    expect(markupOf(values[2], "li").map(textOf)).toEqual(LINKS);
    expect(markupOf(values[3], "p")[0]).toBeDefined();
    expect(textOf(markupOf(values[3], "p")[0])).toBe(COPY.review.notAnsweredRequired);
    // Links are never clickable, and a locked summary has no edit links either.
    expect(tagsNamed(html, "a")).toHaveLength(0);
  });

  it("renders each non-empty error with a hidden icon and a visually hidden error prefix", () => {
    const html = renderToStaticMarkup(<AnswerSummary sections={EDITABLE_SECTIONS} />);
    const values = markupOf(html, "dd");
    expect(markupOf(values[3], "p").map(textOf)).toEqual([
      COPY.review.notAnsweredRequired,
      `${COPY.common.errorPrefix} ${SCHOOL_ERROR}`,
    ]);
    expect(markupOf(values[4], "p").map(textOf)).toEqual(["1900", `${COPY.common.errorPrefix} ${YEAR_ERROR}`]);

    for (const dd of [values[3], values[4]]) {
      const errorMarkup = markupOf(dd, "p").at(-1) ?? "";
      expect(tagsNamed(errorMarkup, "svg").map((svg) => svg.attrs["aria-hidden"])).toEqual(["true"]);
      expect(/<span class="sr-only">([^<]*)<\/span>/.exec(errorMarkup)?.[1]).toBe(`${COPY.common.errorPrefix} `);
    }
    for (const dd of values.slice(0, 3)) {
      expect(tagsNamed(dd, "svg")).toHaveLength(0);
    }
  });

  it("renders h2 section headings when headingLevel is 2, so a page h1 is not followed by h3", () => {
    const html = renderToStaticMarkup(<AnswerSummary sections={LOCKED_SECTIONS} headingLevel={2} />);
    expect(markupOf(html, "h2").map(textOf)).toEqual(["About you", "Education"]);
    expect(tagsNamed(html, "h3")).toHaveLength(0);
  });

  it("renders edit links only when a section has both an edit label and an edit href", () => {
    const html = renderToStaticMarkup(<AnswerSummary sections={EDITABLE_SECTIONS} />);
    const links = tagsNamed(html, "a");
    expect(links.map((link) => link.attrs.href)).toEqual(EDITABLE_SECTIONS.map((section) => section.editHref));
    expect(markupOf(html, "a").map(textOf)).toEqual(EDITABLE_SECTIONS.map((section) => section.editLabel));
    expect(links.some((link) => LINKS.includes(link.attrs.href))).toBe(false);

    const partial: AnswerSectionView[] = [
      { ...EDITABLE_SECTIONS[0], editLabel: null },
      { ...EDITABLE_SECTIONS[1], editHref: null },
    ];
    expect(tagsNamed(renderToStaticMarkup(<AnswerSummary sections={partial} />), "a")).toHaveLength(0);
  });

  it("attaches edit handlers only with onEdit and passes the section and the event", () => {
    const withoutHandler = elementsOfType(AnswerSummary({ sections: EDITABLE_SECTIONS }), AppLink);
    expect(withoutHandler.map((link) => link.props.onClick)).toEqual([undefined, undefined]);

    const onEdit = vi.fn();
    const links = elementsOfType(AnswerSummary({ sections: EDITABLE_SECTIONS, onEdit }), AppLink);
    const event = { preventDefault: vi.fn() };
    click(links[1], event);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(EDITABLE_SECTIONS[1], event);
  });
});

// ---------------------------------------------------------------------------
// ReviewSubmit
// ---------------------------------------------------------------------------

describe("ReviewSubmit", () => {
  const props = { noteId: "review-irreversible", note: LOCKED.review.irreversible, submitLabel: LOCKED.review.submit };

  it("describes the primary submit button with the irreversible note", () => {
    const html = renderToStaticMarkup(<ReviewSubmit {...props} pending={false} />);
    expect(parseTags(html)[0].attrs["data-testid"]).toBe("review-submit");

    const note = tagById(html, "review-irreversible");
    expect(note.name).toBe("p");
    expect(markupOf(html, "p").map(textOf)).toEqual([LOCKED.review.irreversible]);

    const button = onlyTag(html, "button");
    expect(button.attrs["aria-describedby"]).toBe(note.attrs.id);
    expect(button.attrs["data-variant"]).toBe("primary");
    expect(button.attrs.type).toBe("button");
    expect(button.attrs["data-pending"]).toBe("false");
    expect(button.attrs).not.toHaveProperty("aria-disabled");
    expect(button.attrs).not.toHaveProperty("disabled");
    expect(markupOf(html, "button").map(textOf)).toEqual([LOCKED.review.submit]);
  });

  it("keeps the button focusable, described, and labelled while pending", () => {
    const html = renderToStaticMarkup(<ReviewSubmit {...props} pending onSubmit={vi.fn()} />);
    const button = onlyTag(html, "button");
    expect(button.attrs["aria-disabled"]).toBe("true");
    expect(button.attrs["data-pending"]).toBe("true");
    expect(button.attrs).not.toHaveProperty("disabled");
    expect(button.attrs["aria-describedby"]).toBe("review-irreversible");
    expect(markupOf(html, "button").map(textOf)).toEqual([LOCKED.review.submit]);
  });

  it("attaches the submit handler only with onSubmit and calls it without arguments", () => {
    const [withoutHandler] = elementsOfType(ReviewSubmit({ ...props, pending: false }), Button);
    expect(withoutHandler.props.onClick).toBeUndefined();
    expect(withoutHandler.props.pending).toBe(false);

    const onSubmit = vi.fn();
    const [button] = elementsOfType(ReviewSubmit({ ...props, pending: true, onSubmit }), Button);
    expect(button.props.pending).toBe(true);
    click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith();
  });
});

// ---------------------------------------------------------------------------
// SubmittedApplicationView
// ---------------------------------------------------------------------------

describe("SubmittedApplicationView", () => {
  function renderSubmitted(launched: TimestampView | null, sections: AnswerSectionView[] = LOCKED_SECTIONS): string {
    return renderToStaticMarkup(
      <SubmittedApplicationView
        heading={COPY.submitted.title}
        status="submitted"
        statusLabel={APPLICATION_STATUS_LABELS.submitted}
        launched={launched}
        launchedPrefix={COPY.portal.launched}
        trackLabel={LOCKED.portal.trackMission}
        trackHref="/portal/mission"
        sections={sections}
        notice={<div data-slot="notice" />}
      />,
    );
  }

  it("renders the heading, status, launch time, notice, track link, and answers in order", () => {
    const html = renderSubmitted(LAUNCHED_AT);
    const tags = parseTags(html);
    expect(tags[0].attrs["data-testid"]).toBe("submitted-application");
    expect(markupOf(html, "h1").map(textOf)).toEqual([COPY.submitted.title]);
    expect(textOf(html)).toContain(APPLICATION_STATUS_LABELS.submitted);
    expect(onlyTag(html, "time").attrs.datetime).toBe(LAUNCHED_AT.iso);
    expect(textOf(html)).toContain(`${COPY.portal.launched} ${LAUNCHED_AT.label}`);

    const track = onlyTag(html, "a");
    expect(track.attrs.href).toBe("/portal/mission");
    expect(track.attrs["data-guarded"]).toBe("true");
    expect(markupOf(html, "a").map(textOf)).toEqual([LOCKED.portal.trackMission]);

    const order = [
      tags.findIndex((tag) => tag.name === "h1"),
      tags.findIndex((tag) => tag.attrs["data-status"] === "submitted"),
      tags.findIndex((tag) => tag.name === "time"),
      tags.findIndex((tag) => tag.attrs["data-slot"] === "notice"),
      tags.findIndex((tag) => tag.name === "a"),
      tags.findIndex((tag) => tag.attrs["data-testid"] === "answer-summary"),
    ];
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(tagsNamed(html, "dl")).toHaveLength(LOCKED_SECTIONS.length);
  });

  it("uses h2 section headings under the page h1, never skipping a heading level", () => {
    const html = renderSubmitted(LAUNCHED_AT);
    const headings = parseTags(html).filter((tag) => /^h[1-6]$/.test(tag.name));
    expect(headings.map((tag) => tag.name)).toEqual(["h1", "h2", "h2"]);
    expect(markupOf(html, "h2").map(textOf)).toEqual(LOCKED_SECTIONS.map((section) => section.label));
  });

  it("never renders edit links, even when given editable sections", () => {
    const html = renderSubmitted(LAUNCHED_AT, EDITABLE_SECTIONS);
    expect(tagsNamed(html, "a").map((link) => link.attrs.href)).toEqual(["/portal/mission"]);
    for (const section of EDITABLE_SECTIONS) {
      expect(textOf(html)).not.toContain(section.editLabel ?? "");
    }
  });

  it("renders no form controls", () => {
    const html = renderSubmitted(LAUNCHED_AT);
    for (const name of ["form", "input", "select", "textarea", "button"]) {
      expect(tagsNamed(html, name), name).toHaveLength(0);
    }
  });

  it("omits the launch time when there is none", () => {
    const html = renderSubmitted(null);
    expect(tagsNamed(html, "time")).toHaveLength(0);
    expect(textOf(html)).not.toContain(COPY.portal.launched);
  });
});

// ---------------------------------------------------------------------------
// LaunchTransition
// ---------------------------------------------------------------------------

describe("LaunchTransition", () => {
  it("announces liftoff with role=status, an h1, the message, and hidden art", () => {
    const html = renderToStaticMarkup(
      <LaunchTransition
        heading={LOCKED.launch.heading}
        message={COPY.review.launchMessage}
        art={<div data-slot="art" />}
      />,
    );
    const root = parseTags(html)[0];
    expect(root.attrs["data-testid"]).toBe("launch-transition");
    expect(root.attrs.role).toBe("status");
    expect(markupOf(html, "h1").map(textOf)).toEqual([LOCKED.launch.heading]);
    expect(markupOf(html, "p").map(textOf)).toEqual([COPY.review.launchMessage]);
    expect(wrapperOfSlot(html, "art").attrs["aria-hidden"]).toBe("true");
  });

  it("renders no art container without art", () => {
    const html = renderToStaticMarkup(
      <LaunchTransition heading={LOCKED.launch.heading} message={COPY.review.launchMessage} />,
    );
    expect(parseTags(html)[0].attrs.role).toBe("status");
    expect(parseTags(html).some((tag) => "aria-hidden" in tag.attrs)).toBe(false);
    expect(textOf(html)).toBe(`${LOCKED.launch.heading}${COPY.review.launchMessage}`);
  });
});
