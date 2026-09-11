# Claude Code Instructions — Phase 2 Applicant Product

Read `PROJECT_PLAN.md` completely before making changes. It is the product and technical source of truth. Phase 1 (infrastructure) is merged; its contracts are documented in `docs/infrastructure/backend-contract.md`, `docs/infrastructure/database.md`, and `docs/infrastructure/testing.md`.

## Your assignment

Build **Phase 2 — the applicant product**, then stop and report your results. Phase 2 covers:

- signup, login, and onboarding;
- the Hacker and Judge application editor, with draft saving and Launch Readiness;
- review and submission;
- the applicant portal and the Rocket Mission Tracker.

Do not start Phase 3 (organizer pages).

The user directed that Astra's limited usage go only to creative work. You own everything else:

- **Backend deltas:** the auth callback route, site URL and email redirect, proxy behavior, local Supabase configuration, and their tests.
- **`app/**`:** every route; the loading, error, and not-found states; and the client containers. That includes guards, data loading, Server Action calls, editor state, focus management, navigation guards, and live announcements.
- **Pure logic** in `lib/editor`, `lib/view-models`, `lib/client`, `lib/format`, and `lib/event.ts`.
- **The functional component layer in `components/**`:** primitives, layouts, and views. Build them to the plan's section 13 baseline (palette, type, radii, borders, focus rings, contrast) and the frozen DOM contract.
- **Copy:** plan-literal strings in `LOCKED`, and neutral placeholder text in `COPY` (both in `content/copy.ts`).
- **Placeholders and motion:** neutral, token-colored placeholders in `components/art/`, plus the plan's baseline CSS motion.
- **Verification and handoff:** unit tests, Playwright end-to-end and accessibility tests, docs, and the Astra handoff.

## Astra's creative scope (do not do this work)

- Illustrations, mascots, rockets, planets, stickers, and other decorative assets that replace the placeholders in `components/art/`.
- Motion design beyond the plan baseline: liftoff, landing, float, and reveal choreography and curves.
- Visual polish of views and primitives (composition, spacing rhythm, texture, hero layout), staying within the frozen DOM contract and the contrast rules.
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
- Change migrations or RLS policies unless a Phase 2 flow is blocked without it. Any such change needs tests and must be documented in `docs/infrastructure/database.md`.

Server Actions must authenticate and authorize every mutation independently. RLS remains the final database boundary.

## Completion gate

Before stopping:

1. Verify that a Hacker and a Judge can each sign up, onboard, save a partial draft, see Launch Readiness update, review, and submit.
2. Verify that invalid answers show field errors and an error summary, and that submitted applications render read-only.
3. Verify that the portal and the mission tracker reflect real `status`, `launched_at`, `review_started_at`, and `decision_released_at` values, and that the decision appears only after the landing moment.
4. Verify that signed-out users and applicants cannot reach other users' data or organizer data.
5. Verify that keyboard-only and reduced-motion journeys work and that automated accessibility checks pass.
6. Run `npm run verify`, `npm run test:integration`, `npm run test:e2e`, and `npm run db:advisors`.
7. Update the docs, write the Astra handoff, and give the user a prompt to hand to Astra.

Make local commits only. Do not push unless the user asks.
