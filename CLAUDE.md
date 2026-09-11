# Claude Code Instructions — Round 2

Read `PROJECT_PLAN.md` completely before making changes, including the amendments in section 0. It is the product and technical source of truth. Phase 1 (infrastructure) and Phase 2 (the applicant product) are merged. Their contracts are documented in `docs/infrastructure/backend-contract.md`, `docs/infrastructure/database.md`, `docs/infrastructure/testing.md`, and `docs/frontend/`.

## Your assignment

Round 2 applies the user's requests of 2026-09-11 (see the Round 2 amendment in `PROJECT_PLAN.md`):

1. **Schedule.** `lib/event.ts` holds the published Cal Hacks 13.0 regular-round schedule. The landing page shows a schedule timeline, and the landing page and portal show live countdowns to the application deadline and to the event.
2. **Name.** The product is CalHacks Mission Control (`LOCKED.brand`).
3. **Required answers.** Required questions show a required marker next to their label.
4. **About you.** Hacker and Judge applications share one About you section: full name, birthdate, country of residence (a filterable list with the United States first), city of residence, optional LinkedIn, GitHub, and Devpost profile links validated per site, and an optional short biography.
5. **Accounts.** Signup asks which applications to start (Hacker, Judge, or both). An account holds at most one application of each type. The portal shows a switcher only when an account holds two.
6. **Phase 3.** The organizer pages from plan section 14 (Mission Control dashboard, applications table, review workspace), plus a documented way to create organizer accounts.
7. **Astra handoff.** Design work for all of the above goes to Astra. Update the handoff and give the user a new prompt.

The user directed that Astra's limited usage go only to design work. You own everything else:

- **Backend:** migrations, RLS, SQL validation, the auth callback, site URL and email redirect, proxy behavior, local Supabase configuration, and their tests.
- **`app/**`:** every route; the loading, error, and not-found states; and the client containers. That includes guards, data loading, Server Action calls, editor state, focus management, navigation guards, and live announcements.
- **Pure logic** in `lib/editor`, `lib/view-models`, `lib/client`, `lib/format`, `lib/event.ts`, and `lib/countries.ts`.
- **The functional component layer in `components/**`:** primitives, layouts, and views. Build them to the plan's section 13 baseline (palette, type, radii, borders, focus rings, contrast) and the frozen DOM contract.
- **Copy:** plan-literal strings in `LOCKED`, and neutral placeholder text in `COPY` (both in `content/copy.ts`).
- **Placeholders and motion:** neutral, token-colored placeholders in `components/art/`, plus the plan's baseline CSS motion.
- **Verification and handoff:** unit, integration, Playwright end-to-end, and accessibility tests, docs, and the Astra handoff.

## Astra's design scope (do not do this work)

- Illustrations, mascots, rockets, planets, stickers, and other decorative assets in `components/art/`.
- Motion design beyond the plan baseline: liftoff, landing, float, and reveal choreography and curves.
- Visual design of views and primitives (composition, spacing rhythm, texture, hero layout, the application switcher, timeline, countdowns, required marker, and organizer pages), staying within the frozen DOM contract and the contrast rules.
- The voice of the supporting copy in `COPY`, `FIELD_COPY`, and `SECTION_COPY`.
- Final look-and-feel QA.

Keep `docs/frontend/astra-handoff.md` accurate so Astra never has to touch backend code, routing, state, validation, or tests.

## Architecture boundaries (enforced by `eslint.config.mjs`)

- **`app/**` holds logic only.** No `className` or `style`, except in `app/layout.tsx` and `app/global-error.tsx`.
- **`components/**` is presentational.** No runtime imports of any of these (type-only imports are allowed):
  - Server Actions, auth, data, Supabase, validation, editor, view-model, or formatting modules;
  - `next/navigation`, `next/headers`, `next/cache`, `next/link`, or `server-only`.
- **Views take display-ready props.** They attach event handlers only when a callback is provided.
- **All user-facing text** comes from `content/copy.ts` or `lib/application-config.ts`. Do not invent product facts such as dates, durations, prizes, or notifications.

## Hard rules

Do not:

- Replace Supabase with mock data or client-only state.
- Expose a Supabase service-role key in application code.
- Allow a public user to select or promote themselves to Organizer.
- Weaken or bypass RLS to make tests pass.
- Install a third-party UI component library. Lucide icons are approved by the plan.
- Query Supabase from client components. Pages use the existing data-access layer and typed Server Actions.
- Edit a migration that has already been applied. Add a new migration for each data change, with integration tests, and document it in `docs/infrastructure/database.md`.

Server Actions must authenticate and authorize every mutation independently. RLS remains the final database boundary.

## Completion gate

Before stopping:

1. Verify that a Hacker, a Judge, and an account holding both can sign up, onboard, save a partial draft, see Launch Readiness update, review, and submit. The switcher appears only for the account holding both.
2. Verify that invalid answers (including birthdates, countries, and profile links) show field errors and an error summary, that the database rejects them too, and that submitted applications render read-only.
3. Verify that the portal and the mission tracker reflect real `status`, `launched_at`, `review_started_at`, and `decision_released_at` values, and that the decision appears only after the landing moment.
4. Verify that the timeline and countdowns match `lib/event.ts`, and that the countdowns can be paused.
5. Verify that an organizer can sign in, use the dashboard and applications table, review in blind mode, and release a decision, and that signed-out users and applicants cannot reach organizer pages or other users' data.
6. Verify that keyboard-only and reduced-motion journeys work and that automated accessibility checks pass.
7. Run `npm run verify`, `npm run test:integration`, `npm run test:e2e`, and `npm run db:advisors`.
8. Update the docs, update the Astra handoff, and give the user a prompt to hand to Astra.

Make local commits only. Do not push unless the user asks.
