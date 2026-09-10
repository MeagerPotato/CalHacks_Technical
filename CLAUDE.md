# Claude Code Instructions — Infrastructure Only

Read `PROJECT_PLAN.md` completely before making changes. It is the product and technical source of truth.

## Your assignment

Complete **Phase 1 — infrastructure vertical slice** only, then stop and report your results.

You own:

- Scaffolding the Next.js, TypeScript, Tailwind, and Supabase project.
- Supabase migrations, enums, tables, indexes, constraints, triggers, and seed data.
- Row Level Security policies and role/ownership authorization.
- Supabase SSR browser/server clients and session plumbing.
- The server-side data access layer.
- Zod schemas for Hacker and Judge applications and organizer reviews.
- Server Actions for auth, draft saving, submission, reviews, and Accepted/Waitlisted decisions.
- Generated database types and stable typed action results for the frontend.
- Backend-focused tests or scripts proving the data and authorization flow.
- `.env.example`, environment-variable documentation, and deployment configuration.
- Lint, typecheck, test, and production-build verification.

## Hard ownership boundary

Astra will own all product UX, creative direction, and frontend implementation after your handoff.

Do not:

- Build or style applicant or organizer product pages.
- Create the product component library or choose visual primitives.
- Select fonts, colors, spacing, illustration style, or animation behavior.
- Write marketing copy or creatively reinterpret the page specifications.
- Generate images, icons, mascots, rockets, planets, or decorative assets.
- Implement the visual experiences for Mission Review Queue, Blind Review Mode, Launch Readiness, Expertise Radar, or Rocket Mission Tracker.
- Replace Supabase with mock data or client-only state.
- Expose a Supabase service-role key in application code.
- Allow a public user to select or promote themselves to Organizer.
- Weaken or bypass RLS to make tests pass.

Framework-generated `app/layout.tsx` and a plain diagnostic `app/page.tsx` are permitted only as needed to verify that the scaffold builds. Do not create the final route pages listed in the plan. Do not install a UI component library for Astra.

## Required backend contract

Expose documented, typed interfaces that Astra can consume without changing the infrastructure:

- Current authenticated profile and role lookup.
- Create/load/save/submit the current user's application.
- Role-specific validation errors and completion calculation.
- Organizer dashboard aggregates, including Judge expertise counts.
- Filtered application listing and next-unreviewed lookup.
- Load/save/complete an organizer review.
- Release an Accepted or Waitlisted decision.
- Mission status fields: `status`, `launched_at`, `review_started_at`, and `decision_released_at`.

Server Actions must authenticate and authorize every mutation independently. RLS remains the final database boundary.

## Completion gate

Before stopping:

1. Verify that public signup can create only Hacker or Judge accounts.
2. Verify that one applicant can save and submit only their own application.
3. Verify that submitted applications are locked from applicant edits.
4. Verify that an Organizer can list applications, save a review, and release only Accepted or Waitlisted.
5. Verify that an ordinary applicant cannot read other applications, reviews, or organizer data.
6. Run lint, typecheck, backend tests, and a production build.
7. Summarize every created migration, exported schema/action, environment variable, test command, and known limitation for Astra.

Do not continue into Phase 2. End your response with a clear handoff stating whether Phase 1 is ready for Astra.

