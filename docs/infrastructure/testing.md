# Tests and verification

## Commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint with the Next.js core-web-vitals and TypeScript rules. |
| `npm run typecheck` | `next typegen && tsc --noEmit`. Also checks the tests and the Vitest config. |
| `npm run test:unit` | The Vitest `unit` project. Needs no services. |
| `npm run test:integration` | The Vitest `integration` project against local Supabase. Requires Docker and `npm run db:start`. |
| `npm run test` | Both Vitest projects. |
| `npm run test:e2e` | Playwright end-to-end and accessibility tests. Builds the app, serves it on port 3100, and signs real users up against local Supabase. Requires `npm run db:start`. Not part of `verify`. |
| `npm run build` | `next build`, which type-checks again. |
| `npm run verify` | Lint, typecheck, all tests, then the production build. |
| `npm run db:advisors` | Supabase security and performance advisors against the local database. |

The integration suite can run right after `npm run db:reset`; global setup waits for the API to accept a fresh session.

## Unit tests (`tests/unit`)

Pure TypeScript tests with no network or database:

| File | Covers |
|---|---|
| `application-validation.test.ts` | Hacker and Judge submission and draft schemas, limits, the shared About you section (real calendar birthdates within range, country codes, and the LinkedIn, GitHub, and Devpost patterns in `isProfileLink`), and the draft merge rules. |
| `completion.test.ts` | Completion percentage, section status, and missing or invalid fields. |
| `review-validation.test.ts` | Rubric draft and submission schemas, and the overall score. |
| `mission.test.ts` | Mission stages and legs for every status. |
| `organizer-filters.test.ts` | Lenient list-filter parsing (including the page cap and NUL characters in the search) and query-string serialization. |
| `routes-and-identity.test.ts` | Safe redirect paths, protected routes, portal routes that name one application and the `?type=` resolver (including prototype keys and repeated values), blind-review identity splitting, and reference labels. |
| `auth-validation.test.ts` | Signup (Hacker, Judge, or both, never Organizer, with every problem reported on `applicationTypes`), sign-in, and profile schemas. |
| `application-config.test.ts` | Form and rubric configuration matches the schemas. |
| `action-errors.test.ts` | Mapping of database and Auth errors to action error codes. |
| `auth-callback.test.ts` | `GET /auth/callback`: code exchange to `/onboarding` (ignoring `next`), code length limits, mapping of expired, cross-browser, and unknown errors, redirects built from the request URL rather than forwarded host headers, and copy for every error code. |
| `site-url.test.ts` | `getSiteUrl` precedence and validation for `SITE_URL` and the Vercel variables, and the `signUp` confirmation redirect, including a production build with no origin and an invalid `SITE_URL`. |
| `proxy.test.ts` | `updateSession`: signed-out GET and HEAD redirects keep the path and query, send no-store headers, and clear stale cookies. Server Action POSTs pass through, signed-in requests pass with refreshed cookies, and missing variables skip Supabase. |
| `fixtures.test.ts` | The shared application and rubric fixtures are valid, partial, or draft-only exactly as named. |
| `local-supabase.test.ts` | The test harness guards: local-only API and database URLs, including a database URL whose `host` query parameter would send node-postgres to another host, and account cleanup refusing such a URL before connecting. |
| `datetime.test.ts` | Event time zone formatting, timestamp views, calendar-day and day-range labels (across months, years, and the end of daylight saving time), and the configured schedule: parseable, in order, and the published Cal Hacks 13.0 regular round. |
| `schedule.test.ts` | Countdown arithmetic (a partial second counts as whole, and a countdown ends exactly at its target), countdown readings and summaries, the countdown panel for set and unset dates, and the timeline's states and single current stop at every point of the schedule, including dates that are to be announced and a published opening date. |
| `editor-values.test.ts`, `editor-steps.test.ts`, `editor-feedback.test.ts` | Editor value conversion and draft patches, step parsing and DOM ids, and the mapping from action errors to notices and error summaries. |
| `view-model-fields.test.ts` | Field and section copy resolution, including hints generated from the form limits. |
| `navigation-guard.test.ts` | The unsaved-changes navigation guard. |
| `design-tokens.test.ts`, `view-contracts-ui.test.tsx` | Palette tokens and contrast pairs, text and fill tokens combined below 4.5:1 anywhere in `components/`, global focus and reduced-motion rules, and the DOM contract of every UI primitive and art slot. |
| `editor-reducer.test.ts` | The editor reducer: save results rebased onto newer data, edits typed during a save, error clearing, just-completed sections, focus requests, locking, and submission phases. |
| `view-models.test.ts` | Readiness and section-navigation states, answer summaries with option labels and missing text, mission views for every status (never an ETA or percentage), and portal views, including the switcher between a Hacker and a Judge application. |
| `view-contracts-pages.test.tsx`, `view-contracts-application.test.tsx` | The DOM contract of the landing, auth, portal, mission, timeline, and countdown views, and of the editor, review, submitted, and liftoff views. Also that no class name anywhere in `components/` puts an underscore in a data or aria variant value, which Tailwind would read as a space. |

## Integration tests (`tests/integration`)

These run the real Server Actions and data-access functions against local Supabase with real users. Every query those functions make, and every direct Data API call a test makes through a supabase-js client, goes through Supabase Auth, the grants, RLS, the CHECK constraints, and the guard triggers. Setup and verification queries through `queryRows()` or `withDatabase()`, the account cleanup in `global-setup.ts`, and all of `schema-drift.test.ts` connect directly as the `postgres` role and bypass RLS and the client grants.

| Completion gate | Proven by |
|---|---|
| 1. Public signup creates only Hacker or Judge | `auth.test.ts`. `signUp` creates accounts that apply as a Hacker, a Judge, or both, and refuses Organizer, unknown, duplicate, or empty choices. Direct Supabase Auth signups create no user when `account_role` is `organizer` (any casing or surrounding spaces) or `application_types` is malformed or names Organizer. Metadata edits, profile column writes, and calls to the promotion function cannot change a role or application types. Promotion clears application types, and admin changes must keep every owned application. |
| 2. Applicants save and submit only their own application | `applications.test.ts` (`createApplications action`, `saveApplication action`, `submitApplication action`). An account that applies as a Hacker and a Judge gets one draft per type, each saved and submitted on its own, and the database allows one application per type. Covers draft merging, server-side completion, field errors, incomplete submissions, and overlapping saves that must keep every answer. Another applicant's application returns `not_found`, and direct reads and writes to it change nothing. Direct Data API writes of invalid answers, unknown keys, or fake expertise areas are refused by the database. |
| 3. Submitted applications are locked | `applications.test.ts`. Save and submit after submission return `application_locked`. Direct Data API edits, unsubmitting, timestamp writes, deletes, status jumps, and direct submission of invalid answers are refused. |
| 4. Organizers list, review, and release only Accepted or Waitlisted | `organizer-workflow.test.ts`. Covers the filtered and paginated list (including a page past the end and a search containing a NUL character), dashboard aggregates including expertise coverage, blind workspace and identity reveal, draft review saves, overlapping review saves, completion, and next-unreviewed navigation. Decisions require a completed review, other statuses are rejected, decisions are final, review ownership holds, and direct Data API shortcuts are refused. |
| 5. Applicants cannot read other applications, reviews, or organizer data | `isolation.test.ts`. An applicant sees only their own application and profile and no reviews, even of their own application. Every organizer database function is refused with `42501` and hint `forbidden`. `fetchOrganizerDashboard`, `fetchApplicationList`, and `fetchNextUnreviewedApplicationId` fail with a `forbidden` `DataAccessError`, `fetchApplicantIdentity` returns `null` for another applicant's application, and private helpers cannot be called through the Data API. Signed-out visitors are also covered. `organizer-workflow.test.ts` (`organizer-only access`) covers the organizer actions and the `getOrganizerDashboard`, `listApplications`, and `getReviewWorkspace` guards. |

`schema-drift.test.ts` keeps SQL and TypeScript in sync and pins the security posture:

- The response field keys and required keys in `private.application_field_rules` match the Zod schemas, and its option lists match the TypeScript option constants exactly, including order. That covers the 250 country codes: `private.country_codes()` equals `COUNTRY_CODES` from `lib/countries.ts`.
- `private.profile_link_pattern(key)` is character-for-character identical to `PROFILE_LINK_PATTERN_SOURCES[key]` for every profile link field, and null for every other field.
- `private.application_responses_valid` agrees with the Zod draft and submission schemas on boundary values for every field: lengths counted in Unicode code points (including emoji), JavaScript whitespace trimming, option lists, duplicates, item counts, integer ranges, calendar dates (including February 29 and impossible days) and the birthdate range, JSON types, nulls, and a wide set of valid and invalid profile links. Unknown keys are rejected.
- Rubric dimensions and enum values match the TypeScript constants.
- Seed data satisfies the TypeScript completion and validation rules, and exactly one seed account owns both a Hacker and a Judge application.
- RLS is enabled on every table.
- `anon` has no access to tables, functions, or sequences.
- `authenticated` has exactly the intended column grants and executable functions.
- There are no `SECURITY DEFINER` functions in `public`, and every function pins `search_path`.

### How the harness works

- **`global-setup.ts`**
  - Reads the local URL, publishable key, and database URL from `supabase status` (see [environment-and-deployment.md](environment-and-deployment.md) for overrides).
  - Refuses non-local hosts. The database host is read back the way node-postgres resolves it, so a `host` query parameter cannot point a local-looking URL at a remote database.
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

## End-to-end tests (`e2e`)

Playwright drives a production build (`next build`, then `next start -p 3100`) in Chromium against local Supabase. Reduced motion is emulated unless a test turns it off.

- Every account is created by a real signup.
- Organizer steps run through a promoted Organizer's own publishable-key client, so RLS and the workflow triggers apply exactly as they will for the Phase 3 pages.

| File | Covers |
|---|---|
| `auth.spec.ts` | Signup offers only Hacker and Judge checkboxes, rejects a tampered Organizer value, and explains a missing choice. Also: signup through onboarding into the editor, a wrong password, `next` redirects with an unsafe-`next` fallback, and sign-out. |
| `applicant-journey.spec.ts` | The Hacker journey in order: a draft that survives a reload, Save & continue focus, an invalid answer that keeps the section while valid answers save (and the `beforeunload` warning before reloading), browser Back saving the section being left, the multi-choice limit, portal progress, the configured deadline, both countdowns, and Launch Readiness links, an incomplete submission's error summary and links, a complete submission through liftoff to the tracker, and the read-only submitted view. |
| `judge.spec.ts` | A Judge who signs up through the UI, onboards, saves a partial draft, sees Launch Readiness move from not started to in progress, and submits. Also: Judge questions at 375 px with the section menu and keyboard saving, and a complete seeded Judge submission. |
| `dual-applications.spec.ts` | One signup that applies as a Hacker and a Judge: onboarding creates both drafts, the portal switcher moves between the two dashboards and marks the current one (with an axe check), and submitting the Judge application leaves the Hacker draft as it was. A single-application account has no switcher, and a type it does not hold redirects to its own application. |
| `schedule.spec.ts` | The landing page timeline lists the four stops in order with the configured dates, with at most one current stop. With Playwright's clock, the countdowns switch to the browser clock after hydration, tick every second, freeze while the pause toggle is pressed (by mouse), and resume from the keyboard. |
| `mission-states.spec.ts` | The tracker for submitted, in review, Accepted, and Waitlisted applications, driven by real organizer workflow writes and timestamps. Drafts redirect to the portal, and the decision is revealed only after the landing. |
| `access.spec.ts` | Signed-out redirects that keep the destination, Organizers kept out of the portal, and applicants kept out of organizer pages and other applicants' answers. Also: the development gallery is hidden in production, and the callback shows its error notice. |
| `a11y-keyboard.spec.ts` | axe WCAG 2.1 A and AA checks on public pages and on applicant pages in their key states (with the `beforeunload` warning when leaving unsaved answers), the skip link and focus ring (focus moves without a fragment history entry), and a keyboard-only signup, onboarding, error fix, and submission. |
| `editor-recovery.spec.ts` | Editor failures, with Server Action calls intercepted in the browser. A dropped connection: a failed save's Try again keeps focus and repeats the notice title in the live status (also when the section has invalid answers and the error summary takes focus), a retry that succeeds returns focus to the section heading, Check status after an unconfirmed submission keeps focus in the editor, and Try again after a failed background save saves the draft without submitting. A new deployment (an unrecognized action): the retry's Reload notice receives focus. |

`e2e/global-setup.ts`:

- refuses a non-local Supabase, including the database host as node-postgres resolves it;
- checks that `.env.local` points at the same local stack;
- deletes `@launchpad-e2e.test` accounts.

Set `E2E_REUSE_SERVER=1` to reuse a server that is already running on port 3100.

`package.json` pins `playwright-core` with `overrides`, so `@axe-core/playwright` and `@playwright/test` share one version and one `Page` type. When you upgrade `@playwright/test`, update the override to the same version.

## Not covered by automated tests

- Cookie handling in `lib/supabase/server.ts` has no isolated test; the E2E suite exercises it with real sessions. At the Phase 1 handoff, a manual `next start` check against local Supabase also showed:
  - Signed-out requests to `/portal`, `/onboarding`, and `/organizer/applications?status=submitted&page=2` get a 307 redirect to `/login?next=…` that keeps the path and query.
  - A request with a valid `@supabase/ssr` session cookie passes through.
  - A forged auth cookie is cleared (`Max-Age=0`) and redirected with `no-store` cache headers.
  - `/` is not redirected.
  - The proxy does not check roles. An applicant session reaches `/organizer`, and the page guard (`requireOrganizer`) must redirect it.
- The effect of `revalidatePath` on rendered pages is covered only indirectly, by E2E flows that reload or navigate after a save or submission.
- Editor failures that need a server error rather than a dropped connection, such as `conflict` ("Reload latest") or `rate_limited`, are covered by the reducer and feedback unit tests only. `editor-recovery.spec.ts` covers the network paths.
- Visual appearance. The E2E suite checks behavior, the DOM contract, and axe rules, not pixels, so look-and-feel changes need a manual pass on `/dev/gallery` and the real pages.
- Organizer pages (Phase 3).
