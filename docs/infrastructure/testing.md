# Tests and verification

## Commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint with the Next.js core-web-vitals and TypeScript rules. |
| `npm run typecheck` | `next typegen && tsc --noEmit`. Also checks the tests and the Vitest config. |
| `npm run test:unit` | The Vitest `unit` project. Needs no services. |
| `npm run test:integration` | The Vitest `integration` project against local Supabase. Requires Docker and `npm run db:start`. |
| `npm run test` | Both Vitest projects. |
| `npm run build` | `next build`, which type-checks again. |
| `npm run verify` | Lint, typecheck, all tests, then the production build. |
| `npm run db:advisors` | Supabase security and performance advisors against the local database. |

The integration suite can run right after `npm run db:reset`; global setup waits for the API to accept a fresh session.

## Unit tests (`tests/unit`)

Pure TypeScript tests with no network or database:

| File | Covers |
|---|---|
| `application-validation.test.ts` | Hacker and Judge submission and draft schemas, limits, the link rule and `isHttpLink`, and the draft merge rules. |
| `completion.test.ts` | Completion percentage, section status, and missing or invalid fields. |
| `review-validation.test.ts` | Rubric draft and submission schemas, and the overall score. |
| `mission.test.ts` | Mission stages and legs for every status. |
| `organizer-filters.test.ts` | Lenient list-filter parsing (including the page cap and NUL characters in the search) and query-string serialization. |
| `routes-and-identity.test.ts` | Safe redirect paths, protected routes, blind-review identity splitting, and reference labels. |
| `auth-validation.test.ts` | Signup (Hacker or Judge only), sign-in, and profile schemas. |
| `application-config.test.ts` | Form and rubric configuration matches the schemas. |
| `action-errors.test.ts` | Mapping of database and Auth errors to action error codes. |

## Integration tests (`tests/integration`)

These run the real Server Actions and data-access functions against local Supabase with real users. Every query those functions make, and every direct Data API call a test makes through a supabase-js client, goes through Supabase Auth, the grants, RLS, the CHECK constraints, and the guard triggers. Setup and verification queries through `queryRows()` or `withDatabase()`, the account cleanup in `global-setup.ts`, and all of `schema-drift.test.ts` connect directly as the `postgres` role and bypass RLS and the client grants.

| Completion gate | Proven by |
|---|---|
| 1. Public signup creates only Hacker or Judge | `auth.test.ts`. `signUp` creates Hacker and Judge profiles and refuses Organizer or unknown roles. Direct Supabase Auth signups with `organizer` (any casing or surrounding spaces) create no user. Metadata edits, profile column writes, and calls to the promotion function cannot change a role. |
| 2. Applicants save and submit only their own application | `applications.test.ts` (`saveApplication action`, `submitApplication action`). Covers draft merging, server-side completion, field errors, incomplete submissions, and overlapping saves that must keep every answer. Another applicant's application returns `not_found`, and direct reads and writes to it change nothing. Direct Data API writes of invalid answers, unknown keys, or fake expertise areas are refused by the database. |
| 3. Submitted applications are locked | `applications.test.ts`. Save and submit after submission return `application_locked`. Direct Data API edits, unsubmitting, timestamp writes, deletes, status jumps, and direct submission of invalid answers are refused. |
| 4. Organizers list, review, and release only Accepted or Waitlisted | `organizer-workflow.test.ts`. Covers the filtered and paginated list (including a page past the end and a search containing a NUL character), dashboard aggregates including expertise coverage, blind workspace and identity reveal, draft review saves, overlapping review saves, completion, and next-unreviewed navigation. Decisions require a completed review, other statuses are rejected, decisions are final, review ownership holds, and direct Data API shortcuts are refused. |
| 5. Applicants cannot read other applications, reviews, or organizer data | `isolation.test.ts`. An applicant sees only their own application and profile and no reviews, even of their own application. Every organizer database function is refused with `42501` and hint `forbidden`. `fetchOrganizerDashboard`, `fetchApplicationList`, and `fetchNextUnreviewedApplicationId` fail with a `forbidden` `DataAccessError`, `fetchApplicantIdentity` returns `null` for another applicant's application, and private helpers cannot be called through the Data API. Signed-out visitors are also covered. `organizer-workflow.test.ts` (`organizer-only access`) covers the organizer actions and the `getOrganizerDashboard`, `listApplications`, and `getReviewWorkspace` guards. |

`schema-drift.test.ts` keeps SQL and TypeScript in sync and pins the security posture:

- The response field keys and required keys in `private.application_field_rules` match the Zod schemas, its option lists match the TypeScript option constants exactly (including order), and `private.http_link_pattern()` is character-for-character identical to `HTTP_LINK_PATTERN_SOURCE`.
- `private.application_responses_valid` agrees with the Zod draft and submission schemas on boundary values for every field: lengths counted in Unicode code points (including emoji), JavaScript whitespace trimming, option lists, duplicates, item counts, integer ranges, JSON types, nulls, and a wide set of valid and invalid links. Unknown keys are rejected.
- Rubric dimensions and enum values match the TypeScript constants.
- Seed data satisfies the TypeScript completion and validation rules.
- RLS is enabled on every table.
- `anon` has no access to tables, functions, or sequences.
- `authenticated` has exactly the intended column grants and executable functions.
- There are no `SECURITY DEFINER` functions in `public`, and every function pins `search_path`.

### How the harness works

- **`global-setup.ts`**
  - Reads the local URL, publishable key, and database URL from `supabase status` (see [environment-and-deployment.md](environment-and-deployment.md) for overrides).
  - Refuses non-local hosts.
  - Deletes every `@launchpad.test` account before and after the run.
  - Waits until the API accepts a new session.
- **`setup.ts`**
  - Replaces `@/lib/supabase/server` so that `createClient()` returns a real supabase-js client (publishable key) signed in as the current test user.
  - Replaces `next/cache`, whose revalidation functions need a Next.js request.
- **`helpers.ts`**
  - Creates users through Supabase Auth.
  - Creates Organizers the supported way: a normal signup promoted with `private.promote_to_organizer`.
  - Switches the acting user with `actAs()`.
  - Provides `queryRows()`, which uses the `postgres` role for setup and verification only.
- **Execution.** Files run one at a time because they share the database. Test data never modifies seed rows.

### Not covered by automated tests

- Cookie handling in `lib/supabase/server.ts` and session refresh in `lib/supabase/proxy.ts`. The production build compiles them. A manual `next start` check against local Supabase at handoff showed:
  - Signed-out requests to `/portal`, `/onboarding`, and `/organizer/applications?status=submitted&page=2` get a 307 redirect to `/login?next=…` that keeps the path and query.
  - A request with a valid `@supabase/ssr` session cookie passes through.
  - A forged auth cookie is cleared (`Max-Age=0`) and redirected with `no-store` cache headers.
  - `/` is not redirected.
  - The proxy does not check roles. An applicant session reaches `/organizer`, and the page guard (`requireOrganizer`) must redirect it.
- The effect of `revalidatePath` on rendered pages.
- Any product UI (Phase 2).
