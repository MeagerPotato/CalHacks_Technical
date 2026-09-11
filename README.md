# CalHacks Mission Control

An application portal for Cal Hacks. Applicants apply as a Hacker, a Judge, or both, follow their application from
submission to decision, and organizers review and grade those applications in a blind-review workspace.

**Live:** https://calhackstechnical.vercel.app

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, Row Level
Security), and Vercel. Every answer is validated by Zod on the server *and* by matching constraints in the database.

---

## Contents

- [Demo accounts](#demo-accounts) — sign in and look around
- [Five-minute tour](#five-minute-tour) — the fastest path through both flows
- [Features](#features) — everything built, including the five chosen features
- [Where to find things](#where-to-find-things) — a map from feature to file
- [Repository map](#repository-map) — every directory and what lives in it
- [How it is put together](#how-it-is-put-together) — the architecture and the rules that enforce it
- [Running it locally](#running-it-locally)
- [Testing everything](#testing-everything) — automated suites and a manual checklist
- [Documentation](#documentation)

---

## Demo accounts

Both logins are also printed on the sign-in page, so no one has to come back here for them. They hold sample data in
the hosted project.

| Role | Email | Password | What it shows |
|---|---|---|---|
| Organizer | `organizer@calhacks.com` | `ILoveHacking` | Dashboard, applications table, blind review, decisions |
| Applicant | `applicant@gmail.com` | `ILoveRockets` | Holds **both** a Hacker and a Judge application, so the switcher is visible |

You can also sign up a brand-new account at [`/signup`](https://calhackstechnical.vercel.app/signup). Email
confirmation is on, so a real signup sends a confirmation link before the account can sign in.

---

## Five-minute tour

**Applicant.** Sign in as `applicant@gmail.com` → the portal dashboard shows Launch Readiness and a switcher between
the Hacker and Judge applications → open the application, answer a section, press **Save & continue** → the readiness
list updates → the **Review** section lists every answer and submits → after submitting, the mission tracker shows
launch → cruise → landing.

**Organizer.** Sign in as `organizer@calhacks.com` → the Mission Control dashboard shows the review queue, a status
breakdown, and the expertise radar → **Applications** filters and sorts, with every filter in the URL → open an
application: it is blind by default, so no name or email appears until you press **Reveal** → score it against the
rubric, save, continue to the next unreviewed one → release a decision, and only then does the applicant see it.

---

## Features

### The five chosen features

| Feature | What it does | Why it matters |
|---|---|---|
| **Launch Readiness checklist** | A live per-section checklist on the portal showing not started / in progress / complete, with a link straight to the section that needs work. Computed server-side from the same completion rules the submit gate uses. | An applicant always knows exactly what is left, and the number can never disagree with what submission will accept. |
| **Blind review mode** | The review workspace renders no identifying field at all until an organizer explicitly reveals identity. Name, email, and profile links are split out of the answer set before the page is built, not hidden with CSS. | Removes first-impression bias from grading, and "not in the DOM" is a claim the tests actually verify. |
| **Focused review queue** | Queue progress on the dashboard, plus **Save review and continue** which moves an organizer straight to the next unreviewed application. | Reviewing is the organizer's real workload; this turns it into one uninterrupted pass instead of a table round-trip per application. |
| **Expertise radar** | Aggregates judge expertise areas across the applicant pool and highlights coverage gaps. | Tells organizers what expertise the judging panel is short of while there is still time to recruit for it. |
| **Rocket mission tracker** | An applicant-facing status view built on the real workflow timestamps: **launch** (submitted) → **cruise** (in review) → **landing** (decision released). | Turns an opaque wait into visible progress, and it never invents an ETA or a percentage it cannot know. |

### Applicant

- Sign up choosing which applications to start — Hacker, Judge, or both. An account holds at most one of each, and
  Organizer can never be chosen by a public signup.
- Email confirmation, with a callback that distinguishes an expired link from one opened in a different browser.
- A sectioned application with drafts that save as you go and survive a reload.
- Field-level errors plus a focused error summary, with each entry linking to the field it describes.
- An unsaved-changes guard before you navigate away.
- Review every answer, then submit. Submission is final and the application becomes read-only.
- A switcher between the two applications, shown only for an account that holds both.

### Organizer

- Mission Control dashboard: KPIs, queue progress, status breakdown, recent submissions by blind reference, and the
  expertise radar. Every chart has a table equivalent, so nothing is conveyed by shape or color alone.
- Applications table with search, filters, sorting, and pagination — all in the URL, so a view can be shared or
  bookmarked and the browser Back button behaves.
- Rubric-scored reviews saved as drafts and then completed.
- Decisions released explicitly; a decision requires a completed review, and is final once released.

### Across the app

- The landing page renders the event schedule as a flight plan and counts down to the application deadline and to the
  event, both from the dates in [`lib/event.ts`](lib/event.ts).
- Keyboard-first: a skip link, visible focus rings, focus moved deliberately after every save, submit, and error.
- Reduced motion is honored throughout.
- WCAG 2.1 A and AA checked automatically with axe on public pages, applicant pages, and organizer pages.

> **One deliberate accessibility deviation:** the countdown has no pause control, which departs from WCAG 2.2.2. This
> was a product decision. It is documented, with instructions for restoring the control, in
> [`docs/frontend/README.md`](docs/frontend/README.md).

---

## Where to find things

Start here if you want to read the code behind a specific feature. Each row goes route → the page that holds the logic
→ the components that render it → the pure logic behind it.

| Feature | Route | Page (logic) | View (presentation) | Logic |
|---|---|---|---|---|
| Landing, flight plan, countdowns | `/` | [`app/(marketing)/page.tsx`](app/%28marketing%29/page.tsx) | [`marketing/LandingView.tsx`](components/marketing/LandingView.tsx), [`schedule/MissionTimeline.tsx`](components/schedule/MissionTimeline.tsx), [`schedule/CountdownPanel.tsx`](components/schedule/CountdownPanel.tsx) | [`lib/event.ts`](lib/event.ts), [`lib/view-models/schedule.ts`](lib/view-models/schedule.ts), [`lib/format/countdown.ts`](lib/format/countdown.ts) |
| Sign up and sign in | `/signup`, `/login` | [`(auth)/signup/page.tsx`](app/%28auth%29/signup/page.tsx), [`(auth)/login/page.tsx`](app/%28auth%29/login/page.tsx) | [`layout/AuthShell.tsx`](components/layout/AuthShell.tsx), [`auth/DemoAccounts.tsx`](components/auth/DemoAccounts.tsx) | [`app/actions/auth.ts`](app/actions/auth.ts), [`lib/validation/auth.ts`](lib/validation/auth.ts) |
| Email confirmation | `/auth/callback` | [`app/auth/callback/route.ts`](app/auth/callback/route.ts) | [`auth/CheckEmailNotice.tsx`](components/auth/CheckEmailNotice.tsx) | [`lib/auth/callback.ts`](lib/auth/callback.ts), [`lib/env.ts`](lib/env.ts) |
| Onboarding, draft creation | `/onboarding` | [`app/onboarding/page.tsx`](app/onboarding/page.tsx) | [`_components/OnboardingForm.tsx`](app/onboarding/_components/OnboardingForm.tsx) | [`app/actions/applications.ts`](app/actions/applications.ts) |
| Portal dashboard, **Launch Readiness** | `/portal` | [`app/portal/page.tsx`](app/portal/page.tsx) | [`portal/LaunchReadiness.tsx`](components/portal/LaunchReadiness.tsx), [`portal/PortalDraftDashboard.tsx`](components/portal/PortalDraftDashboard.tsx) | [`lib/view-models/portal.ts`](lib/view-models/portal.ts), [`lib/view-models/readiness.ts`](lib/view-models/readiness.ts) |
| **Dual applications** switcher | `/portal?type=` | [`app/portal/page.tsx`](app/portal/page.tsx) | [`portal/ApplicationSwitcher.tsx`](components/portal/ApplicationSwitcher.tsx) | `resolveApplicationType` in [`lib/routes.ts`](lib/routes.ts) |
| Application editor | `/portal/application` | [`portal/application/page.tsx`](app/portal/application/page.tsx), [`_components/use-application-editor.ts`](app/portal/application/_components/use-application-editor.ts) | [`components/application/`](components/application) | [`lib/editor/`](lib/editor), [`lib/validation/application.ts`](lib/validation/application.ts), [`lib/view-models/answers.ts`](lib/view-models/answers.ts) |
| **Mission tracker** | `/portal/mission` | [`portal/mission/page.tsx`](app/portal/mission/page.tsx) | [`mission/MissionTracker.tsx`](components/mission/MissionTracker.tsx), [`mission/DecisionCard.tsx`](components/mission/DecisionCard.tsx) | [`lib/domain/mission.ts`](lib/domain/mission.ts), [`lib/view-models/mission.ts`](lib/view-models/mission.ts) |
| Organizer dashboard, **expertise radar**, **queue** | `/organizer` | [`app/organizer/page.tsx`](app/organizer/page.tsx) | [`organizer/MissionControlDashboard.tsx`](components/organizer/MissionControlDashboard.tsx), [`organizer/ExpertiseRadar.tsx`](components/organizer/ExpertiseRadar.tsx), [`organizer/QueueProgressCard.tsx`](components/organizer/QueueProgressCard.tsx) | [`lib/view-models/organizer-dashboard.ts`](lib/view-models/organizer-dashboard.ts), [`lib/data/organizer.ts`](lib/data/organizer.ts) |
| Applications table | `/organizer/applications` | [`organizer/applications/page.tsx`](app/organizer/applications/page.tsx) | [`organizer/ApplicationsView.tsx`](components/organizer/ApplicationsView.tsx), [`organizer/ApplicationFilters.tsx`](components/organizer/ApplicationFilters.tsx) | [`lib/view-models/organizer-applications.ts`](lib/view-models/organizer-applications.ts) |
| **Blind review** workspace, decisions | `/organizer/applications/[id]` | [`[id]/page.tsx`](app/organizer/applications/[id]/page.tsx), [`_components/use-review-workspace.ts`](app/organizer/applications/[id]/_components/use-review-workspace.ts) | [`organizer/IdentityPanel.tsx`](components/organizer/IdentityPanel.tsx), [`organizer/Scorecard.tsx`](components/organizer/Scorecard.tsx), [`organizer/DecisionRelease.tsx`](components/organizer/DecisionRelease.tsx) | [`app/actions/reviews.ts`](app/actions/reviews.ts), [`lib/view-models/organizer-review.ts`](lib/view-models/organizer-review.ts) |

Two more places worth knowing:

- **All user-facing text** is in [`content/copy.ts`](content/copy.ts) and
  [`lib/application-config.ts`](lib/application-config.ts). Nothing else in the codebase contains a product string.
- **Every question, limit, and rubric dimension** is in [`lib/application-config.ts`](lib/application-config.ts).
  Changing the application form starts there.

---

## Repository map

```
app/                        Routes and logic only — no styling lives here
  (marketing)/              Landing page
  (auth)/                   login, signup, each with its _components form
  auth/callback/            Email confirmation route handler
  onboarding/               Display name, creates the drafts
  portal/                   Applicant dashboard, application editor, mission tracker
  organizer/                Dashboard, applications table, review workspace
  actions/                  Server Actions: applications.ts, auth.ts, reviews.ts
  _components/              Shared client containers (countdowns, sign-out, skip link)
  dev/gallery/              Every view and state on one page. 404s in production.
  globals.css, fonts.ts, layout.tsx, error.tsx, not-found.tsx

components/                 Presentational only — display-ready props in, DOM out
  ui/                       Primitives: Button, Card, Field, Combobox, ErrorSummary, …
  layout/                   AuthShell, PortalShell
  marketing/                LandingView
  schedule/                 MissionTimeline, CountdownPanel
  portal/                   Dashboards, LaunchReadiness, ApplicationSwitcher, ProgressCard
  application/              The editor: sections, answers, review and submit
  mission/                  MissionTracker, DecisionCard
  organizer/                Dashboard, table, review workspace, scorecard, radar
  auth/                     CheckEmailNotice, DemoAccounts
  art/                      Illustrations, brand mark, motion tokens
  dev/                      Gallery scaffolding

content/copy.ts             Every user-facing string

lib/
  actions/                  Server Action result and error types
  auth/                     Session access, authorization, the callback
  client/                   Client-only hooks: navigation guard, clock, reduced motion
  data/                     Data access for applicants and organizers, plus row mappers
  domain/                   Enums, mission stages, applicant identity
  editor/                   Editor reducer, steps, values, feedback
  format/                   Date, time, and countdown formatting
  supabase/                 Browser, server, and proxy clients, generated types
  validation/               Zod schemas: application, auth, review, organizer, completion
  view-models/              Database rows → display-ready props (the largest folder here)
  application-config.ts     Questions, limits, labels, rubric
  countries.ts, event.ts, env.ts, routes.ts

supabase/
  migrations/               8 migrations, applied to the hosted project on merge to main
  seed.sql                  Sample applicants, applications, and reviews for local use
  config.toml

tests/
  unit/                     32 files, no services needed
  integration/              Real Server Actions against local Supabase, including RLS
  fixtures/, support/

e2e/                        Playwright journeys and axe checks, plus e2e/support helpers
types/database.ts           Generated Supabase types
scripts/                    create-local-organizer.mjs
docs/                       See Documentation below
proxy.ts                    Session refresh and the optimistic signed-out redirect
eslint.config.mjs           Where the architecture boundaries are actually enforced
PROJECT_PLAN.md             The plan this was built from
AGENTS.md, CLAUDE.md        Instructions for the AI tools used on this project
```

---

## How it is put together

- **`app/**` holds logic only** — routing, guards, data loading, Server Action calls, and client containers. It
  carries no styling at all.
- **`components/**` is presentational** and takes display-ready props. It never imports Supabase, auth, data,
  validation, or view-model modules, so views stay trivially testable and design work never touches application logic.
- **`lib/view-models`** is the seam between the two: it turns database rows into those props. If a page shows the
  wrong thing, the bug is almost always there, and there is a unit test for it.
- **`lib/validation`** holds the Zod schemas, and the database mirrors them with its own CHECK constraints — so an
  invalid answer is rejected on both sides. `tests/integration/schema-drift.test.ts` fails if the two ever disagree,
  field by field, down to the country list and the profile-link patterns.
- **Every mutation is a Server Action** that authenticates and authorizes independently. Row Level Security is the
  final boundary. No service-role key exists anywhere in application code.
- **Database changes are migrations** in `supabase/migrations`, applied to the hosted project by the Supabase GitHub
  integration when a change merges to `main`. Applied migrations are never edited.

ESLint enforces the `app` / `components` split and the copy rule, so these boundaries cannot quietly erode —
`npm run lint` fails on a violation.

---

## Running it locally

Requires **Node.js 22.12+** and **Docker Desktop** (for the local Supabase stack).

```bash
npm install
npm run db:start
```

Create `.env.local` with the two values printed by:

```bash
npx supabase status -o env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL,auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Both values are browser-safe; ignore the secret keys the command also prints. Then:

```bash
npm run dev
```

The local database is seeded with sample applicants, applications, and reviews. Seeded accounts have no password and
cannot sign in — they exist so the organizer views have data. To create an organizer you can actually sign in as:

```bash
npm run organizer:create
```

Useful extras:

- `http://localhost:3000/dev/gallery` renders every applicant view and state on one page;
  `/dev/gallery/organizer` does the same for organizer views. Both 404 in production builds.
- `npm run db:reset` reapplies every migration and reseeds.

---

## Testing everything

### Automated

| Command | What it runs | Needs |
|---|---|---|
| `npm run verify` | Lint, typecheck, all Vitest tests, then a production build | Docker + `db:start` |
| `npm run lint` | ESLint, including the architecture boundary rules | — |
| `npm run typecheck` | `next typegen && tsc --noEmit`, tests included | — |
| `npm run test:unit` | 32 unit files: validation, view models, editor, routing, a11y tokens | Nothing |
| `npm run test:integration` | Real Server Actions and RLS against local Supabase | Docker + `db:start` |
| `npm run test:e2e` | Playwright journeys + axe, on a real production build at port 3100 | Docker + `db:start` + `.env.local` |
| `npm run db:advisors` | Supabase security and performance advisors | Docker + `db:start` |

Notes worth knowing before you run them:

- `test:e2e` builds the app and serves it itself, and it **refuses to run against anything but a local Supabase** — it
  checks that `.env.local` points at the same local stack. It creates every account through a real signup and deletes
  its own accounts before and after the run. Set `E2E_REUSE_SERVER=1` to reuse a server already on port 3100.
- `test:integration` also refuses non-local targets, and runs its files one at a time because they share a database.
- The full suite is 47 Playwright tests plus the Vitest projects. What each file covers is listed in
  [`docs/infrastructure/testing.md`](docs/infrastructure/testing.md).

### Manual checklist

Against the live site or a local `npm run dev`, this walks every surface:

**Public**
1. `/` — the flight plan lists the schedule in order; both countdowns tick every second.
2. `/login` — the demo accounts panel is visible; a wrong password shows an error.
3. `/signup` — submitting with no application type checked shows an error summary that takes focus.
4. Press `Tab` on any page — the skip link is the first stop and moves focus to the main content.

**Applicant** (sign in as `applicant@gmail.com`)
5. `/portal` — Launch Readiness lists each section with its state; the switcher shows Hacker and Judge.
6. Switch to the Judge application — the URL carries `?type=judge` and the readiness list changes.
7. Open the application, type an invalid answer (a graduation year of `1900`), press **Save & continue** — a field
   error and a focused error summary appear, and the link in the summary jumps to the field.
8. Fix it and save — readiness updates, and the next section opens.
9. Try to leave with unsaved changes — the browser warns first.
10. **Review** section — every answer is listed; submitting an incomplete application lists what is missing.
11. Submit a complete one — liftoff, then the mission tracker; the application is now read-only.

**Organizer** (sign in as `organizer@calhacks.com`)
12. `/organizer` — KPIs, queue progress, status breakdown, expertise radar with its coverage gaps.
13. `/organizer/applications` — filter, sort, and page; confirm the URL changes and Back restores the previous view.
14. Open an application — **no name or email appears anywhere** until you press Reveal.
15. Score the rubric, save a draft, reload — the draft is still there.
16. Complete the review and use **Save review and continue** — the next unreviewed application opens.
17. Release a decision, confirm the dialog, then check the applicant's tracker shows the landing.

**Access control**
18. Sign out and visit `/portal` and `/organizer` — both redirect to sign-in with the destination preserved.
19. Signed in as the applicant, visit `/organizer` — you are redirected to your own portal.
20. `/dev/gallery` on the live site — 404.

---

## Documentation

| Document | Covers |
|---|---|
| [`PROJECT_PLAN.md`](PROJECT_PLAN.md) | The product and technical plan this was built from |
| [`docs/infrastructure/database.md`](docs/infrastructure/database.md) | Schema, RLS, triggers, and every migration |
| [`docs/infrastructure/backend-contract.md`](docs/infrastructure/backend-contract.md) | Server Actions, data access, and error handling |
| [`docs/infrastructure/environment-and-deployment.md`](docs/infrastructure/environment-and-deployment.md) | Environment variables, local setup, and deploying to Supabase and Vercel |
| [`docs/infrastructure/testing.md`](docs/infrastructure/testing.md) | What every test file covers, and what is deliberately not covered |
| [`docs/frontend/README.md`](docs/frontend/README.md) | View models, components, accessibility, and the design decisions |
| [`docs/frontend/organizer.md`](docs/frontend/organizer.md) | The organizer surfaces in detail |
| [`docs/frontend/astra-handoff.md`](docs/frontend/astra-handoff.md) | The design handoff and the frozen DOM contract |
