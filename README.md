# CalHacks Mission Control

An application portal for Cal Hacks. Applicants apply as a Hacker, a Judge, or both, follow their application from
submission to decision, and organizers review and grade those applications behind a blind-review workspace.

**Live:** https://calhackstechnical.vercel.app

## Demo accounts

Both logins are listed on the sign-in page as well. They hold sample data in the hosted project.

| Role | Email | Password |
|---|---|---|
| Organizer | `organizer@calhacks.com` | `ILoveHacking` |
| Applicant | `applicant@gmail.com` | `ILoveRockets` |

## What it does

**Applicants**

- Sign up choosing which applications to start (Hacker, Judge, or both). An account holds at most one of each.
- Answer a sectioned application. Drafts save as you go, and Launch Readiness shows what is still missing.
- Review every answer, then submit. Submission is final, and the submitted application is read-only.
- Follow the mission tracker: launch, cruise, and landing. The decision appears only once it is released.
- The portal shows a switcher only for an account that holds both applications.

**Organizers**

- A Mission Control dashboard with counts and a table alternative to every chart.
- An applications table with search, filters, and sorting, all reflected in the URL so a view can be shared.
- A review workspace that is blind by default: identifying details stay out of the page until the organizer reveals
  them. Reviews are scored against a rubric, saved as drafts, and completed one after another.
- Decisions are released explicitly, and only then do applicants see them.

**Both**

- The landing page shows the event schedule as a flight plan and counts down to the application deadline and to the
  event, from the dates in `lib/event.ts`.

## Stack

Next.js 16 (App Router) and React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, Row Level Security),
Zod, Vitest, Playwright with axe, and Vercel.

## How it is put together

- **`app/**` holds logic only** — routing, guards, data loading, Server Action calls, and client containers. It
  carries no styling.
- **`components/**` is presentational** and takes display-ready props. It never imports Supabase, auth, data, or
  validation modules, so views stay testable and the design work stays separate.
- **`lib/view-models`** turns database rows into those props. **`lib/validation`** holds the Zod schemas, which the
  database mirrors with its own constraints, so an invalid answer is rejected on both sides.
- **All user-facing text** lives in `content/copy.ts` and `lib/application-config.ts`.
- **Every mutation is a Server Action** that authenticates and authorizes independently. Row Level Security is the
  final boundary, and no service-role key exists in application code.
- **Database changes are migrations** in `supabase/migrations`, applied to the hosted project by the Supabase GitHub
  integration when a change merges to `main`.

ESLint enforces the `app`/`components` split, so the boundaries above cannot quietly erode.

## Running it locally

Node.js 22.12 or newer and Docker Desktop.

```bash
npm install
npm run db:start
```

Create `.env.local` with the two values printed by:

```bash
npx supabase status -o env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL,auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Then:

```bash
npm run dev
```

For an organizer account on the local stack:

```bash
npm run organizer:create
```

`http://localhost:3000/dev/gallery` renders every applicant view and state, and `/dev/gallery/organizer` every
organizer state. Both return 404 in production builds.

## Checks

| Command | What it runs |
|---|---|
| `npm run verify` | Lint, typecheck, unit and integration tests, and a production build |
| `npm run test:unit` | Unit tests, including the view contracts |
| `npm run test:integration` | Integration tests against the local Supabase stack, including RLS |
| `npm run test:e2e` | Playwright journeys, with axe accessibility checks |
| `npm run db:advisors` | Supabase security and performance advisors |

## Documentation

| Document | Covers |
|---|---|
| [`PROJECT_PLAN.md`](PROJECT_PLAN.md) | The product and technical plan this was built from |
| [`docs/infrastructure/database.md`](docs/infrastructure/database.md) | Schema, RLS, triggers, and every migration |
| [`docs/infrastructure/backend-contract.md`](docs/infrastructure/backend-contract.md) | Server Actions, data access, and error handling |
| [`docs/infrastructure/environment-and-deployment.md`](docs/infrastructure/environment-and-deployment.md) | Environment variables, local setup, and deploying to Supabase and Vercel |
| [`docs/infrastructure/testing.md`](docs/infrastructure/testing.md) | What each suite covers |
| [`docs/frontend/README.md`](docs/frontend/README.md) | View models, components, and accessibility |
| [`docs/frontend/organizer.md`](docs/frontend/organizer.md) | The organizer surfaces |
| [`docs/frontend/astra-handoff.md`](docs/frontend/astra-handoff.md) | The design handoff and the frozen DOM contract |
