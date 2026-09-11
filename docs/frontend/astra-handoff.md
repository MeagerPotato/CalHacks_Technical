# Astra handoff: final creative pass

> **Status:** Round 2 and your final creative pass shipped on 2026-09-11. [Final pass results](#final-pass-results) records what changed. A later pass starts with a new task list there.

The product works end to end:

- signup (Hacker, Judge, or both), login, and onboarding;
- the Hacker and Judge editor, with draft saving and Launch Readiness;
- review and submission;
- the portal, with a switcher for accounts that hold both applications, and the Rocket Mission Tracker;
- the landing page, with the Cal Hacks 13.0 mission timeline and live countdowns;
- the organizer pages: the Mission Control dashboard, the applications table, and the blind review workspace.

Your passes set the brand, art, and motion, designed the round 2 surfaces, and polished them. Any further design work stays within the same creative-only scope:

1. **Art.** Original illustrations in `components/art/`, plus decorative `aria-hidden` accents inside views.
2. **Motion.** Choreography beyond the baseline, following the motion rules below.
3. **Visual polish** within the frozen contract and the contrast rules: type scale, spacing rhythm, surfaces, textures, hover and pressed states, and composition.
4. **Voice.** The supporting copy in `content/copy.ts`: `COPY`, `FIELD_COPY`, `SECTION_COPY`, and `ORGANIZER_COPY`.
5. **QA.** A final look-and-feel pass.

Claude owns everything else: routes, data, state, validation, focus management, accessibility behavior, and tests. If a creative idea needs a change outside your write set, add it to [astra-requests.md](astra-requests.md) and ship a fallback.

## Surfaces added in round 2

| Surface | Component | Where to see it |
|---|---|---|
| Application switcher (Hacker and Judge) | `components/portal/ApplicationSwitcher.tsx`, inside `PortalWelcome` | `/dev/gallery?portal=both-hacker#gallery-portal-view` and `?portal=both-judge` |
| Mission timeline | `components/schedule/MissionTimeline.tsx`, on the landing page | `/`, and the `Schedule: …` sections of `/dev/gallery` (four moments of the schedule) |
| Countdowns (time to launch, time to landing) | `components/schedule/CountdownPanel.tsx`, on the landing page and both portal dashboards | `/`, and `#gallery-schedule` in `/dev/gallery` (live) |
| Required-question asterisk | `RequiredMarker` in `components/ui/Field.tsx`, and the legend in `SectionPanel` | `#gallery-fields` in `/dev/gallery`, and every editor section |
| Country of residence picker | `components/ui/Combobox.tsx` | `#gallery-fields` in `/dev/gallery` (interactive), and the editor's About you section |
| Signup choice of Hacker, Judge, or both | `CheckboxGroup` on `/signup` | `/signup` (renders without Supabase) |
| Onboarding "Applying as" badges | `Badge tone="info"` on `/onboarding` | The real flow (needs the local stack) |
| Organizer pages | `components/organizer/*.tsx` | `/dev/gallery/organizer`, linked from the top of `/dev/gallery` |

## Quick start

Design work needs no Docker or Supabase:

```bash
npm install
npm run dev
```

- **http://localhost:3000/dev/gallery** is your design surface. It renders every applicant view and state from the same view-model functions the product uses:
  - primitives, fields with errors and the required asterisk, the country picker, every notice, and page states;
  - each art slot, with a "Replay motion" button for play-once motion;
  - the live countdowns, and the timeline with the countdown panel at four moments of the schedule;
  - the portal dashboards (including both switcher states), editor pieces, review, submitted view, and liftoff;
  - the mission tracker for submitted, in review, Accepted, and Waitlisted.

  Views with fixed ids (the portal dashboard and the mission tracker) show one state at a time; switch states with the links in their sections. The gallery returns 404 in production builds.
- **http://localhost:3000/dev/gallery/organizer** shows every organizer state: `?dashboard=`, `?applications=`, and `?workspace=` choose the variant (see [organizer.md](organizer.md#gallery)).
- **http://localhost:3000** is the landing page, with the live timeline and countdowns. `/login` and `/signup` render without Supabase, but submitting them needs the local stack.

To click through real pages, start Docker Desktop, run `npm run db:start`, and create `.env.local` as described in `docs/infrastructure/environment-and-deployment.md`. Seed accounts cannot sign in, so sign up a new Hacker or Judge (choose both to see the switcher). Claude gives the user a local Organizer login separately.

## Final pass results

Shipped on 2026-09-11:

1. **Applications filter row.** From `xl`, Search in `ApplicationFilters` takes its own row and the four selects share the next one. Every select shows its longest option in full from 375px to 1536px.
2. **Timeline route.** One dashed line in `MissionTimeline` joins the stop markers. It runs down the left edge while the stops stack, and across above the cards from `lg`.
   - The stops now stack in one column below `lg`.
   - The markers are placed from each card's padding box, so complete stops, which have a thicker top border, move up 4px to stay on the line.
3. **Mission clock.** The gold dot in `CountdownPanel` shows only from `sm`.
4. **Copy.** The timeline states, `COPY.schedule.timeline.toBeAnnounced`, and both countdown captions now say plainly what they mean. The captions end with a colon because `Timestamp` prints the date right after them.

Changes the user asked for after the pass, on the same day: the landing page now runs hero, flight plan, portal card, mission clock, promise cards; the countdown panel lost its pause toggle; and an upcoming stop that is not the current one shows no state badge.

Open polish for any later pass: while the stops stack, the dashed line runs past the last marker to the bottom of the last card.

The judging rubric may change the scorecard's dimensions later. `Scorecard` and `RubricScoreField` render the dimensions from data, so your styling holds for any list of dimensions.

### Rules carried over from round 2

- The switcher's current application stays distinguishable without color. `aria-current="page"` is the styling hook.
- Every timeline stop keeps its name and date as text, and the current stop keeps its state as text.
- The countdown panel has no controls of its own, and a complete countdown shows its text instead of digits.
- On the organizer pages, keep the radar's table alternative, the counts beside the bars, and the blind-mode status text.

## Your write set

| Path | You may change | Must stay |
|---|---|---|
| `components/art/**` | Anything inside each component: inline SVG, CSS motion, or `next/image` for files in `public/art/` | File names, component names, and props. Decorative art stays `aria-hidden`. `BrandMark` still renders the brand name from `LOCKED.brand`. |
| `public/art/**` | New image files (prefer SVG; keep raster files small) | |
| `app/globals.css` | Token values, new tokens, `@utility` rules, `@keyframes`, `--animate-*` tokens | Semantic token names; the `:focus-visible` ring; the reduced-motion block; the `data-reveal` and draw-in rules; the 16px base size. The contrast test must stay green. |
| `app/fonts.ts` | The display face (the plan also allows Space Grotesk) | The `fontVariables` export and the `--font-body-face` and `--font-display-face` names |
| `components/**` (outside `art`), including `components/schedule/**` and `components/organizer/**` | `className` strings, the exported class maps (`VARIANT_CLASSES`, `LINK_VARIANT_CLASSES`, `BADGE_TONE_CLASSES`, `CARD_TONE_CLASSES`, `NOTICE_TONE_CLASSES`, `INPUT_CLASSES`, `SWITCHER_CURRENT_CLASSES`, `SWITCHER_OTHER_CLASSES`), decorative wrappers, and decorative `aria-hidden` elements | Props, ids, roles, `aria-*`, `data-*`, `data-testid`, text that comes from props, the elements listed in the frozen contract and in [organizer.md](organizer.md#component-contracts), and the order of interactive elements |
| `content/copy.ts` | Any value in `COPY` and `ORGANIZER_COPY`; new entries in `FIELD_COPY` (`label`, `help`) and `SECTION_COPY` (`intro`) | Every key and function signature. Never edit `LOCKED` or `ORGANIZER_LOCKED`. |
| `docs/frontend/astra-requests.md` | Append requests | |

Do not edit anything else, including:

- `app/**` other than `globals.css` and `fonts.ts`: pages, layouts, `_components`, route handlers, error boundaries, and the galleries;
- `lib/**` (including `lib/event.ts`, which holds the schedule dates), `tests/**`, `e2e/**`, `supabase/**`, `proxy.ts`, `types/**`;
- `package.json` and `package-lock.json`: no new dependencies, including animation or UI libraries;
- the ESLint, Vitest, Playwright, TypeScript, and Next.js configs;
- `docs/infrastructure/**`, `CLAUDE.md`, `PROJECT_PLAN.md`.

`components/**` is presentational, and ESLint enforces it:

- **Banned imports:** `@/app/*`, `@supabase/*`, `server-only`, `next/navigation`, `next/headers`, `next/cache`, `next/link`, `@/lib/env`, `@/lib/event`, and the logic modules (`@/lib/actions`, `auth`, `data`, `editor`, `format`, `supabase`, `validation`, `view-models`). Type-only imports from the logic modules and from `@/lib/application-config` are fine.
- **Links:** internal links go through `AppLink` (or `GuardedLink`, as the switcher does), which respects the unsaved-changes guard.
- **Icons:** Lucide icons are approved for functional use. Mark them `aria-hidden` and always pair them with text.

## Frozen DOM contract

The unit and end-to-end tests select by role, accessible name, id, `data-testid`, and `data-*` attributes, never by CSS class or DOM depth. Restyling is safe as long as everything below stays. The organizer pages have their own contract in [organizer.md](organizer.md#component-contracts).

Accessible names come from `content/copy.ts`, and the tests import them, so rewording `COPY` is safe.

**Landmarks and skip link**

- Exactly one `main#main` with `tabIndex={-1}` per page.
- The skip link `a[href="#main"]` is the first focusable element. `app/_components/SkipToContent.tsx` renders it and moves focus without adding a history entry; style it in `components/ui/SkipLink.tsx`.

**Ids**

- A field's control is `field-<key>`; its hint, error, and counter are `field-<key>-hint`, `field-<key>-error`, and `field-<key>-counter`.
- In choice groups, the first radio or checkbox is `field-<key>` and the others are `field-<key>-<value>`.
- The country picker's list is `field-<key>-listbox`, and each option is `field-<key>-option-<value>`.
- Auth field keys are `email`, `password`, `applicationTypes`, and `displayName`.
- Editor section headings are `h2#section-heading-<step>` with `tabIndex={-1}`.
- The submit note is `#review-irreversible`.
- The countdown panel heading is `h2#countdowns-title`; the timeline heading is `h2#mission-timeline-title`.

**`data-testid` values**

`error-summary`, `launch-readiness`, `readiness-item-<sectionId>`, `section-nav`, `section-select`, `section-go`, `save-status`, `answer-summary`, `review-submit`, `submitted-application`, `launch-transition`, `mission-tracker`, `mission-leg-<leg>`, `decision-card`, `progress-card`, `deadline-card`, `submitted-card`, `check-email`, `landing-portal-card`, `landing-promises`, `notice-<id>`, `live-status`, `application-switcher`, `countdowns`, `countdown-launch`, `countdown-landing`, `mission-timeline`, `timeline-stop-<id>` (`applicationsOpen`, `applicationDeadline`, `resultsReleased`, `event`).

**Data attributes**

| Element | Attributes |
|---|---|
| Readiness item | `data-state`, `data-current`, `data-just-completed`, `data-needs-attention` |
| Section nav item | `data-state`, `data-needs-attention`, `data-just-completed` |
| `save-status` | `data-state` |
| `mission-tracker` | `data-stage` |
| Mission leg | `data-state` |
| `decision-card` | `data-status`, `data-reveal="after-landing"` |
| `StatusBadge` | `data-status` |
| `Button` | `data-variant`, `data-pending` |
| `Notice` | `data-tone` |
| Switcher link | `data-type` (`hacker`, `judge`), `data-state` (`current`, `other`) |
| Timeline stop | `data-state` (`complete`, `active`, `upcoming`), `data-current` |
| Countdown (`countdown-<id>`) | `data-state` (`counting`, `complete`) |
| Countdown parts | `data-countdown-digits` (the digit row), `data-unit` (`days`, `hours`, `minutes`, `seconds`), `data-countdown-value`, `data-countdown-summary` |
| Required marker and legend | `data-required-marker`, `data-required-legend` |
| Country picker | popup `data-state` (`open`, `closed`); option `data-active` |

These attributes are also your styling hooks. For example, use `data-[state=complete]:` and `data-[needs-attention=true]:` variants instead of new props.

**ARIA**

- `aria-current="step"` on the current readiness link, the current mission leg `li`, the active section nav link, and the current timeline stop `li`.
- `aria-current="page"` on the switcher link for the application on screen.
- Progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext`.
- `ErrorSummary` has `tabIndex={-1}` and `aria-labelledby`.
- `LiveStatus` has `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`, and stays visually hidden.
- The Submit application button has `aria-describedby="review-irreversible"`.
- The countdown digit row is `aria-hidden`. The summary under it is visually hidden (`sr-only`) but never `aria-hidden`; a complete countdown shows its summary visibly.
- The required marker is `aria-hidden`; required controls announce `aria-required`, and required groups add visually hidden "(required)" text.
- The country picker follows the WAI-ARIA combobox pattern: `input[role="combobox"]` with `aria-expanded`, `aria-controls`, and `aria-activedescendant`; `ul[role="listbox"]` with `li[role="option"][aria-selected]`.

**Elements**

- The readiness list, mission legs, and timeline stops are `ol > li`. Timeline stop names are `h3`.
- The countdown panel is a `section` named by its `h2`, with a `ul > li` per countdown whose title is an `h3`.
- The switcher is `nav > ul > li > a`.
- `AnswerSummary` uses `dl`, `dt`, and `dd`.
- Timestamps and dates are `time[dateTime]`.
- Choice groups are `fieldset > legend`.
- Text controls have a visible `label[for]`.
- Buttons stay `button` elements and links stay `a` elements.
- `AnswerSummary` section headings are `h3` on the review step and `h2` in the submitted application. Array answers render as a plain-text `ul[role="list"]`, never as links.
- `SectionPanel` marks its section with `data-step`, which you can use as a styling hook.

**Tailwind note.** An underscore in an arbitrary variant value becomes a space: `data-[state=in_progress]:` compiles to `[data-state="in progress"]` and never matches. For state values that contain underscores, use a class map keyed by state, as `LaunchReadiness` does.

## Locked strings

These come from the plan and must not change. Tests and accessible names depend on them.

| Key | Text |
|---|---|
| `LOCKED.brand` | CalHacks Mission Control |
| `LOCKED.landing.heroTitle` | Build what comes next. |
| `LOCKED.landing.heroSubtitle` | Your Cal Hacks mission starts here. |
| `LOCKED.landing.signIn`, `LOCKED.auth.signIn` | Sign in |
| `LOCKED.landing.applyNow` | Apply now |
| `LOCKED.landing.promises` | Assemble, Launch, Explore |
| `LOCKED.auth.createAccount` | Create account |
| `LOCKED.auth.signOut` | Sign out |
| `LOCKED.portal.trackMission` | Track your mission |
| `LOCKED.editor.launchReadiness` | Launch readiness |
| `LOCKED.editor.saveDraft` | Save draft |
| `LOCKED.editor.saveAndContinue` | Save & continue |
| `LOCKED.review.heading` | Ready for launch |
| `LOCKED.review.submit` | Submit application |
| `LOCKED.review.irreversible` | You can't edit your application after you submit it. |
| `LOCKED.launch.heading` | Liftoff! |
| `LOCKED.mission.cruising` | Cruising to your destination |
| `LOCKED.mission.landed` | Landing complete |
| `LOCKED.mission.legs` | Launch, Cruise, Landing |
| `ORGANIZER_LOCKED` | The organizer headings and button labels from plan section 14 (see [organizer.md](organizer.md)) |

Application status labels ("Application submitted", "Under review", "Accepted", "Waitlisted") and application type labels ("Hacker", "Judge") live in `lib/application-config.ts` and are also fixed. Themed language may sit next to them, but never replaces them.

## Tokens and contrast

The palette is defined in `app/globals.css` (`@theme static`):

| Token | Value |
|---|---|
| `--color-navy` | `#14233b` |
| `--color-cream` | `#fff8ed` |
| `--color-sky` | `#9edae5` |
| `--color-coral` | `#ef6a5b` |
| `--color-gold` | `#f6c453` |
| `--color-evergreen` | `#2d6a61` |
| `--color-white` | `#ffffff` |

Semantic tokens have frozen names. Components use them through Tailwind utilities such as `bg-action` and `text-on-action`.

| Semantic token | Maps to | Use |
|---|---|---|
| `page` | cream | Page background, and the switcher's other application |
| `surface` | white | Cards and inputs |
| `ink` | navy | Text |
| `border` | navy | Borders |
| `action` / `on-action` | coral / navy | Primary actions, and the switcher's current Hacker application |
| `success` / `on-success` | evergreen / white | Accepted and success fills |
| `highlight` | gold | Highlights, Waitlisted |
| `accent` | sky | Info fills, and the switcher's current Judge application |
| `dark` / `on-dark` | navy / cream | Dark surfaces (mark them `data-surface="dark"`) |
| `focus` / `focus-on-dark` | navy / sky | Focus rings |
| `danger-edge` | coral | Error edges and icons, never text. Against the cream page it is only 2.89:1, so it never forms a control's outer edge: invalid inputs keep the navy border and add an inset coral ring. |
| `required` | `#b5382b` (a deep red) | The required-question asterisk. It is text, so it must keep 4.5:1 on page and surface. |

Other tokens: `--radius-card`, `--radius-control`, `--shadow-card`, `--duration-liftoff`, `--duration-landing`, `--duration-reveal`, and `--animate-float`. You may add tokens freely.

Contrast rules:

- Navy text on coral actions. Never white text on coral, gold, or sky.
- Coral is never text, only error edges and icons. The required asterisk uses `text-required`, not coral.
- White text on evergreen is allowed.
- Errors are ink text with a coral edge and an icon.

`tests/unit/design-tokens.test.ts` enforces these rules:

- **Text pairs, at least 4.5:1:** ink on page, ink on surface, on-action on action, on-success on success, ink on highlight, ink on accent, on-dark on dark, and required on page and on surface.
- **Focus rings and edges, at least 3:1:** focus on page, focus on surface, focus-on-dark on dark, danger-edge on surface, and border on page.
- **Class strings:** it scans every class string in `components/**`. It fails on `text-coral`, `text-action`, or `text-danger-edge`. It also fails when a text token and a fill token apply in the same state (variants such as `hover:` or `data-[...]:` included) with less than 4.5:1 contrast, for example `bg-success text-ink` or `bg-accent text-on-dark`. On evergreen use `text-on-success`; on gold, sky, coral, or white use `text-ink` or `text-on-action`.

Textures need the same care. axe cannot measure contrast over a `background-image` or gradient, and `expectNoAxeViolations` in `e2e/support/ui.ts` fails when text sits on one. Paint a texture on a pseudo-element, as the body's paper dots (`body::before`) and the card rivet (`::after`) do, or give the text an opaque fill above it, as the Launch Readiness heading does. The timeline's flight path and the countdown readout follow the same rule.

## Art slots

Every slot is a server component with no hooks. Keep the props, keep art decorative (`aria-hidden`), and keep a fixed aspect ratio so nothing shifts while images load.

| Component | Props | Where it appears |
|---|---|---|
| `BrandMark` | none | Headers on the landing, auth, portal, and organizer pages, inside the home link. It must render the brand name from `LOCKED.brand` as text, which names the link. |
| `HeroArt` | none | Landing hero (plan section 13, "Hero art") |
| `EngineerArt` | `variant: "landing" \| "dashboard"` | `landing` on the landing page; `dashboard` on the draft portal |
| `RocketArt` | `stage: "launch" \| "cruise" \| "landing"` | The mission tracker's scene, following the application's stage |
| `Sticker` | `name: "star" \| "wrench" \| "planet" \| "antenna" \| "bolt" \| "patch"` | The landing page's promise cards (wrench, star, planet). You may add stickers to other views as decorative `aria-hidden` accents. |
| `LiftoffMoment` | none | Full-width liftoff after a successful submission, under the "Liftoff!" heading |
| `LandingMoment` | `decision: "accepted" \| "waitlisted"` | The mission tracker once a decision is released, before the decision card appears |

The timeline and countdowns have no art slot. Draw their rocket, planets, and flight path as decorative `aria-hidden` elements inside `MissionTimeline` and `CountdownPanel`, or reuse `Sticker` and `RocketArt` there. If you need a new slot component, request it.

`components/art/motion.ts` exports `LIFTOFF_DURATION_MS` (2400) and `LANDING_DURATION_MS` (1600). Code depends on them: the editor moves to the tracker when liftoff ends.

## Motion rules

- **Reduced motion.** Under `prefers-reduced-motion: reduce`, the global block in `globals.css` makes every animation and transition finish instantly, with no delay. Design each moment so its final frame is complete and meaningful. Put motion behind `motion-safe:` variants or `@media (prefers-reduced-motion: no-preference)`.
- **Liftoff.** It lasts `--duration-liftoff`, which must equal `LIFTOFF_DURATION_MS` (a unit test checks this). The editor navigates to the tracker when it elapses, or immediately under reduced motion. Keep it around 3 seconds or less, because the applicant is waiting.
- **Landing.** `--duration-landing` must equal `LANDING_DURATION_MS`. The decision card has `data-reveal="after-landing"` and fades in after that delay. The decision text is in the DOM from the start, so screen readers never wait for the animation.
- **Just completed.** When a section has just been completed, `[data-just-completed="true"] [data-progress-line]` draws the readiness progress line once.
- **Autoplay limit.** Autoplaying motion must stop within 5 seconds (WCAG 2.2.2). `--animate-float` runs two alternating cycles (4.8 seconds) and ends at rest; keep any loop you add finite too. Nothing may flash more than three times per second.
- **Countdowns.** The digits already update every second. Do not add an animation that runs on every tick, and do not loop the rocket on the timeline.
- **Loading spinners.** `animate-spin` marks work that is still running, so it keeps Tailwind's infinite `--animate-spin`. Do not override that token: a spinner that stops mid-save looks frozen. A unit test checks this.
- **Pressed states.** `pressable` lifts a control on hover and sinks it on press. A transform moves the hit area too, so the utility's transparent `::after` layer covers the ground the face just left. If you change the offsets, resize that layer to match. An end-to-end test clicks 1px inside the top and bottom edges.
- **Performance.** Animate `transform` and `opacity` only.

## Verify your work without Docker

```bash
npm run lint
npm run typecheck
npm run test:unit
```

- **Lint** catches boundary breaks and React rule problems.
- **Typecheck** catches prop and copy signature changes.
- **Unit tests** catch contrast, token names, motion constants, the focus and reduced-motion rules, banned color utilities, and the DOM contract of every component, including the organizer views.

Then check `/`, `/dev/gallery`, and `/dev/gallery/organizer` in the browser as described in task 8.

## When you hand back

Reply with:

- the files you changed and any new assets;
- token and font changes;
- anything you are unsure keeps the contract;
- open requests in `astra-requests.md`.

Claude then runs `npm run verify`, `npm run test:integration`, and `npm run test:e2e`, and checks the diff against the write set. Claude fixes contract breaks and logic regressions without re-litigating visual choices, and implements your requests.
