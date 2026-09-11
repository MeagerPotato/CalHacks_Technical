import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Check } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineerArt } from "@/components/art/EngineerArt";
import { HeroArt } from "@/components/art/HeroArt";
import { LandingMoment } from "@/components/art/LandingMoment";
import { LaunchpadMark } from "@/components/art/LaunchpadMark";
import { LiftoffMoment } from "@/components/art/LiftoffMoment";
import { RocketArt } from "@/components/art/RocketArt";
import { Sticker } from "@/components/art/Sticker";
import { AppLink } from "@/components/ui/AppLink";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { CheckboxGroup } from "@/components/ui/CheckboxGroup";
import { ErrorSummary } from "@/components/ui/ErrorSummary";
import { Field, FieldGroup, type FieldControlProps } from "@/components/ui/Field";
import { Form, FormActions } from "@/components/ui/Form";
import { LiveStatus, Notice, NoticeFromView } from "@/components/ui/Notice";
import { PageError, PageLoading, PageNotFound } from "@/components/ui/PageState";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { SkipLink } from "@/components/ui/SkipLink";
import { TextInput } from "@/components/ui/TextInput";
import { Timestamp } from "@/components/ui/Timestamp";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { COPY, LOCKED } from "@/content/copy";
import { APPLICATION_STATUS_LABELS } from "@/lib/application-config";
import { APPLICATION_STATUSES } from "@/lib/domain/enums";
import type { NoticeView, SummaryItemView } from "@/lib/view-models/types";

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
  // Any React warning (controlled inputs, keys, invalid attributes) fails the test.
  expect(consoleErrors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

describe("Button", () => {
  it("keeps focusability while pending: aria-disabled, no disabled attribute, hidden spinner", () => {
    const html = renderToStaticMarkup(<Button pending>{LOCKED.editor.saveDraft}</Button>);
    const button = onlyTag(html, "button");
    expect(button.attrs["aria-disabled"]).toBe("true");
    expect(button.attrs).not.toHaveProperty("disabled");
    expect(button.attrs["data-pending"]).toBe("true");
    expect(button.attrs.type).toBe("button");
    expect(onlyTag(html, "svg").attrs["aria-hidden"]).toBe("true");
    expect(textOf(html)).toBe(LOCKED.editor.saveDraft);
  });

  it("renders each variant and attaches a click handler only when one is needed", () => {
    for (const variant of ["primary", "secondary", "quiet"] as const) {
      const html = renderToStaticMarkup(<Button variant={variant}>{LOCKED.editor.saveDraft}</Button>);
      const button = onlyTag(html, "button");
      expect(button.attrs["data-variant"]).toBe(variant);
      expect(button.attrs["data-pending"]).toBe("false");
      expect(button.attrs).not.toHaveProperty("aria-disabled");
      expect(tagsNamed(html, "svg")).toHaveLength(0);
      expect(Button({ variant, children: LOCKED.editor.saveDraft }).props.onClick).toBeUndefined();
    }
    expect(Button({ children: LOCKED.editor.saveDraft, onClick: vi.fn() }).props.onClick).toBeTypeOf("function");
    expect(Button({ children: LOCKED.editor.saveDraft, pending: true }).props.onClick).toBeTypeOf("function");
  });

  it("suppresses the click and the form submission while pending", () => {
    const onClick = vi.fn();
    const element = Button({ children: LOCKED.review.submit, type: "submit", pending: true, onClick });
    const event = { preventDefault: vi.fn() };
    (element.props.onClick as (event: unknown) => void)(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onClick when not pending", () => {
    const onClick = vi.fn();
    const element = Button({ children: LOCKED.editor.saveDraft, onClick });
    (element.props.onClick as (event: unknown) => void)({ preventDefault: vi.fn() });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses the native disabled attribute and forwards button attributes", () => {
    const html = renderToStaticMarkup(
      <Button type="submit" disabled aria-describedby="review-irreversible" id="submit-application">
        {LOCKED.review.submit}
      </Button>,
    );
    const button = onlyTag(html, "button");
    expect(button.attrs).toHaveProperty("disabled");
    expect(button.attrs.type).toBe("submit");
    expect(button.attrs["aria-describedby"]).toBe("review-irreversible");
    expect(button.attrs.id).toBe("submit-application");
  });
});

describe("AppLink", () => {
  it("routes internal paths through GuardedLink", () => {
    const html = renderToStaticMarkup(
      <AppLink href="/portal/mission" variant="primary" id="track" aria-current="step" data-testid="track-link">
        {LOCKED.portal.trackMission}
      </AppLink>,
    );
    const anchor = onlyTag(html, "a");
    expect(anchor.attrs["data-guarded"]).toBe("true");
    expect(anchor.attrs.href).toBe("/portal/mission");
    expect(anchor.attrs.id).toBe("track");
    expect(anchor.attrs["aria-current"]).toBe("step");
    expect(anchor.attrs["data-testid"]).toBe("track-link");
    expect(anchor.attrs).not.toHaveProperty("target");
    expect(textOf(html)).toBe(LOCKED.portal.trackMission);
  });

  it("renders other hrefs as plain anchors", () => {
    for (const href of ["https://example.com", "//example.com/path", "#main", "mailto:team@example.com"]) {
      const anchor = onlyTag(renderToStaticMarkup(<AppLink href={href}>{LOCKED.brand}</AppLink>), "a");
      expect(anchor.attrs.href).toBe(href);
      expect(anchor.attrs).not.toHaveProperty("data-guarded");
      expect(anchor.attrs).not.toHaveProperty("target");
    }
  });

  it("opens new-tab links with noopener and announces the new tab", () => {
    const html = renderToStaticMarkup(
      <AppLink href="/login?next=%2Fportal" newTab aria-describedby="notice-body">
        {COPY.notices.actions.signInNewTab}
      </AppLink>,
    );
    const anchor = onlyTag(html, "a");
    expect(anchor.attrs.target).toBe("_blank");
    expect(anchor.attrs.rel).toBe("noopener noreferrer");
    expect(anchor.attrs.href).toBe("/login?next=%2Fportal");
    expect(anchor.attrs["aria-describedby"]).toBe("notice-body");
    expect(anchor.attrs).not.toHaveProperty("data-guarded");
    expect(onlyTag(html, "svg").attrs["aria-hidden"]).toBe("true");
    expect(textOf(html)).toBe(`${COPY.notices.actions.signInNewTab} ${COPY.common.opensInNewTab}`);
  });

  it("attaches onClick only when provided", () => {
    expect(AppLink({ href: "https://example.com", children: LOCKED.brand }).props.onClick).toBeUndefined();
    const onClick = vi.fn();
    expect(AppLink({ href: "https://example.com", children: LOCKED.brand, onClick }).props.onClick).toBe(onClick);
  });
});

describe("Form", () => {
  it("disables native validation and attaches onSubmit only when provided", () => {
    const html = renderToStaticMarkup(
      <Form id="login-form" aria-labelledby="login-title">
        <FormActions>
          <Button type="submit">{LOCKED.auth.signIn}</Button>
        </FormActions>
      </Form>,
    );
    const form = onlyTag(html, "form");
    expect(form.attrs).toHaveProperty("novalidate");
    expect(form.attrs.id).toBe("login-form");
    expect(form.attrs["aria-labelledby"]).toBe("login-title");
    expect(onlyTag(html, "button").attrs.type).toBe("submit");

    expect(Form({ children: null }).props.onSubmit).toBeUndefined();
    const onSubmit = vi.fn();
    expect(Form({ children: null, onSubmit }).props.onSubmit).toBe(onSubmit);
  });
});

describe("Card", () => {
  it("is a labelled section only when it has a heading", () => {
    const section = onlyTag(
      renderToStaticMarkup(
        <Card labelledBy="progress-title" tone="accent" data-testid="progress-card">
          <h2 id="progress-title">{COPY.portal.progressTitle}</h2>
        </Card>,
      ),
      "section",
    );
    expect(section.attrs["aria-labelledby"]).toBe("progress-title");
    expect(section.attrs["data-tone"]).toBe("accent");
    expect(section.attrs["data-testid"]).toBe("progress-card");

    const html = renderToStaticMarkup(<Card>{COPY.portal.progressTitle}</Card>);
    expect(tagsNamed(html, "section")).toHaveLength(0);
    expect(onlyTag(html, "div").attrs["data-tone"]).toBe("default");
  });
});

describe("Badge and StatusBadge", () => {
  it("hides the badge icon and keeps the text", () => {
    const html = renderToStaticMarkup(
      <Badge tone="success" icon={Check}>
        {COPY.readiness.states.complete}
      </Badge>,
    );
    expect(onlyTag(html, "svg").attrs["aria-hidden"]).toBe("true");
    expect(textOf(html)).toBe(COPY.readiness.states.complete);
    expect(tagsNamed(renderToStaticMarkup(<Badge tone="neutral">{LOCKED.brand}</Badge>), "svg")).toHaveLength(0);
  });

  it.each(APPLICATION_STATUSES)("renders the %s status with data-status, its label, and a hidden icon", (status) => {
    const html = renderToStaticMarkup(<StatusBadge status={status} label={APPLICATION_STATUS_LABELS[status]} />);
    expect(parseTags(html)[0].attrs["data-status"]).toBe(status);
    expect(onlyTag(html, "svg").attrs["aria-hidden"]).toBe("true");
    expect(textOf(html)).toBe(APPLICATION_STATUS_LABELS[status]);
  });
});

describe("ProgressMeter", () => {
  it.each([
    [42, "42", "false"],
    [150, "100", "true"],
    [-5, "0", "false"],
    [33.6, "34", "false"],
    [Number.NaN, "0", "false"],
  ])("reports %s as aria-valuenow %s", (value, expected, complete) => {
    const html = renderToStaticMarkup(
      <ProgressMeter id="portal-progress" value={value} label={COPY.editor.progressLabel} valueText="Progress" />,
    );
    const bar = tagById(html, "portal-progress");
    expect(bar.attrs.role).toBe("progressbar");
    expect(bar.attrs["aria-valuenow"]).toBe(expected);
    expect(bar.attrs["aria-valuemin"]).toBe("0");
    expect(bar.attrs["aria-valuemax"]).toBe("100");
    expect(bar.attrs["aria-valuetext"]).toBe("Progress");
    expect(bar.attrs["aria-labelledby"]).toBe("portal-progress-label");
    expect(parseTags(html)[0].attrs["data-complete"]).toBe(complete);
  });

  it("labels the bar with its visible label and shows the value text", () => {
    const html = renderToStaticMarkup(
      <ProgressMeter value={40} label={COPY.editor.progressLabel} valueText={COPY.portal.progressValue(40)} />,
    );
    const bar = parseTags(html).find((tag) => tag.attrs.role === "progressbar");
    expect(bar?.attrs["aria-labelledby"]).toBeDefined();
    expect(textOf(html)).toContain(COPY.editor.progressLabel);
    expect(textOf(html)).toContain(COPY.portal.progressValue(40));
    const label = tagById(html, bar?.attrs["aria-labelledby"] ?? "");
    expect(label.name).toBe("span");
  });
});

describe("Field", () => {
  const counter = { current: 501, max: 500, text: COPY.editor.characterCount(501, 500) };

  it("links the hint, help, error, and counter to the control", () => {
    const html = renderToStaticMarkup(
      <Field
        id="field-bio"
        label="Bio"
        hint={COPY.editor.hints.maxCharacters(500)}
        help="Tell us about yourself."
        errors={["Use 500 characters or fewer.", "Second message"]}
        required
        counter={counter}
      >
        {(control) => (
          <TextInput
            id={control.id}
            describedBy={control.describedBy}
            invalid={control.invalid}
            required={control.required}
            multiline
            value="Hello"
            onValueChange={vi.fn()}
          />
        )}
      </Field>,
    );

    expect(onlyTag(html, "label").attrs.for).toBe("field-bio");
    const control = tagById(html, "field-bio");
    expect(control.name).toBe("textarea");
    expect(control.attrs["aria-describedby"]).toBe("field-bio-hint field-bio-help field-bio-error field-bio-counter");
    expect(control.attrs["aria-invalid"]).toBe("true");
    expect(control.attrs["aria-required"]).toBe("true");
    expect(tagById(html, "field-bio-hint").name).toBe("p");
    expect(tagById(html, "field-bio-help").name).toBe("p");
    expect(tagById(html, "field-bio-counter").attrs["data-over-limit"]).toBe("true");

    const errorMarkup = /<p id="field-bio-error"[\s\S]*?<\/p>/.exec(html)?.[0] ?? "";
    expect(textOf(errorMarkup)).toBe(`${COPY.common.errorPrefix} Use 500 characters or fewer.`);
    expect(onlyTag(errorMarkup, "svg").attrs["aria-hidden"]).toBe("true");
    expect(html).not.toContain("Second message");
  });

  it("omits describedby and state attributes when nothing describes the control", () => {
    const html = renderToStaticMarkup(
      <Field id="field-preferredName" label="Preferred name" optionalText={COPY.common.optional}>
        {(control) => (
          <TextInput
            id={control.id}
            describedBy={control.describedBy}
            invalid={control.invalid}
            required={control.required}
          />
        )}
      </Field>,
    );
    const input = tagById(html, "field-preferredName");
    expect(input.attrs).not.toHaveProperty("aria-describedby");
    expect(input.attrs).not.toHaveProperty("aria-invalid");
    expect(input.attrs).not.toHaveProperty("aria-required");
    expect(parseTags(html).filter((tag) => /-(hint|help|error|counter)$/.test(tag.attrs.id ?? ""))).toHaveLength(0);
    expect(textOf(/<label[\s\S]*?<\/label>/.exec(html)?.[0] ?? "")).toBe(`Preferred name ${COPY.common.optional}`);
  });

  it("passes exactly the rendered ids to the control", () => {
    const received: FieldControlProps[] = [];
    renderToStaticMarkup(
      <Field id="field-graduationYear" label="Graduation year" hint={COPY.editor.hints.wholeNumber(2020, 2035)}>
        {(control) => {
          received.push(control);
          return null;
        }}
      </Field>,
    );
    expect(received).toEqual([
      { id: "field-graduationYear", describedBy: "field-graduationYear-hint", invalid: false, required: false },
    ]);
  });

  it("ignores empty error messages so describedby never points at an error that is not rendered", () => {
    const received: FieldControlProps[] = [];
    const html = renderToStaticMarkup(
      <Field id="field-school" label="School" errors={[""]}>
        {(control) => {
          received.push(control);
          return null;
        }}
      </Field>,
    );
    expect(received).toEqual([{ id: "field-school", describedBy: undefined, invalid: false, required: false }]);
    expect(html).not.toContain("field-school-error");
  });
});

describe("FieldGroup", () => {
  it("renders a fieldset with a legend described by its hint, error, and counter", () => {
    const html = renderToStaticMarkup(
      <FieldGroup
        id="field-skills"
        legend="Skills"
        hint={COPY.editor.hints.chooseUpTo(3)}
        errors={["Choose up to 3."]}
        counter={{ current: 2, max: 3, text: COPY.editor.selectedCount(2, 3) }}
        optionalText={COPY.common.optional}
      >
        <CheckboxGroup
          idPrefix="field-skills"
          name="skills"
          options={[{ value: "web", label: "Web" }]}
          value={[]}
          describedBy="field-skills-counter"
        />
      </FieldGroup>,
    );
    const fieldset = onlyTag(html, "fieldset");
    expect(fieldset.attrs["aria-describedby"]).toBe("field-skills-hint field-skills-error field-skills-counter");
    expect(fieldset.attrs).not.toHaveProperty("id");
    expect(textOf(/<legend[\s\S]*?<\/legend>/.exec(html)?.[0] ?? "")).toBe(`Skills ${COPY.common.optional}`);
    expect(tagById(html, "field-skills-counter").attrs["data-over-limit"]).toBe("false");
    expect(tagById(html, "field-skills").attrs.type).toBe("checkbox");
  });

  it("omits aria-describedby when nothing describes the group", () => {
    const html = renderToStaticMarkup(
      <FieldGroup id="field-codeOfConduct" legend="Code of conduct">
        {null}
      </FieldGroup>,
    );
    expect(onlyTag(html, "fieldset").attrs).not.toHaveProperty("aria-describedby");
    expect(onlyTag(html, "legend")).toBeDefined();
  });

  it("shows the first non-empty error message and references only rendered ids", () => {
    const html = renderToStaticMarkup(
      <FieldGroup id="field-accountRole" legend={COPY.auth.signup.roleLegend} errors={["", "Choose an account type."]}>
        {null}
      </FieldGroup>,
    );
    expect(onlyTag(html, "fieldset").attrs["aria-describedby"]).toBe("field-accountRole-error");
    const errorMarkup = /<p id="field-accountRole-error"[\s\S]*?<\/p>/.exec(html)?.[0] ?? "";
    expect(textOf(errorMarkup)).toBe(`${COPY.common.errorPrefix} Choose an account type.`);
  });
});

describe("TextInput", () => {
  it("is controlled with a change handler when value and onValueChange are passed", () => {
    const onValueChange = vi.fn();
    const element = TextInput({ id: "field-preferredName", value: "Ada", onValueChange });
    expect(element.props.value).toBe("Ada");
    expect(element.props.readOnly).toBeUndefined();
    (element.props.onChange as (event: unknown) => void)({ target: { value: "Ada L" } });
    expect(onValueChange).toHaveBeenCalledWith("Ada L");

    const input = onlyTag(
      renderToStaticMarkup(<TextInput id="field-preferredName" value="Ada" onValueChange={onValueChange} />),
      "input",
    );
    expect(input.attrs.value).toBe("Ada");
    expect(input.attrs).not.toHaveProperty("readonly");
    expect(input.attrs.type).toBe("text");
  });

  it("is read-only when controlled without a callback", () => {
    const element = TextInput({ id: "field-preferredName", value: "Ada" });
    expect(element.props.onChange).toBeUndefined();
    expect(element.props.readOnly).toBe(true);
    expect(onlyTag(renderToStaticMarkup(<TextInput id="field-preferredName" value="Ada" />), "input").attrs).toHaveProperty(
      "readonly",
    );
  });

  it("is uncontrolled with defaultValue", () => {
    const element = TextInput({ id: "field-email", name: "email", defaultValue: "ada@example.com" });
    expect(element.props.value).toBeUndefined();
    expect(element.props.defaultValue).toBe("ada@example.com");
    expect(element.props.onChange).toBeUndefined();

    const input = onlyTag(
      renderToStaticMarkup(
        <TextInput id="field-email" name="email" type="email" autoComplete="email" defaultValue="ada@example.com" />,
      ),
      "input",
    );
    expect(input.attrs.value).toBe("ada@example.com");
    expect(input.attrs.name).toBe("email");
    expect(input.attrs.type).toBe("email");
    expect(input.attrs.autocomplete).toBe("email");
    expect(input.attrs).not.toHaveProperty("readonly");
  });

  it("renders a 16px textarea without native required or maxlength", () => {
    const html = renderToStaticMarkup(
      <TextInput id="field-links" multiline rows={3} spellCheck={false} required invalid defaultValue="" />,
    );
    const textarea = onlyTag(html, "textarea");
    expect(textarea.attrs.rows).toBe("3");
    expect(textarea.attrs.spellcheck).toBe("false");
    expect(textarea.attrs["aria-required"]).toBe("true");
    expect(textarea.attrs["aria-invalid"]).toBe("true");
    expect(textarea.attrs).not.toHaveProperty("required");
    expect(textarea.attrs).not.toHaveProperty("maxlength");
    expect(textarea.attrs.class.split(" ")).toContain("text-base");
  });

  it("supports inputMode for numeric text", () => {
    const input = onlyTag(renderToStaticMarkup(<TextInput id="field-age" inputMode="numeric" defaultValue="" />), "input");
    expect(input.attrs.inputmode).toBe("numeric");
  });
});

describe("RadioGroup", () => {
  const options = [
    { value: "hacker", label: "Hacker", description: COPY.auth.signup.roleDescriptions.hacker },
    { value: "judge", label: "Judge", description: COPY.auth.signup.roleDescriptions.judge },
  ];

  it("gives the first radio the prefix id, the rest a value suffix, and links descriptions", () => {
    const html = renderToStaticMarkup(
      <RadioGroup
        idPrefix="field-accountRole"
        name="accountRole"
        options={options}
        defaultValue="judge"
        describedBy="field-accountRole-hint"
        invalid
      />,
    );
    const radios = tagsNamed(html, "input");
    expect(radios.map((radio) => radio.attrs.id)).toEqual(["field-accountRole", "field-accountRole-judge"]);
    expect(radios.map((radio) => radio.attrs.type)).toEqual(["radio", "radio"]);
    expect(radios.map((radio) => radio.attrs.name)).toEqual(["accountRole", "accountRole"]);
    expect(radios[0].attrs).not.toHaveProperty("checked");
    expect(radios[1].attrs).toHaveProperty("checked");
    // ARIA does not support aria-invalid on radios; the group carries data-invalid and the error is in describedBy.
    expect(radios.some((radio) => "aria-invalid" in radio.attrs)).toBe(false);
    expect(parseTags(html)[0].attrs["data-invalid"]).toBe("true");
    expect(radios[0].attrs["aria-describedby"]).toBe("field-accountRole-hint field-accountRole-description");
    expect(radios[1].attrs["aria-describedby"]).toBe("field-accountRole-hint field-accountRole-judge-description");
    expect(tagsNamed(html, "label").map((label) => label.attrs.for)).toEqual(radios.map((radio) => radio.attrs.id));
    expect(textOf(/<label[\s\S]*?<\/label>/.exec(html)?.[0] ?? "")).toBe("Hacker");
    expect(tagsNamed(html, "button")).toHaveLength(0);
  });

  it("attaches change handlers only with a callback and makes controlled radios read-only otherwise", () => {
    const readOnly = elementsOfType(RadioGroup({ idPrefix: "field-x", name: "x", options, value: "hacker" }), "input");
    expect(readOnly.map((input) => input.props.onChange)).toEqual([undefined, undefined]);
    expect(readOnly.map((input) => input.props.readOnly)).toEqual([true, true]);
    expect(readOnly.map((input) => input.props.checked)).toEqual([true, false]);

    const uncontrolled = elementsOfType(RadioGroup({ idPrefix: "field-x", name: "x", options }), "input");
    expect(uncontrolled.map((input) => input.props.readOnly)).toEqual([undefined, undefined]);
    expect(uncontrolled.map((input) => input.props.onChange)).toEqual([undefined, undefined]);

    const onValueChange = vi.fn();
    const controlled = elementsOfType(RadioGroup({ idPrefix: "field-x", name: "x", options, value: "", onValueChange }), "input");
    (controlled[1].props.onChange as () => void)();
    expect(onValueChange).toHaveBeenCalledWith("judge");
    expect(controlled[1].props.readOnly).toBeUndefined();
  });

  it("renders the clear button only when clearable and a value is selected", () => {
    const clearable = { label: COPY.editor.clearSelection, onClear: vi.fn() };
    const none = renderToStaticMarkup(
      <RadioGroup idPrefix="field-x" name="x" options={options} value="" onValueChange={vi.fn()} clearable={clearable} />,
    );
    expect(tagsNamed(none, "button")).toHaveLength(0);

    const selected = renderToStaticMarkup(
      <RadioGroup idPrefix="field-x" name="x" options={options} value="judge" onValueChange={vi.fn()} clearable={clearable} />,
    );
    expect(onlyTag(selected, "button").attrs.type).toBe("button");
    expect(textOf(/<button[\s\S]*?<\/button>/.exec(selected)?.[0] ?? "")).toBe(COPY.editor.clearSelection);

    const withoutClearable = renderToStaticMarkup(
      <RadioGroup idPrefix="field-x" name="x" options={options} value="judge" onValueChange={vi.fn()} />,
    );
    expect(tagsNamed(withoutClearable, "button")).toHaveLength(0);
  });

  it("moves focus to the first radio after clearing, because the clear button unmounts", () => {
    const onClear = vi.fn();
    const focus = vi.fn();
    const getElementById = vi.fn((id: string) => (id.length > 0 ? { focus } : null));
    vi.stubGlobal("document", { getElementById });
    try {
      const clearable = { label: COPY.editor.clearSelection, onClear };
      const [clear] = elementsOfType(
        RadioGroup({ idPrefix: "field-x", name: "x", options, value: "judge", onValueChange: vi.fn(), clearable }),
        Button,
      );
      (clear.props.onClick as () => void)();
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(getElementById).toHaveBeenCalledWith("field-x");
      expect(focus).toHaveBeenCalledTimes(1);
      expect(onClear.mock.invocationCallOrder[0]).toBeLessThan(focus.mock.invocationCallOrder[0]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("CheckboxGroup", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Bravo" },
    { value: "c", label: "Charlie" },
  ];

  it("uses the id scheme and disables unchecked options at maxItems", () => {
    const html = renderToStaticMarkup(
      <CheckboxGroup
        idPrefix="field-skills"
        name="skills"
        options={options}
        value={["a", "c"]}
        onValueChange={vi.fn()}
        maxItems={2}
        describedBy="field-skills-counter"
        invalid
      />,
    );
    const boxes = tagsNamed(html, "input");
    expect(boxes.map((box) => box.attrs.id)).toEqual(["field-skills", "field-skills-b", "field-skills-c"]);
    expect(boxes.map((box) => "checked" in box.attrs)).toEqual([true, false, true]);
    expect(boxes.map((box) => "disabled" in box.attrs)).toEqual([false, true, false]);
    expect(boxes.every((box) => box.attrs["aria-describedby"] === "field-skills-counter")).toBe(true);
    expect(boxes.every((box) => box.attrs["aria-invalid"] === "true")).toBe(true);
  });

  it("does not disable options below the limit", () => {
    const html = renderToStaticMarkup(
      <CheckboxGroup idPrefix="field-skills" name="skills" options={options} value={["a"]} onValueChange={vi.fn()} maxItems={2} />,
    );
    expect(tagsNamed(html, "input").some((box) => "disabled" in box.attrs)).toBe(false);
  });

  it("emits the next selection deduplicated and in option order", () => {
    const onValueChange = vi.fn();
    const boxes = elementsOfType(
      CheckboxGroup({ idPrefix: "field-skills", name: "skills", options, value: ["c", "a", "a"], onValueChange }),
      "input",
    );
    (boxes[1].props.onChange as () => void)();
    expect(onValueChange).toHaveBeenLastCalledWith(["a", "b", "c"]);
    (boxes[0].props.onChange as () => void)();
    expect(onValueChange).toHaveBeenLastCalledWith(["c"]);
  });

  it("is read-only without a callback", () => {
    const boxes = elementsOfType(
      CheckboxGroup({ idPrefix: "field-skills", name: "skills", options, value: ["a"] }),
      "input",
    );
    expect(boxes.every((box) => box.props.onChange === undefined && box.props.readOnly === true)).toBe(true);
  });
});

describe("Checkbox", () => {
  it("renders a labelled, described, required checkbox", () => {
    const html = renderToStaticMarkup(
      <Checkbox
        id="field-codeOfConduct"
        name="codeOfConduct"
        label={COPY.fields.codeOfConductAgreement}
        checked
        onCheckedChange={vi.fn()}
        describedBy="field-codeOfConduct-error"
        invalid
        required
      />,
    );
    const input = onlyTag(html, "input");
    expect(input.attrs.type).toBe("checkbox");
    expect(input.attrs).toHaveProperty("checked");
    expect(input.attrs).not.toHaveProperty("readonly");
    expect(input.attrs["aria-required"]).toBe("true");
    expect(input.attrs["aria-invalid"]).toBe("true");
    expect(input.attrs["aria-describedby"]).toBe("field-codeOfConduct-error");
    expect(onlyTag(html, "label").attrs.for).toBe("field-codeOfConduct");
    expect(textOf(html)).toBe(COPY.fields.codeOfConductAgreement);
  });

  it("handles controlled, read-only, and uncontrolled modes", () => {
    const onCheckedChange = vi.fn();
    const [controlled] = elementsOfType(Checkbox({ id: "c", label: "x", checked: false, onCheckedChange }), "input");
    (controlled.props.onChange as (event: unknown) => void)({ target: { checked: true } });
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    const [readOnly] = elementsOfType(Checkbox({ id: "c", label: "x", checked: true }), "input");
    expect(readOnly.props.readOnly).toBe(true);
    expect(readOnly.props.onChange).toBeUndefined();

    const [uncontrolled] = elementsOfType(Checkbox({ id: "c", label: "x", defaultChecked: true }), "input");
    expect(uncontrolled.props.defaultChecked).toBe(true);
    expect(uncontrolled.props.checked).toBeUndefined();
    expect(uncontrolled.props.onChange).toBeUndefined();
  });
});

describe("ErrorSummary", () => {
  const items: SummaryItemView[] = [
    { key: "school", label: "School", message: "Enter your school.", href: "/portal/application?section=education#field-school" },
    { key: "graduationYear", label: "Graduation year", message: "Enter a whole number.", href: "#field-graduationYear" },
  ];

  it("renders nothing when there are no errors", () => {
    expect(renderToStaticMarkup(<ErrorSummary title={COPY.editor.errorSummaryTitle} items={[]} />)).toBe("");
    expect(renderToStaticMarkup(<ErrorSummary title={COPY.editor.errorSummaryTitle} items={[]} formErrors={[]} />)).toBe(
      "",
    );
  });

  it("is a focusable, labelled summary linking to each field, plus form errors", () => {
    const html = renderToStaticMarkup(
      <ErrorSummary title={COPY.editor.errorSummaryTitle} items={items} formErrors={["Something else is wrong."]} />,
    );
    const section = onlyTag(html, "section");
    expect(section.attrs["data-testid"]).toBe("error-summary");
    expect(section.attrs.tabindex).toBe("-1");
    expect(section.attrs["aria-labelledby"]).toBe("error-summary-title");
    expect(section.attrs).not.toHaveProperty("role");
    expect(section.attrs).not.toHaveProperty("aria-live");
    expect(tagById(html, "error-summary-title").name).toBe("h2");

    const anchors = tagsNamed(html, "a");
    expect(anchors.map((anchor) => anchor.attrs.href)).toEqual(items.map((item) => item.href));
    const anchorTexts = [...html.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map((match) => textOf(match[1]));
    expect(anchorTexts).toEqual(["School: Enter your school.", "Graduation year: Enter a whole number."]);
    expect(textOf(html)).toContain("Something else is wrong.");
    expect(tagsNamed(html, "li")).toHaveLength(3);
  });

  it("supports a custom heading id and form errors alone", () => {
    const html = renderToStaticMarkup(
      <ErrorSummary title={COPY.editor.errorSummaryTitle} items={[]} formErrors={["Try again."]} headingId="login-errors" />,
    );
    expect(onlyTag(html, "section").attrs["aria-labelledby"]).toBe("login-errors");
    expect(tagById(html, "login-errors").name).toBe("h2");
    expect(tagsNamed(html, "a")).toHaveLength(0);
  });

  it("attaches item handlers only with onItemActivate", () => {
    const withoutHandler = elementsOfType(ErrorSummary({ title: "t", items }), "a");
    expect(withoutHandler.map((anchor) => anchor.props.onClick)).toEqual([undefined, undefined]);

    const onItemActivate = vi.fn();
    const anchors = elementsOfType(ErrorSummary({ title: "t", items, onItemActivate }), "a");
    const event = { preventDefault: vi.fn() };
    (anchors[1].props.onClick as (event: unknown) => void)(event);
    expect(onItemActivate).toHaveBeenCalledWith(items[1], event);
  });
});

describe("Notice", () => {
  it.each([
    ["polite", "status"],
    ["assertive", "alert"],
    ["off", undefined],
  ] as const)("maps live=%s to role %s", (live, role) => {
    const root = parseTags(renderToStaticMarkup(<Notice tone="info" title="Title" live={live} />))[0];
    expect(root.attrs.role).toBe(role);
  });

  it("renders no role by default, with tone, test id, icon, title, and body", () => {
    const html = renderToStaticMarkup(
      <Notice id="conflict" tone="warning" title={COPY.notices.conflict.title}>
        {COPY.notices.conflict.body}
      </Notice>,
    );
    const root = parseTags(html)[0];
    expect(root.attrs).not.toHaveProperty("role");
    expect(root.attrs["data-tone"]).toBe("warning");
    expect(root.attrs["data-testid"]).toBe("notice-conflict");
    expect(root.attrs).not.toHaveProperty("id");
    expect(onlyTag(html, "svg").attrs["aria-hidden"]).toBe("true");
    expect(textOf(html)).toBe(`${COPY.notices.conflict.title}${COPY.notices.conflict.body}`);
  });

  it("renders link actions as new-tab links and button actions only with onAction", () => {
    const actions = [
      { kind: "sign_in_new_tab", label: COPY.notices.actions.signInNewTab, href: "/login" },
      { kind: "retry", label: COPY.notices.actions.retry },
    ] as const;

    const withoutHandler = renderToStaticMarkup(<Notice tone="warning" actions={[...actions]} />);
    const link = onlyTag(withoutHandler, "a");
    expect(link.attrs.href).toBe("/login");
    expect(link.attrs.target).toBe("_blank");
    expect(tagsNamed(withoutHandler, "button")).toHaveLength(0);

    const onAction = vi.fn();
    const withHandler = renderToStaticMarkup(<Notice tone="warning" actions={[...actions]} onAction={onAction} />);
    expect(onlyTag(withHandler, "button").attrs.type).toBe("button");
    expect(textOf(/<button[\s\S]*?<\/button>/.exec(withHandler)?.[0] ?? "")).toBe(COPY.notices.actions.retry);

    const [retry] = elementsOfType(Notice({ tone: "warning", actions: [...actions], onAction }), Button);
    (retry.props.onClick as () => void)();
    expect(onAction).toHaveBeenCalledWith("retry");
  });

  it("renders nothing for button-only actions without onAction", () => {
    const html = renderToStaticMarkup(
      <Notice tone="error" actions={[{ kind: "reload", label: COPY.notices.actions.reload }]} />,
    );
    expect(tagsNamed(html, "button")).toHaveLength(0);
    expect(tagsNamed(html, "a")).toHaveLength(0);
  });

  it("renders a NoticeView", () => {
    const view: NoticeView = {
      id: "application_locked",
      tone: "info",
      title: COPY.notices.application_locked.title,
      body: null,
      actions: [],
    };
    const html = renderToStaticMarkup(<NoticeFromView view={view} live="polite" />);
    const root = parseTags(html)[0];
    expect(root.attrs["data-testid"]).toBe("notice-application_locked");
    expect(root.attrs["data-tone"]).toBe("info");
    expect(root.attrs.role).toBe("status");
    expect(textOf(html)).toBe(COPY.notices.application_locked.title);
  });

  it("keeps LiveStatus mounted as a visually hidden polite region", () => {
    for (const message of ["", COPY.editor.announce.saved]) {
      const html = renderToStaticMarkup(<LiveStatus message={message} />);
      const region = onlyTag(html, "div");
      expect(region.attrs["data-testid"]).toBe("live-status");
      expect(region.attrs.role).toBe("status");
      expect(region.attrs["aria-live"]).toBe("polite");
      expect(region.attrs["aria-atomic"]).toBe("true");
      expect(region.attrs.class.split(" ")).toContain("sr-only");
      expect(textOf(html)).toBe(message);
    }
  });
});

describe("Timestamp", () => {
  it("renders a time element with its prefix", () => {
    const html = renderToStaticMarkup(
      <Timestamp
        value={{ iso: "2026-09-10T22:04:00.000Z", label: "Sep 10, 2026, 3:04 PM PDT" }}
        prefix={COPY.portal.lastSaved}
        fallback={COPY.portal.notSaved}
      />,
    );
    expect(onlyTag(html, "time").attrs.datetime).toBe("2026-09-10T22:04:00.000Z");
    expect(textOf(html)).toBe(`${COPY.portal.lastSaved} Sep 10, 2026, 3:04 PM PDT`);
  });

  it("renders the fallback without a time element", () => {
    const html = renderToStaticMarkup(<Timestamp value={null} prefix={COPY.portal.lastSaved} fallback={COPY.portal.notSaved} />);
    expect(tagsNamed(html, "time")).toHaveLength(0);
    expect(textOf(html)).toBe(COPY.portal.notSaved);
  });
});

describe("PageState", () => {
  function mains(html: string): Tag[] {
    return tagsNamed(html, "main");
  }

  it("renders exactly one main#main when standalone, and none when nested", () => {
    const states = (standalone?: boolean) => [
      renderToStaticMarkup(<PageLoading label={COPY.common.loading} standalone={standalone} />),
      renderToStaticMarkup(
        <PageError
          title={COPY.pages.error.title}
          message={COPY.pages.error.body}
          retryLabel={COPY.pages.error.retry}
          standalone={standalone}
        />,
      ),
      renderToStaticMarkup(
        <PageNotFound
          title={COPY.pages.notFound.title}
          message={COPY.pages.notFound.body}
          homeHref="/"
          homeLabel={COPY.pages.notFound.home}
          standalone={standalone}
        />,
      ),
    ];

    for (const html of states()) {
      const [main] = mains(html);
      expect(mains(html)).toHaveLength(1);
      expect(main.attrs.id).toBe("main");
      expect(main.attrs.tabindex).toBe("-1");
    }
    for (const html of states(true)) {
      expect(mains(html)).toHaveLength(1);
    }
    for (const html of states(false)) {
      expect(mains(html)).toHaveLength(0);
      expect(html).not.toContain('id="main"');
    }
  });

  it("announces loading with role=status", () => {
    const html = renderToStaticMarkup(<PageLoading label={COPY.common.loading} />);
    const status = parseTags(html).find((tag) => tag.attrs.role === "status");
    expect(status).toBeDefined();
    expect(textOf(html)).toBe(COPY.common.loading);
    expect(onlyTag(html, "svg").attrs["aria-hidden"]).toBe("true");
  });

  it("shows an error heading and a retry button only with onRetry", () => {
    const props = { title: COPY.pages.error.title, message: COPY.pages.error.body, retryLabel: COPY.pages.error.retry };
    const withoutRetry = renderToStaticMarkup(<PageError {...props} />);
    expect(textOf(/<h1[\s\S]*?<\/h1>/.exec(withoutRetry)?.[0] ?? "")).toBe(COPY.pages.error.title);
    expect(tagsNamed(withoutRetry, "button")).toHaveLength(0);

    const withRetry = renderToStaticMarkup(<PageError {...props} onRetry={vi.fn()} />);
    expect(onlyTag(withRetry, "button").attrs.type).toBe("button");
    expect(textOf(/<button[\s\S]*?<\/button>/.exec(withRetry)?.[0] ?? "")).toBe(COPY.pages.error.retry);
  });

  it("links home from the not-found state", () => {
    const html = renderToStaticMarkup(
      <PageNotFound title={COPY.pages.notFound.title} message={COPY.pages.notFound.body} homeHref="/" homeLabel={COPY.pages.notFound.home} />,
    );
    expect(tagsNamed(html, "h1")).toHaveLength(1);
    const anchor = onlyTag(html, "a");
    expect(anchor.attrs.href).toBe("/");
    expect(anchor.attrs["data-guarded"]).toBe("true");
  });
});

describe("SkipLink and VisuallyHidden", () => {
  it("links to the main landmark", () => {
    const html = renderToStaticMarkup(<SkipLink targetId="main" label={COPY.common.skipToContent} />);
    expect(parseTags(html)).toHaveLength(1);
    expect(onlyTag(html, "a").attrs.href).toBe("#main");
    expect(textOf(html)).toBe(COPY.common.skipToContent);
  });

  it("hides content visually with the sr-only pattern", () => {
    const span = onlyTag(renderToStaticMarkup(<VisuallyHidden>{COPY.common.errorPrefix}</VisuallyHidden>), "span");
    expect(span.attrs.class).toBe("sr-only");
    const div = onlyTag(renderToStaticMarkup(<VisuallyHidden as="div">{COPY.common.errorPrefix}</VisuallyHidden>), "div");
    expect(div.attrs.class).toBe("sr-only");
  });
});

// ---------------------------------------------------------------------------
// Art placeholders
// ---------------------------------------------------------------------------

describe("art placeholders", () => {
  const decorative: [string, ReactElement][] = [
    ["HeroArt", <HeroArt key="hero" />],
    ["EngineerArt landing", <EngineerArt key="engineer-landing" variant="landing" />],
    ["EngineerArt dashboard", <EngineerArt key="engineer-dashboard" variant="dashboard" />],
    ...(["launch", "cruise", "landing"] as const).map(
      (stage): [string, ReactElement] => [`RocketArt ${stage}`, <RocketArt key={stage} stage={stage} />],
    ),
    ...(["star", "wrench", "planet", "antenna", "bolt", "patch"] as const).map(
      (name): [string, ReactElement] => [`Sticker ${name}`, <Sticker key={name} name={name} />],
    ),
    ["LiftoffMoment", <LiftoffMoment key="liftoff" />],
    ["LandingMoment accepted", <LandingMoment key="accepted" decision="accepted" />],
    ["LandingMoment waitlisted", <LandingMoment key="waitlisted" decision="waitlisted" />],
  ];

  it.each(decorative)("%s is hidden, inert to the pointer, and has no text or focusable content", (_, element) => {
    const html = renderToStaticMarkup(element);
    const root = parseTags(html)[0];
    expect(root.attrs["aria-hidden"]).toBe("true");
    expect(root.attrs.class.split(" ")).toContain("pointer-events-none");
    expect(root.attrs.class).toMatch(/(^|\s)aspect-/);
    expect(textOf(html)).toBe("");
    expect(parseTags(html).some((tag) => ["a", "button", "input", "select", "textarea"].includes(tag.name))).toBe(false);
  });

  it("exposes the stage, variant, sticker, and decision as data attributes", () => {
    expect(parseTags(renderToStaticMarkup(<RocketArt stage="cruise" />))[0].attrs["data-stage"]).toBe("cruise");
    expect(parseTags(renderToStaticMarkup(<EngineerArt variant="dashboard" />))[0].attrs["data-variant"]).toBe(
      "dashboard",
    );
    expect(parseTags(renderToStaticMarkup(<Sticker name="bolt" />))[0].attrs["data-name"]).toBe("bolt");
    expect(parseTags(renderToStaticMarkup(<LandingMoment decision="waitlisted" />))[0].attrs["data-decision"]).toBe(
      "waitlisted",
    );
  });

  it("renders the brand text in LaunchpadMark without hiding it", () => {
    const html = renderToStaticMarkup(<LaunchpadMark />);
    expect(textOf(html)).toBe(LOCKED.brand);
    expect(parseTags(html)[0].attrs).not.toHaveProperty("aria-hidden");
  });
});
