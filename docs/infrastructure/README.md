# Launchpad infrastructure (Phase 1)

This folder hands off the infrastructure phase to the product phase. It documents the backend that product pages build on. The project `README.md` belongs to the product phase.

Phase 2, the applicant product, builds on this contract without changing migrations or RLS. Its backend additions are documented here:

- the `/auth/callback` confirmation route;
- the optional `SITE_URL`;
- local Auth settings for callback URLs and test volume;
- proxy redirects limited to page loads.

The product layer itself (routes, containers, view models, components, and the Astra handoff) is documented in [docs/frontend](../frontend/README.md).

## What Phase 1 delivers

- **Supabase:** migrations, Row Level Security, response validation and workflow guard triggers, organizer read functions, and seed data (`supabase/`).
- **Sessions:** Supabase SSR clients and session refresh for Next.js 16 (`lib/supabase/`, `proxy.ts`).
- **Data access:** a server-only data access layer with per-action authorization (`lib/auth/`, `lib/data/`).
- **Contracts:** Zod schemas, completion calculation, mission state, and form and rubric configuration (`lib/validation/`, `lib/domain/`, `lib/application-config.ts`).
- **Server Actions:** auth, drafts, submission, reviews, and decisions, all with typed results (`app/actions/`, `lib/actions/`).
- **Types:** generated database types (`types/database.ts`).
- **Tests:** unit and integration suites (`tests/`).

Phase 1 intentionally had no product pages, visual design, or component library. Phase 2 replaced its placeholder `app/layout.tsx` and `app/page.tsx`.

## Documents

| Document | Contents |
|---|---|
| [backend-contract.md](backend-contract.md) | Server Actions, Server Component reads, DTOs, validation, error codes, and how each planned page uses them |
| [database.md](database.md) | Migrations, tables, response validation, state machine, grants and RLS, organizer functions, error hints, seed data, admin SQL |
| [environment-and-deployment.md](environment-and-deployment.md) | Environment variables, local setup, hosted Supabase, Vercel, Organizer accounts |
| [testing.md](testing.md) | Commands, what each test suite proves, how the integration harness works |

## Quick start

You need Node.js 22.12 or newer and Docker Desktop.

1. Install dependencies and start the local stack:

   ```bash
   npm install
   npm run db:start
   ```

2. Put the two `NEXT_PUBLIC_` lines printed by this command into `.env.local`:

   ```bash
   npx supabase status -o env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL,auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

3. Start the app, and run all checks (lint, typecheck, unit and integration tests, production build):

   ```bash
   npm run dev
   npm run verify
   ```

## Known limitations

- **No organizer UI yet.** Phase 2 builds the applicant pages. The organizer pages are Phase 3.
- **Email confirmation.**
  - It is off locally. Hosted projects turn it on by default, and Phase 2's `/auth/callback` route completes confirmation links (PKCE code flow only).
  - A confirmation link works only in the browser where the account was created, because the PKCE verifier is a cookie in that browser. Anywhere else, `/login` explains that the link must be opened in the same browser.
  - With confirmation on, `signUp` returns `requiresEmailConfirmation: true` and the signup page shows a check-your-email notice.
  - With confirmation on, Supabase also reports success for an already-registered email instead of `email_taken`, to prevent account enumeration.
- **Email ownership is not verified while confirmation is off.** Anyone can register any address, so applicant emails shown to organizers are unverified. Organizer accounts are safe only if the admin creates the account and promotes it immediately; never promote an account that already existed (see [environment-and-deployment.md](environment-and-deployment.md)).
- **Session plumbing is tested end to end rather than in isolation.** `proxy.test.ts` covers the redirect rules with a mocked client, and the Playwright suite signs real users in through the cookie-based clients. The integration tests still call Server Actions with a real signed-in Supabase client in place of the cookie-based one.
- **Hosted Auth rate limits are per IP.** Server Actions call Supabase Auth from the server, so many visitors can share an IP. Raise the sign-up and sign-in limit for a busy live demo.
- **One review per application.** The organizer who starts a review owns it. Any organizer can release the decision once the review is complete. Assigning multiple reviewers is not supported.
- **Blind review is presentation-level.** Organizers are allowed to read applicant identity; the list view includes name and email. The review workspace hides identity until it is explicitly revealed.
- **Draft completion percent can be edited.** An applicant calling the Supabase Data API directly can set their own draft's `completion_percent` (0–100). The value is cosmetic. Server Actions always recompute it, and submitting always stores 100 and requires complete, valid answers.
- **Overlapping saves retry a limited number of times.** Saves of the same draft or review are merged; if one keeps losing races three times in a row, it returns `conflict` and the UI should reload.
- **Some database refusals have no field details.** Text containing a NUL character (in answers or review notes), or application answers over 32 KB of JSON text, pass Zod but are refused by PostgreSQL. The action then returns `validation_failed` without `fieldErrors` or `formErrors`, so the UI should fall back to `error.message`.
- **Decisions are final.** Neither the app nor the database client roles can reverse one.
- **Sign-out.** Sign-out ends the browser session. An access token issued earlier remains valid until it expires (1 hour), which is standard Supabase behavior.
- **Deleting an Organizer who wrote reviews** fails until those reviews are deleted, because `reviews.reviewer_id` is `ON DELETE RESTRICT`. See [database.md](database.md#admin-sql).
- **Trusted SQL roles bypass most workflow rules.** `postgres` and `service_role` skip the client-only checks: ownership, the organizer requirement, application status transitions, and the review lock after a decision. They must still satisfy every CHECK constraint (including response validation) and the guard rules that apply to all writers. The app never uses these roles.
- **Generated RPC types are wrong about nulls.** `types/database.ts` marks every column returned by an RPC as non-null. Use the DAL DTOs, which type nullable columns correctly.
- **Search is simple.** It is substring matching, not full-text search. The DAL accepts page sizes from 1 to 100; an invalid or out-of-range value (for example 1000) falls back to the default of 25.
- **Seed and deployment.** Seed accounts have no passwords. No hosted Supabase project or Vercel deployment was created in Phase 1, and the Organizer demo account must be created out-of-band (see [environment-and-deployment.md](environment-and-deployment.md)).
