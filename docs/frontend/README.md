# CalHacks Mission Control applicant product (Phase 2)

Phase 2 builds the applicant side of CalHacks Mission Control on the Phase 1 backend contract ([docs/infrastructure](../infrastructure/README.md)). It changes no migrations, RLS policies, or Server Action signatures.

| Document | Audience |
|---|---|
| This file | Maintainers: routes, layers, editor state, errors, accessibility, tests |
| [astra-handoff.md](astra-handoff.md) | Astra: the creative write set, frozen DOM contract, tokens, art slots, motion rules |
| [astra-prompt.md](astra-prompt.md) | The prompt to hand Astra |
| [astra-requests.md](astra-requests.md) | Requests from Astra for changes outside the creative write set |

## Routes

| Route | Files | Guard and data | Renders |
|---|---|---|---|
| `/` | `app/(marketing)/page.tsx` | none; renders per request (`connection()`) so the schedule starts from the visit time | `LandingView` with `LiveCountdowns` and `MissionTimeline` |
| `/login` | `app/(auth)/login/page.tsx`, `_components/LoginForm.tsx` | Sanitizes `next` (1–2048 characters) and `error` (known callback codes only) | `AuthShell`, callback notice, `LoginForm` |
| `/signup` | `app/(auth)/signup/page.tsx`, `_components/SignupForm.tsx` | none | `AuthShell`, `SignupForm` (Hacker, Judge, or both), `CheckEmailNotice` when confirmation is on |
| `/auth/callback` | `app/auth/callback/route.ts` | PKCE code exchange | Redirects to `/onboarding` or `/login?error=<code>` |
| `/onboarding` | `app/onboarding/page.tsx`, `_components/OnboardingForm.tsx` | `requireApplicant`; redirects to the editor once every chosen application exists | "Applying as" badges, display name, "Start application" |
| `/portal?type=` | `app/portal/layout.tsx`, `page.tsx` | `requireApplicant`; a missing application redirects to `/onboarding` | `PortalDraftDashboard` or `PortalSubmittedDashboard` with `LiveCountdowns`, and the application switcher when the account holds both |
| `/portal/application?type=` | `app/portal/application/page.tsx`, `_components/*` | `requireApplicant`; `?section=<step>` selects the step | The editor, or the read-only submitted view |
| `/portal/mission?type=` | `app/portal/mission/page.tsx` | `requireApplicant`; drafts redirect to `/portal?type=` | `MissionTracker` |

`?type=hacker` or `?type=judge` selects one of the account's applications. A missing value means the first one the account holds; a value it does not hold redirects to that first one ([backend-contract.md](../infrastructure/backend-contract.md#choosing-an-application-type)).
| `/dev/gallery` | `app/dev/gallery/*` | 404 in production | Every view and state from fixtures |

Each segment that loads data has `loading.tsx` and `error.tsx`. The root has `error.tsx`, `global-error.tsx`, and `not-found.tsx`.

Render redirects always point where the client is already heading. For example, onboarding redirects to the editor because the onboarding form navigates there after `createApplications`, and the editor never redirects on status. A Server Action's `revalidatePath` re-renders the current route in the same response, so this rule avoids a redirect racing the client's own navigation.

## Layers

ESLint enforces these boundaries (`eslint.config.mjs`).

| Layer | Owns | Rules |
|---|---|---|
| `app/**` | Guards, data loading, Server Action calls, client containers, focus, navigation | No `className` or `style` except in `app/layout.tsx` and `app/global-error.tsx`. Presentation belongs in `components`. |
| `components/**` | Presentational views and primitives | Hook-free views with display-ready props. Handlers attach only when a callback is passed. No Supabase, `next/navigation`, `next/headers`, `next/cache`, `next/link`, `server-only`, or logic-module runtime imports. |
| `lib/editor`, `lib/view-models`, `lib/format`, `lib/event.ts` | Pure logic: editor values, steps, reducer, feedback mapping, view models, date formatting, countdown arithmetic, the event schedule | No React. Unit tested. |
| `lib/client` | `useReducedMotion`, `useNow`, the navigation guard, `GuardedLink` | Client-only helpers |
| `content/copy.ts` | `LOCKED` plan-literal strings, and `COPY`, `FIELD_COPY`, and `SECTION_COPY` supporting copy | Hints that restate validation rules are generated from the form config in `lib/view-models/fields.ts` |

Product code cannot import `tests`, fixtures, or `app/dev`.

Server pages build view models (`toPortalView`, `toMissionView`, `toReadinessItems`, `toSectionNavItems`, `toAnswerSections`) and pass them to views. The shared view types are in `lib/view-models/types.ts`.

## Forms and feedback

Auth and onboarding forms are client components. On submit they:

1. prevent the native submit;
2. remove the previous notice (`clearNotice` from `useFormFeedback`), because an alert whose content does not change is not announced again;
3. call the Server Action inside `startTransition`;
4. on success, navigate to the returned `redirectTo` with `router.replace`;
5. on failure, show feedback from `toAuthFeedback`: inline field errors, a focused `ErrorSummary` whose links move focus to the field, and a notice for non-field errors.

A thrown action call becomes a notice through `thrownActionNotice` (`app/_components/thrown-notice.ts`):

- an unrecognized action (a new deployment) shows "CalHacks Mission Control was updated" with a reload action;
- anything else shows the auth network notice.

If onboarding finds the session expired, it sends the applicant to sign in and back. Progress is announced through the always-mounted `LiveStatus`.

`noticeForError` in `lib/editor/feedback.ts` maps every `ActionErrorCode`, plus `network`, `stale_deployment`, and `unconfirmed_submit`, to a notice with actions: retry, reload, reload latest, sign in in a new tab, check status, or dismiss.

## Application editor

`app/portal/application/_components/use-application-editor.ts` holds the editor. It is built on `editorReducer` from `lib/editor/reducer.ts`.

**Saved truth.** The saved application is whichever is newer, by `updatedAt`, of the page props and the latest action result. Local edits are kept as a patch rebased onto it, so a `router.refresh()` or a concurrent save never erases typing.

**Saving.**

- *Single flight.* Saves run through one promise chain. Each pass rebuilds the patch from the newest saved state and current edits, then sends only valid, changed keys (`buildDraftPatch`).
- *Invalid answers.* They stay local with inline errors, while the valid answers still save. The errors are shown before the request starts, so they stay visible when the request fails.
- *Conflicts and locks.* `conflict` offers "Reload latest". `application_locked` refreshes into the read-only view.
- *Signed out.* `unauthenticated` keeps the edits and offers "Sign in in a new tab" with "Try again".
- *Try again.* It repeats the operation that failed. It submits only when the failure came from a submit, never after a background or leave save failed. A save that succeeds or has nothing to save does not change what it repeats.
- *Announcements.* Save results go to `LiveStatus`: saved, nothing to save, needs attention, not saved, or blocked. A failure that reproduces the notice already on screen announces the notice title there, because the unchanged alert is not read again.

**Navigation.**

- The step lives in `?section=<step>` and is updated with `history.pushState`, so Back and Forward move between sections. Back and Forward also save pending answers.
- "Save & continue" saves, stays put if the section has errors, and otherwise moves to the next step and focuses its heading.
- Moving to review waits for pending saves.
- A step change that finishes after the applicant has already picked another step is dropped, so a slow save never pulls them back.
- `#field-<key>` links focus the field.
- The App Router ignores history entries without its state, such as one made by a plain fragment link. The skip link therefore moves focus without adding an entry. If Back reaches such an entry in the editor anyway, the editor re-syncs the router with `history.replaceState`.

**Leaving.** The portal layout's `NavigationGuardProvider` saves before internal navigation (`AppLink` uses `GuardedLink`) and confirms if the save fails. Leaving the editor any other way, such as Back to the portal, still starts a save of the valid pending answers when the editor unmounts. `beforeunload` warns while changes are unsaved.

**Notices and focus.** When a focused notice button disappears, focus moves to a stable place instead of the page body. If the notice clears (Reload latest, Check status, or a Try again that succeeds), focus goes to the section heading. If a retry fails another way and a different notice replaces it, focus goes to the new notice's first action.

**Submitting.** Submit flushes pending saves, then calls `submitApplication`:

- An incomplete application returns `application_incomplete`. The editor shows a summary that links to each missing field.
- Success announces the submission and shows the liftoff transition. Focus moves to `main#main`, because the editor's controls unmount. After `LIFTOFF_DURATION_MS` (immediately under reduced motion) the editor navigates to `/portal/mission`.
- A lock detected mid-edit also moves focus to `main#main` as the read-only view replaces the editor.

**Mobile.** Below the large breakpoint, the section list becomes a select with a Go button.

## Schedule, timeline, and countdowns

`EVENT_SCHEDULE` in `lib/event.ts` holds the dates. Pages call `toScheduleViews(EVENT_SCHEDULE)` once per request. It reads the clock outside render and builds both view models for that moment:

- `toTimelineView` (`lib/view-models/schedule.ts`) builds the landing page's four stops: applications open, application deadline, results released, and event dates. Each stop is `complete` once it is over, `active` while in progress (applications while open, the event while it runs), and `upcoming` otherwise. The current stop is the active one, or the next upcoming one when none is; its state label is `COPY.schedule.timeline.states.next`. After the event, no stop is current. `MissionTimeline` shows the state as a badge on every stop except an upcoming stop that is not the current one.
- `toCountdownsView` builds the countdown panel: `launch` counts to the application deadline, and `landing` counts to midnight Pacific on the first event day. Each countdown appears only when its date is set.

`LiveCountdowns` (`app/_components/LiveCountdowns.tsx`) renders `CountdownPanel` on the landing page and both portal dashboards:

- **Ticks.** `useNow` (`lib/client/use-now.ts`) is one shared clock that ticks just after each whole second and stops when nothing listens. `toCountdownReading` (`lib/view-models/countdown.ts`) runs on every tick. It formats only whole numbers, so the server and the browser produce the same text.
- **Hydration.** The server render and hydration read the server clock (`renderedAt`), then the browser clock takes over.
- **No pause control.** The panel has no controls of its own; the readings follow the clock. The pause toggle was removed on 2026-09-11 at the user's request, so the per-second update is no longer pausable, which WCAG 2.2.2 asks for. Restoring it means putting the toggle back in `CountdownPanel` and the paused state back in `LiveCountdowns`.
- **Screen readers.** The digits are `aria-hidden`. A visually hidden summary gives the time left to the minute.

## Demo accounts

`components/auth/DemoAccounts.tsx` lists shared demo logins under the sign-in form, from `COPY.auth.demo.accounts`, so a reviewer can reach both sides of the product without being sent credentials. Remove the component from `app/(auth)/login/page.tsx` to hide them.

## Accessibility

- A skip link to `main#main` is the first focusable element on every page, and each page has one `main`. The root layout renders it through `app/_components/SkipToContent.tsx`, which focuses `main` directly.
- Visible labels, hints and errors wired through `aria-describedby`, and `fieldset` and `legend` for choice groups.
- Fields about the applicant declare their purpose with `autocomplete` (`nickname`, `organization`, `organization-title`); link lists turn it off.
- Invalid text inputs keep their navy border, which is their 3:1 edge against the page, and add an inset coral ring on the white fill.
- Error summaries take focus. Section headings take focus after a step change. Status and save results are announced politely.
- `aria-current="step"` marks the current section, readiness item, and mission leg.
- Buttons in progress use `aria-disabled` and keep focus.
- Reduced motion collapses every animation and transition, and the decision text is present before its reveal animation.
- The frozen DOM contract is listed in [astra-handoff.md](astra-handoff.md#frozen-dom-contract).

## Configuration

- `lib/event.ts` sets the event time zone used for every displayed timestamp, and `EVENT_SCHEDULE`. It holds the Cal Hacks 13.0 regular round published on calhacks.io:
  - Applications open: no published date, so it shows `COPY.schedule.timeline.openNow`.
  - Application deadline (`APPLICATION_DEADLINE`): 11:59 PM Pacific on September 20, 2026. Nothing closes when it passes.
  - Results released: September 25, 2026.
  - Event: October 23 to 25, 2026. No start time is published, so the landing countdown ends at midnight Pacific on October 23.

  Set any date to `null` to show `COPY.schedule.timeline.toBeAnnounced`. Dates published without a time are stored as midnight Pacific and shown as dates.
- `SITE_URL` and hosted Auth settings are described in [environment-and-deployment.md](../infrastructure/environment-and-deployment.md).

## Tests

See [testing.md](../infrastructure/testing.md). In short:

- `npm run test:unit` covers the pure logic, view models, the test harness guards, and the DOM contract of every component.
- `npm run test:e2e` runs real Hacker and Judge journeys, access isolation, the mission states, axe checks, and keyboard-only use against local Supabase.
