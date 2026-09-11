"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";

import { COPY } from "@/content/copy";
import {
  NO_PROVIDER_GUARD,
  createNavigationGuardController,
  resolveHref,
  runGuardedNavigate,
  type NavigationGuard,
  type NavigationGuardController,
} from "@/lib/client/navigation-guard-core";

export type { GuardFlushResult, NavigationGuard, NavigationGuardEntry } from "@/lib/client/navigation-guard-core";

const NavigationGuardContext = createContext<NavigationGuardController>(NO_PROVIDER_GUARD);

/** Shares one unsaved-changes guard with every `GuardedLink` and `useNavigationGuard` caller below it. */
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  // One controller per mount. Registrations mutate it, so consumers never re-render when editors register.
  const [controller] = useState(() =>
    createNavigationGuardController(() => window.confirm(COPY.editor.leaveUnsaved)),
  );
  return <NavigationGuardContext value={controller}>{children}</NavigationGuardContext>;
}

/**
 * The stable guard API. Editors `register` their dirty check and flush; sign-out and other leave actions await
 * `confirmLeave()`. Without a provider, `register` is a no-op and `confirmLeave` resolves true.
 */
export function useNavigationGuard(): NavigationGuard {
  return useContext(NavigationGuardContext);
}

/**
 * `next/link` that respects the unsaved-changes guard. When a registered editor is dirty, the client navigation is
 * cancelled, `confirmLeave()` flushes (or asks), and the link is followed with `router.push` once confirmed.
 * Modified clicks are never intercepted because Next.js calls `onNavigate` only for client navigations.
 */
export function GuardedLink({ onNavigate, ...props }: ComponentProps<typeof Link>) {
  const guard = useContext(NavigationGuardContext);
  const router = useRouter();
  const { href } = props;

  return (
    <Link
      {...props}
      onNavigate={(event) => {
        void runGuardedNavigate(event, {
          onNavigate,
          isDirty: guard.hasDirtyGuard,
          confirmLeave: guard.confirmLeave,
          navigate: () => router.push(resolveHref(href)),
        });
      }}
    />
  );
}
