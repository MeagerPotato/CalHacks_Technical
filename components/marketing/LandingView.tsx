import type { ReactNode } from "react";

import { EngineerArt } from "@/components/art/EngineerArt";
import { HeroArt } from "@/components/art/HeroArt";
import { BrandMark } from "@/components/art/BrandMark";
import { Sticker, type StickerName } from "@/components/art/Sticker";
import { MissionTimeline } from "@/components/schedule/MissionTimeline";
import { AppLink } from "@/components/ui/AppLink";
import { Card } from "@/components/ui/Card";
import { COPY, LOCKED } from "@/content/copy";
import { ROUTES } from "@/lib/routes";
import type { TimelineView } from "@/lib/view-models/types";

type PromiseKey = keyof typeof LOCKED.landing.promises;

const PROMISES = ["assemble", "launch", "explore"] as const satisfies readonly PromiseKey[];

// Decorative accents only; Astra replaces the sticker art.
const PROMISE_STICKERS = {
  assemble: "wrench",
  launch: "star",
  explore: "planet",
} as const satisfies Record<PromiseKey, StickerName>;

const PORTAL_CARD_TITLE_ID = "landing-portal-card-title";

export interface LandingViewProps {
  /** The live countdown panel (a client container), or null when neither countdown has a date. */
  countdowns: ReactNode;
  timeline: TimelineView;
}

/**
 * The public landing page (PROJECT_PLAN.md section 14): a compact nav, the hero, the mission timeline, the portal
 * card with the Apply now and Sign in links, the countdowns, and the Assemble, Launch, and Explore promise cards.
 */
export function LandingView({ countdowns, timeline }: LandingViewProps) {
  return (
    <>
      <header className="border-b border-border bg-page">
        <nav
          aria-label={COPY.landing.navLabel}
          className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-4 sm:px-5"
        >
          <AppLink href={ROUTES.home} variant="plain">
            <BrandMark />
          </AppLink>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <AppLink href={ROUTES.login} variant="quiet">
              {LOCKED.landing.signIn}
            </AppLink>
            <AppLink href={ROUTES.signup} variant="primary">
              {LOCKED.landing.applyNow}
            </AppLink>
          </div>
        </nav>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10 md:gap-10 md:py-12"
      >
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h1 className="landing-title font-extrabold">{LOCKED.landing.heroTitle}</h1>
            <p className="max-w-sm text-xl font-semibold leading-snug sm:text-2xl">{LOCKED.landing.heroSubtitle}</p>
            <p className="text-base">{COPY.landing.tagline}</p>
          </div>
          <HeroArt />
        </div>

        <MissionTimeline view={timeline} />

        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card labelledBy={PORTAL_CARD_TITLE_ID} data-testid="landing-portal-card">
            <div className="flex flex-col gap-4">
              <h2 id={PORTAL_CARD_TITLE_ID} className="text-2xl font-bold">
                {COPY.landing.portalCard.title}
              </h2>
              <p>{COPY.landing.portalCard.body}</p>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <AppLink href={ROUTES.signup} variant="primary">
                  {LOCKED.landing.applyNow}
                </AppLink>
                <AppLink href={ROUTES.login} variant="secondary">
                  {LOCKED.landing.signIn}
                </AppLink>
              </div>
            </div>
          </Card>
          <div className="mx-auto w-full max-w-[220px] md:max-w-[260px]">
            <EngineerArt variant="landing" />
          </div>
        </div>

        {countdowns}

        {/* role="list" keeps list semantics in Safari, which drops them from lists styled with list-style: none. */}
        <ul role="list" data-testid="landing-promises" className="grid gap-4 pb-6 md:grid-cols-3">
          {PROMISES.map((key) => (
            // A grid item stretches, so every promise card fills the row height.
            <li key={key} className="grid">
              <Card>
                <div className="flex flex-col gap-3">
                  <Sticker name={PROMISE_STICKERS[key]} />
                  <h2 className="text-2xl font-bold">{LOCKED.landing.promises[key]}</h2>
                  <p>{COPY.landing.promises[key]}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
