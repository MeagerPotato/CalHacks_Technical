# Astra handoff: Phase 2 creative pass

The applicant product works end to end:

- signup, login, and onboarding;
- the Hacker and Judge editor, with draft saving and Launch Readiness;
- review and submission;
- the portal and the Rocket Mission Tracker.

Every page already uses the plan's palette and type (section 13) as a functional baseline, with neutral art placeholders and simple motion.

Your Phase 2 work is creative only:

1. **Art.** Original illustrations that replace the placeholders in `components/art/`.
2. **Motion.** Choreography beyond the baseline: liftoff, landing, rocket stages, and small decorative motion.
3. **Visual polish** within the frozen contract and the contrast rules: type scale, spacing rhythm, surfaces, textures, hover and pressed states, and composition.
4. **Voice.** The supporting copy in `content/copy.ts`: `COPY`, `FIELD_COPY`, and `SECTION_COPY`.
5. **QA.** A final look-and-feel pass.

Claude owns everything else: routes, data, state, validation, focus management, accessibility behavior, and tests. If a creative idea needs a change outside your write set, add it to [astra-requests.md](astra-requests.md) and ship a fallback.

## Quick start

Design work needs no Docker or Supabase:

```bash
npm install
npm run dev
```

- **http://localhost:3000/dev/gallery** is your design surface. It renders every view and state from the same view-model functions the product uses. That includes:
  - primitives, fields with errors, every notice, and page states;
  - each art slot, with a "Replay motion" button for play-once motion;
  - the portal dashboards, editor pieces, review, submitted view, and liftoff;
  - the mission tracker for submitted, in review, Accepted, and Waitlisted.

  Views with fixed ids (the portal dashboard and the mission tracker) show one state at a time; switch states with the links in their sections. The gallery returns 404 in production builds.
- **http://localhost:3000** is the landing page. `/login` and `/signup` render without Supabase, but submitting them needs the local stack.

To click through real pages, start Docker Desktop, run `npm run db:start`, and create `.env.local` as described in `docs/infrastructure/environment-and-deployment.md`. Seed accounts cannot sign in, so sign up a new Hacker or Judge.

## Your write set

| Path | You may change | Must stay |
|---|---|---|
| `components/art/**` | Anything inside each component: inline SVG, CSS motion, or `next/image` for files in `public/art/` | File names, component names, and props. Decorative art stays `aria-hidden`. `BrandMark` still renders the brand name from `LOCKED.brand`. |
| `public/art/**` | New image files (prefer SVG; keep raster files small) | |
| `app/globals.css` | Token values, new tokens, `@utility` rules, `@keyframes`, `--animate-*` tokens | Semantic token names; the `:focus-visible` ring; the reduced-motion block; the `data-reveal` and draw-in rules; the 16px base size. The contrast test must stay green. |
| `app/fonts.ts` | The display face (the plan also allows Space Grotesk) | The `fontVariables` export and the `--font-body-face` and `--font-display-face` names |
| `components/**` (outside `art`) | `className` strings, the exported class maps (`VARIANT_CLASSES`, `LINK_VARIANT_CLASSES`, `BADGE_TONE_CLASSES`, `CARD_TONE_CLASSES`, `NOTICE_TONE_CLASSES`, `INPUT_CLASSES`), decorative wrappers, and decorative `aria-hidden` elements | Props, ids, roles, `aria-*`, `data-*`, `data-testid`, text that comes from props, the elements listed in the frozen contract, and the order of interactive elements |
| `content/copy.ts` | Any value in `COPY`; new entries in `FIELD_COPY` (`label`, `help`) and `SECTION_COPY` (`intro`) | Every key and function signature. Never edit `LOCKED`. |
| `docs/frontend/astra-requests.md` | Append requests | |

Do not edit anything else, including:

- `app/**` other than `globals.css` and `fonts.ts`: pages, layouts, `_components`, route handlers, error boundaries, and the gallery;
- `lib/**`, `tests/**`, `e2e/**`, `supabase/**`, `proxy.ts`, `types/**`;
- `package.json` and `package-lock.json`: no new dependencies, including animation or UI libraries;
- the ESLint, Vitest, Playwright, TypeScript, and Next.js configs;
- `docs/infrastructure/**`, `CLAUDE.md`, `PROJECT_PLAN.md`.

`components/**` is presentational, and ESLint enforces it:

- **Banned imports:** `@/app/*`, `@supabase/*`, `server-only`, `next/navigation`, `next/headers`, `next/cache`, `next/link`, `@/lib/env`, `@/lib/event`, and the logic modules (`@/lib/actions`, `auth`, `data`, `editor`, `format`, `supabase`, `validation`, `view-models`). Type-only imports from the logic modules and from `@/lib/application-config` are fine.
- **Links:** internal links go through `AppLink`, which respects the unsaved-changes guard.
- **Icons:** Lucide icons are approved for functional use. Mark them `aria-hidden` and always pair them with text.

## Frozen DOM contract

The unit and end-to-end tests select by role, accessible name, id, `data-testid`, and `data-*` attributes, never by CSS class or DOM depth. Restyling is safe as long as everything below stays.

Accessible names come from `content/copy.ts`, and the tests import them, so rewording `COPY` is safe.

**Landmarks and skip link**

- Exactly one `main#main` with `tabIndex={-1}` per page.
- The skip link `a[href="#main"]` is the first focusable element. `app/_components/SkipToContent.tsx` renders it and moves focus without adding a history entry; style it in `components/ui/SkipLink.tsx`.

**Ids**

- A field's control is `field-<key>`; its hint, error, and counter are `field-<key>-hint`, `field-<key>-error`, and `field-<key>-counter`.
- In choice groups, the first radio or checkbox is `field-<key>` and the others are `field-<key>-<value>`.
- Auth field keys are `email`, `password`, `applicationTypes`, and `displayName`.
- Editor section headings are `h2#section-heading-<step>` with `tabIndex={-1}`.
- The submit note is `#review-irreversible`.

**`data-testid` values**

`error-summary`, `launch-readiness`, `readiness-item-<sectionId>`, `section-nav`, `section-select`, `section-go`, `save-status`, `answer-summary`, `review-submit`, `submitted-application`, `launch-transition`, `mission-tracker`, `mission-leg-<leg>`, `decision-card`, `progress-card`, `deadline-card`, `submitted-card`, `check-email`, `landing-portal-card`, `notice-<id>`, `live-status`.

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

These attributes are also your styling hooks. For example, use `data-[state=complete]:` and `data-[needs-attention=true]:` variants instead of new props.

**ARIA**

- `aria-current="step"` on the current readiness link, the current mission leg `li`, and the active section nav link.
- Progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext`.
- `ErrorSummary` has `tabIndex={-1}` and `aria-labelledby`.
- `LiveStatus` has `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`, and stays visually hidden.
- The Submit application button has `aria-describedby="review-irreversible"`.

**Elements**

- The readiness list and mission legs are `ol > li`.
- `AnswerSummary` uses `dl`, `dt`, and `dd`.
- Timestamps are `time[dateTime]`.
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

Application status labels ("Application submitted", "Under review", "Accepted", "Waitlisted") live in `lib/application-config.ts` and are also fixed. Themed language may sit next to them, but never replaces them.

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
| `page` | cream | Page background |
| `surface` | white | Cards and inputs |
| `ink` | navy | Text |
| `border` | navy | Borders |
| `action` / `on-action` | coral / navy | Primary actions |
| `success` / `on-success` | evergreen / white | Accepted and success fills |
| `highlight` | gold | Highlights, Waitlisted |
| `accent` | sky | Info fills |
| `dark` / `on-dark` | navy / cream | Dark surfaces (mark them `data-surface="dark"`) |
| `focus` / `focus-on-dark` | navy / sky | Focus rings |
| `danger-edge` | coral | Error edges and icons, never text. Against the cream page it is only 2.89:1, so it never forms a control's outer edge: invalid inputs keep the navy border and add an inset coral ring. |

Other tokens: `--radius-card`, `--radius-control`, `--shadow-card`, `--duration-liftoff`, `--duration-landing`, `--duration-reveal`, and `--animate-float`. You may add tokens freely.

Contrast rules:

- Navy text on coral actions. Never white text on coral, gold, or sky.
- Coral is never text, only error edges and icons.
- White text on evergreen is allowed.
- Errors are ink text with a coral edge and an icon.

`tests/unit/design-tokens.test.ts` enforces these rules:

- **Text pairs, at least 4.5:1:** ink on page, ink on surface, on-action on action, on-success on success, ink on highlight, ink on accent, and on-dark on dark.
- **Focus rings and edges, at least 3:1:** focus on page, focus on surface, focus-on-dark on dark, danger-edge on surface, and border on page.
- **Class strings:** it scans every class string in `components/**`. It fails on `text-coral`, `text-action`, or `text-danger-edge`. It also fails when a text token and a fill token apply in the same state (variants such as `hover:` or `data-[...]:` included) with less than 4.5:1 contrast, for example `bg-success text-ink` or `bg-accent text-on-dark`. On evergreen use `text-on-success`; on gold, sky, coral, or white use `text-ink` or `text-on-action`.

Textures need the same care. axe cannot measure contrast over a `background-image` or gradient, and `expectNoAxeViolations` in `e2e/support/ui.ts` fails when text sits on one. Paint a texture on a pseudo-element, as the body's paper dots (`body::before`) and the card rivet (`::after`) do, or give the text an opaque fill above it, as the Launch Readiness heading does.

## Art slots

Every slot is a server component with no hooks. Keep the props, keep art decorative (`aria-hidden`), and keep a fixed aspect ratio so nothing shifts while images load.

| Component | Props | Where it appears |
|---|---|---|
| `BrandMark` | none | Headers on the landing, auth, and portal pages, inside the home link. It must render the brand name from `LOCKED.brand` as text, which names the link. |
| `HeroArt` | none | Landing hero (plan section 13, "Hero art") |
| `EngineerArt` | `variant: "landing" \| "dashboard"` | `landing` on the landing page; `dashboard` on the draft portal |
| `RocketArt` | `stage: "launch" \| "cruise" \| "landing"` | The mission tracker's scene, following the application's stage |
| `Sticker` | `name: "star" \| "wrench" \| "planet" \| "antenna" \| "bolt" \| "patch"` | The landing page's promise cards (wrench, star, planet). You may add stickers to other views as decorative `aria-hidden` accents. |
| `LiftoffMoment` | none | Full-width liftoff after a successful submission, under the "Liftoff!" heading |
| `LandingMoment` | `decision: "accepted" \| "waitlisted"` | The mission tracker once a decision is released, before the decision card appears |

`components/art/motion.ts` exports `LIFTOFF_DURATION_MS` (2400) and `LANDING_DURATION_MS` (1600). Code depends on them: the editor moves to the tracker when liftoff ends.

## Motion rules

- **Reduced motion.** Under `prefers-reduced-motion: reduce`, the global block in `globals.css` makes every animation and transition finish instantly, with no delay. Design each moment so its final frame is complete and meaningful. Put motion behind `motion-safe:` variants or `@media (prefers-reduced-motion: no-preference)`.
- **Liftoff.** It lasts `--duration-liftoff`, which must equal `LIFTOFF_DURATION_MS` (a unit test checks this). The editor navigates to the tracker when it elapses, or immediately under reduced motion. Keep it around 3 seconds or less, because the applicant is waiting.
- **Landing.** `--duration-landing` must equal `LANDING_DURATION_MS`. The decision card has `data-reveal="after-landing"` and fades in after that delay. The decision text is in the DOM from the start, so screen readers never wait for the animation.
- **Just completed.** When a section has just been completed, `[data-just-completed="true"] [data-progress-line]` draws the readiness progress line once.
- **Autoplay limit.** Autoplaying motion must stop within 5 seconds (WCAG 2.2.2). `--animate-float` runs two alternating cycles (4.8 seconds) and ends at rest; keep any loop you add finite too. Nothing may flash more than three times per second.
- **Loading spinners.** `animate-spin` marks work that is still running, so it keeps Tailwind's infinite `--animate-spin`. Do not override that token: a spinner that stops mid-save looks frozen. A unit test checks this.
- **Pressed states.** `pressable` lifts a control on hover and sinks it on press. A transform moves the hit area too, so the utility's transparent `::after` layer covers the ground the face just left. If you change the offsets, resize that layer to match. An end-to-end test clicks 1px inside the top and bottom edges.
- **Performance.** Animate `transform` and `opacity` only.

## Tasks, in priority order

Your usage is limited, so the list starts with what the demo shows most.

1. **Brand and landing.** Replace `BrandMark`, `HeroArt`, and `EngineerArt` with an original illustration family: a small animal engineer with a sticker-bomb retro-futurist feel, per plan section 13. Use `Sticker` accents on the promise cards and the portal.
2. **Liftoff and landing.** Build `LiftoffMoment`, `RocketArt` (all three stages), and `LandingMoment` (Accepted and Waitlisted variants) within the motion rules.
3. **Polish.** Set the type scale, spacing rhythm, card and button states (hover, pressed, focus), and surfaces through `globals.css` tokens and the class maps. Give Launch Readiness and the Mission Tracker their scene treatment.
4. **Voice.** Rewrite `COPY` in the product voice. Add `FIELD_COPY` help where a question benefits from it, and `SECTION_COPY` intros.
5. **QA.** At 375px and 1280px, with reduced motion on and off, check the gallery and the landing page (and the real flow if you run Supabase). Tab through each page to confirm focus rings are visible.

## Verify your work without Docker

```bash
npm run lint
npm run typecheck
npm run test:unit
```

- **Lint** catches boundary breaks and React rule problems.
- **Typecheck** catches prop and copy signature changes.
- **Unit tests** catch contrast, token names, motion constants, the focus and reduced-motion rules, banned color utilities, and the DOM contract of every component.

Then check `/dev/gallery` and `/` in the browser as described in task 5.

## When you hand back

Reply with:

- the files you changed and any new assets;
- token and font changes;
- anything you are unsure keeps the contract;
- open requests in `astra-requests.md`.

Claude then runs `npm run verify`, `npm run test:integration`, and `npm run test:e2e`, and checks the diff against the write set. Claude fixes contract breaks and logic regressions without re-litigating visual choices, and implements your requests.
