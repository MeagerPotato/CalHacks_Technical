import { createElement, Fragment, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COPY } from "@/content/copy";
import { GuardedLink, NavigationGuardProvider, useNavigationGuard } from "@/lib/client/navigation-guard";
import {
  NO_PROVIDER_GUARD,
  createNavigationGuardController,
  resolveHref,
  runGuardedNavigate,
  type GuardFlushResult,
  type NavigationGuard,
} from "@/lib/client/navigation-guard-core";

// GuardedLink needs the App Router. These stand-ins record router pushes and the props handed to next/link.
const nextStubs = vi.hoisted(() => ({
  push: vi.fn(),
  linkProps: [] as Record<string, unknown>[],
  guards: [] as NavigationGuard[],
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nextStubs.push }) }));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: (props: Record<string, unknown>) => {
      nextStubs.linkProps.push(props);
      return React.createElement("a", null, props.children as ReactNode);
    },
  };
});

function createEntry(options: { dirty: boolean; result?: GuardFlushResult; throws?: boolean }) {
  return {
    isDirty: vi.fn(() => options.dirty),
    flush: vi.fn(async (): Promise<GuardFlushResult> => {
      if (options.throws) {
        throw new Error("network");
      }
      return options.result ?? "saved";
    }),
  };
}

function CaptureGuard() {
  nextStubs.guards.push(useNavigationGuard());
  return null;
}

/** Renders a GuardedLink, optionally inside a provider, and returns the shared guard and the link's onNavigate. */
function renderGuardedLink(props: ComponentProps<typeof GuardedLink>, withProvider: boolean) {
  nextStubs.guards.length = 0;
  nextStubs.linkProps.length = 0;
  const children = [createElement(CaptureGuard, { key: "guard" }), createElement(GuardedLink, { ...props, key: "link" })];
  renderToStaticMarkup(
    withProvider ? createElement(NavigationGuardProvider, null, ...children) : createElement(Fragment, null, ...children),
  );

  const guard = nextStubs.guards.at(-1);
  const onNavigate = nextStubs.linkProps.at(-1)?.onNavigate;
  if (!guard || typeof onNavigate !== "function") {
    throw new Error("GuardedLink did not render");
  }
  return { guard, onNavigate: onNavigate as (event: { preventDefault(): void }) => void };
}

describe("navigation guard without a provider", () => {
  it("ignores registrations and always allows leaving", async () => {
    const unregister = NO_PROVIDER_GUARD.register(createEntry({ dirty: true }));
    expect(() => unregister()).not.toThrow();
    expect(NO_PROVIDER_GUARD.hasDirtyGuard()).toBe(false);
    await expect(NO_PROVIDER_GUARD.confirmLeave()).resolves.toBe(true);
  });
});

describe("createNavigationGuardController", () => {
  it("allows leaving when nothing is registered or the active entry is clean", async () => {
    const confirmUnsaved = vi.fn(() => false);
    const controller = createNavigationGuardController(confirmUnsaved);
    await expect(controller.confirmLeave()).resolves.toBe(true);

    const clean = createEntry({ dirty: false });
    controller.register(clean);
    expect(controller.hasDirtyGuard()).toBe(false);
    await expect(controller.confirmLeave()).resolves.toBe(true);
    expect(clean.flush).not.toHaveBeenCalled();
    expect(confirmUnsaved).not.toHaveBeenCalled();
  });

  it.each(["saved", "nothing_to_save"] as const)(
    "allows leaving without asking when the flush is %s",
    async (result) => {
      const confirmUnsaved = vi.fn(() => false);
      const controller = createNavigationGuardController(confirmUnsaved);
      const entry = createEntry({ dirty: true, result });
      controller.register(entry);

      await expect(controller.confirmLeave()).resolves.toBe(true);
      expect(entry.flush).toHaveBeenCalledTimes(1);
      expect(confirmUnsaved).not.toHaveBeenCalled();
    },
  );

  it.each(["invalid", "failed", "blocked"] as const)("asks the user when the flush is %s", async (result) => {
    for (const answer of [true, false]) {
      const confirmUnsaved = vi.fn(() => answer);
      const controller = createNavigationGuardController(confirmUnsaved);
      controller.register(createEntry({ dirty: true, result }));

      await expect(controller.confirmLeave()).resolves.toBe(answer);
      expect(confirmUnsaved).toHaveBeenCalledTimes(1);
    }
  });

  it("treats a thrown flush as a failed save", async () => {
    const confirmUnsaved = vi.fn(() => true);
    const controller = createNavigationGuardController(confirmUnsaved);
    controller.register(createEntry({ dirty: true, throws: true }));

    await expect(controller.confirmLeave()).resolves.toBe(true);
    expect(confirmUnsaved).toHaveBeenCalledTimes(1);
  });

  it("uses the latest registration, and each unregister removes only its own entry", () => {
    const controller = createNavigationGuardController(() => true);
    const dirty = createEntry({ dirty: true });
    const clean = createEntry({ dirty: false });

    const unregisterDirty = controller.register(dirty);
    const unregisterClean = controller.register(clean);
    expect(controller.hasDirtyGuard()).toBe(false);

    unregisterClean();
    expect(controller.hasDirtyGuard()).toBe(true);
    unregisterClean();
    expect(controller.hasDirtyGuard()).toBe(true);

    unregisterDirty();
    expect(controller.hasDirtyGuard()).toBe(false);
  });

  it("keeps a second registration of the same entry when the first is removed", () => {
    const controller = createNavigationGuardController(() => true);
    const entry = createEntry({ dirty: true });
    const unregisterFirst = controller.register(entry);
    const unregisterSecond = controller.register(entry);

    unregisterFirst();
    expect(controller.hasDirtyGuard()).toBe(true);
    unregisterSecond();
    expect(controller.hasDirtyGuard()).toBe(false);
  });
});

describe("runGuardedNavigate", () => {
  it("stops when the caller's onNavigate prevents navigation", () => {
    const event = { preventDefault: vi.fn() };
    const isDirty = vi.fn(() => true);
    const confirmLeave = vi.fn(async () => true);
    const navigate = vi.fn();

    const pending = runGuardedNavigate(event, {
      onNavigate: (callerEvent) => callerEvent.preventDefault(),
      isDirty,
      confirmLeave,
      navigate,
    });

    expect(pending).toBeNull();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(isDirty).not.toHaveBeenCalled();
    expect(confirmLeave).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("lets a clean navigation through after calling the caller's handler", () => {
    const event = { preventDefault: vi.fn() };
    const onNavigate = vi.fn();
    const confirmLeave = vi.fn(async () => true);

    const pending = runGuardedNavigate(event, { onNavigate, isDirty: () => false, confirmLeave, navigate: vi.fn() });

    expect(pending).toBeNull();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmLeave).not.toHaveBeenCalled();
  });

  it("cancels a dirty navigation and replays it once leaving is confirmed", async () => {
    const event = { preventDefault: vi.fn() };
    const navigate = vi.fn();

    const pending = runGuardedNavigate(event, { isDirty: () => true, confirmLeave: async () => true, navigate });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    await pending;
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("stays on the page when leaving is declined", async () => {
    const event = { preventDefault: vi.fn() };
    const navigate = vi.fn();

    await runGuardedNavigate(event, { isDirty: () => true, confirmLeave: async () => false, navigate });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("GuardedLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    nextStubs.push.mockReset();
  });

  it("cancels a dirty navigation, flushes, then pushes the link href", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    const callerOnNavigate = vi.fn();
    const { guard, onNavigate } = renderGuardedLink({ href: "/portal", onNavigate: callerOnNavigate }, true);
    const entry = createEntry({ dirty: true, result: "saved" });
    guard.register(entry);

    const event = { preventDefault: vi.fn() };
    onNavigate(event);

    expect(callerOnNavigate).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(nextStubs.push).toHaveBeenCalledWith("/portal"));
    expect(entry.flush).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("asks with the unsaved-changes copy after a failed flush and follows a URL object href once confirmed", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    const { guard, onNavigate } = renderGuardedLink(
      { href: { pathname: "/portal/application", query: { section: "review" } } },
      true,
    );
    guard.register(createEntry({ dirty: true, result: "failed" }));

    onNavigate({ preventDefault: vi.fn() });

    await vi.waitFor(() => expect(nextStubs.push).toHaveBeenCalledWith("/portal/application?section=review"));
    expect(confirm).toHaveBeenCalledWith(COPY.editor.leaveUnsaved);
  });

  it("stays on the page when the user declines to leave", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    const { guard, onNavigate } = renderGuardedLink({ href: "/portal" }, true);
    guard.register(createEntry({ dirty: true, result: "invalid" }));

    const event = { preventDefault: vi.fn() };
    onNavigate(event);

    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(nextStubs.push).not.toHaveBeenCalled();
  });

  it("does not intercept clean navigations or links outside a provider", () => {
    const inside = renderGuardedLink({ href: "/portal" }, true);
    expect(inside.guard).not.toBe(NO_PROVIDER_GUARD);
    inside.guard.register(createEntry({ dirty: false }));
    const insideEvent = { preventDefault: vi.fn() };
    inside.onNavigate(insideEvent);
    expect(insideEvent.preventDefault).not.toHaveBeenCalled();

    const outside = renderGuardedLink({ href: "/portal" }, false);
    expect(outside.guard).toBe(NO_PROVIDER_GUARD);
    outside.guard.register(createEntry({ dirty: true }));
    const outsideEvent = { preventDefault: vi.fn() };
    outside.onNavigate(outsideEvent);
    expect(outsideEvent.preventDefault).not.toHaveBeenCalled();
    expect(nextStubs.push).not.toHaveBeenCalled();
  });
});

describe("resolveHref", () => {
  it("passes strings through", () => {
    expect(resolveHref("/portal/application?section=about#field-school")).toBe(
      "/portal/application?section=about#field-school",
    );
  });

  it("formats URL objects", () => {
    expect(resolveHref({ href: "/portal" })).toBe("/portal");
    expect(resolveHref({ pathname: "/portal/application", query: { section: "about" }, hash: "field-school" })).toBe(
      "/portal/application?section=about#field-school",
    );
    expect(resolveHref({ pathname: "/search", query: { tag: ["a", "b"], empty: null } })).toBe("/search?tag=a&tag=b");
    expect(resolveHref({ pathname: "/login", search: "next=%2Fportal" })).toBe("/login?next=%2Fportal");
    expect(resolveHref({ pathname: "/login", query: "next=%2Fportal", hash: "#main" })).toBe(
      "/login?next=%2Fportal#main",
    );
  });
});
