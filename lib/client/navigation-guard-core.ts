import type { UrlObject } from "url";

// =============================================================================
// Pure logic behind the unsaved-changes navigation guard (lib/client/navigation-guard.tsx).
// Kept free of React and Next.js so it can be unit tested in Node.
// =============================================================================

/** Outcome of a registered region's flush; mirrors the application editor's save results. */
export type GuardFlushResult = "saved" | "nothing_to_save" | "invalid" | "failed" | "blocked";

/** A page region with unsaved work that must be flushed, or explicitly abandoned, before leaving. */
export interface NavigationGuardEntry {
  isDirty(): boolean;
  flush(): Promise<GuardFlushResult>;
}

/** The guard API returned by `useNavigationGuard`. */
export interface NavigationGuard {
  /** Registers an entry. The latest registration is the active one. Returns a function that removes only this entry. */
  register(entry: NavigationGuardEntry): () => void;
  /** Resolves true when leaving is allowed: nothing is dirty, the flush saved, or the user confirmed leaving. */
  confirmLeave(): Promise<boolean>;
}

/** The value shared through context. `hasDirtyGuard` lets `GuardedLink` skip interception when nothing is dirty. */
export interface NavigationGuardController extends NavigationGuard {
  hasDirtyGuard(): boolean;
}

/** The guard outside a provider: registration is a no-op, nothing is dirty, and leaving is always allowed. */
export const NO_PROVIDER_GUARD: NavigationGuardController = {
  register: () => () => {},
  confirmLeave: () => Promise.resolve(true),
  hasDirtyGuard: () => false,
};

/**
 * Creates the controller behind `NavigationGuardProvider`.
 *
 * `confirmUnsaved` asks the user whether to leave after a flush that did not save; the provider passes
 * `window.confirm` with `COPY.editor.leaveUnsaved`.
 */
export function createNavigationGuardController(confirmUnsaved: () => boolean): NavigationGuardController {
  // Each registration gets its own token, so unregistering removes only that registration even for a reused entry.
  const registrations: { token: symbol; entry: NavigationGuardEntry }[] = [];

  function activeEntry(): NavigationGuardEntry | null {
    return registrations.length > 0 ? registrations[registrations.length - 1].entry : null;
  }

  return {
    register(entry) {
      const token = Symbol("navigation-guard-entry");
      registrations.push({ token, entry });
      return () => {
        const index = registrations.findIndex((registration) => registration.token === token);
        if (index !== -1) {
          registrations.splice(index, 1);
        }
      };
    },
    hasDirtyGuard() {
      return activeEntry()?.isDirty() ?? false;
    },
    async confirmLeave() {
      const entry = activeEntry();
      if (!entry || !entry.isDirty()) {
        return true;
      }
      let result: GuardFlushResult;
      try {
        result = await entry.flush();
      } catch {
        result = "failed";
      }
      if (result === "saved" || result === "nothing_to_save") {
        return true;
      }
      return confirmUnsaved();
    },
  };
}

/** The event object Next.js passes to `Link` `onNavigate`. */
export interface NavigateEventLike {
  preventDefault(): void;
}

export interface GuardedNavigateOptions {
  /** The caller's own `onNavigate`, which runs first. */
  onNavigate?: (event: NavigateEventLike) => void;
  isDirty: () => boolean;
  confirmLeave: () => Promise<boolean>;
  /** Replays the cancelled navigation (`router.push`). */
  navigate: () => void;
}

/**
 * The `onNavigate` logic of `GuardedLink`.
 *
 * The caller's handler runs first, and navigation stops if it called `preventDefault`. When the active guard is dirty,
 * the client navigation is cancelled and replayed only after `confirmLeave` resolves true. Returns the pending
 * confirmation, or null when navigation was not intercepted.
 */
export function runGuardedNavigate(event: NavigateEventLike, options: GuardedNavigateOptions): Promise<void> | null {
  let callerPrevented = false;
  options.onNavigate?.({
    preventDefault() {
      callerPrevented = true;
      event.preventDefault();
    },
  });
  if (callerPrevented || !options.isDirty()) {
    return null;
  }

  event.preventDefault();
  return options.confirmLeave().then((confirmed) => {
    if (confirmed) {
      options.navigate();
    }
  });
}

/** Converts a `Link` href (string or URL object) into the path string `router.push` expects. */
export function resolveHref(href: string | UrlObject): string {
  if (typeof href === "string") {
    return href;
  }
  if (href.href) {
    return href.href;
  }

  let search = href.search ?? "";
  if (!search && typeof href.query === "string") {
    search = href.query;
  } else if (!search && href.query) {
    const params = new URLSearchParams();
    for (const [key, raw] of Object.entries(href.query)) {
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
    }
    search = params.toString();
  }
  if (search && !search.startsWith("?")) {
    search = `?${search}`;
  }

  const hash = href.hash ? (href.hash.startsWith("#") ? href.hash : `#${href.hash}`) : "";
  return `${href.pathname ?? ""}${search}${hash}`;
}
