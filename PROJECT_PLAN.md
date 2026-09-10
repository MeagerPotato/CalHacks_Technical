# Cal Hacks FA26 Take-Home — Product and Technical Plan

## 0. Handoff and ownership — read before changing code

This file is the shared source of truth and should be handed to Claude Code to start the repository. Claude's first assignment is **infrastructure only**. Claude must complete Phase 1, verify it, summarize the interface it created for the frontend, and then stop.

Ownership is intentionally split:

- **Claude Code owns infrastructure:** project scaffold, Supabase schema/migrations, RLS, auth/session plumbing, server-side data access, Zod contracts, Server Actions, generated database types, seed data, backend-focused tests, environment-variable wiring, and Vercel/Supabase deployment configuration.
- **Astra owns the product and frontend:** information hierarchy, UX flows, route/page implementation, component architecture, form experience, all five added features as user-facing experiences, visual design, copy, responsive behavior, accessibility presentation, illustrations, animation, frontend QA, README narrative, and demo story.
- **The user owns external authorization and submission:** account access, approving connector actions, keeping secrets private, recording the walkthrough, and submitting the form.

Claude must not design or implement the applicant or organizer interface, select fonts/colors, add component libraries for visual purposes, invent marketing copy, generate illustrations, create animations, or make creative product decisions. Framework-generated `app/layout.tsx` and a plain diagnostic home page are acceptable only when needed to prove the scaffold builds. Claude should expose clean typed backend contracts for Astra instead of building UI around them.

After Astra finishes the frontend, Claude may be handed a separate deployment-only task because the user's Vercel and Supabase connectors are configured there. That later task may configure and deploy infrastructure, but it must not redesign or restyle Astra's work.

## 1. Product thesis

Build a small but convincing hackathon operating system called **Launchpad**.

Launchpad gives applicants a calm, guided way to submit an application and gives organizers a fast, fair way to process a large review queue. Its cartoony model-rocketry world turns applying into a mission: applicants assemble a rocket, submission is launch, review is the cruise to a destination planet, and the released decision is landing. The metaphors add personality without obscuring standard product language.

The project should optimize for three things:

1. A flawless end-to-end demo.
2. Clear architecture and authorization that can be explained in an interview.
3. A cohesive feature suite with clear applicant and organizer value.

## 2. Scope decision

### Account and application types

- **Hacker** — public account type with a student/builder application.
- **Judge** — public account type with a judge application.
- **Organizer** — internal account type that reviews both kinds of applications.

Hacker and judge were chosen because their application questions and organizer rubrics are visibly different, making the multi-account requirement obvious in a short demo. Public signup permits only Hacker or Judge; Organizer accounts are created directly in Supabase and can never be selected or granted by a public client.

### Required journeys

Applicant journey:

1. Create an account with email and password.
2. Choose Hacker or Judge during signup.
3. Complete a role-specific application in sections.
4. Save a draft and return later.
5. Review and submit.
6. After launch, follow the rocket mission from submission through review to the released decision.

Organizer journey:

1. Sign in with a pre-seeded organizer account.
2. View aggregate counts and review progress.
3. Search/filter/sort the applications table.
4. Open an application in the review workspace.
5. Score a role-specific rubric, leave notes, and make a recommendation.
6. Update the application's decision status and advance to the next unreviewed application.

### Added feature suite

The features share one product idea: make an opaque, repetitive application process feel clear for applicants and efficient for organizers.

1. **Mission Review Queue** — one application at a time, queue progress, role-specific 1–5 rubric anchors, `Save review and continue`, and automatic navigation to the next unreviewed application.
2. **Blind Review Mode** — hides name, email, school/employer, and profile links until an organizer intentionally reveals them, reducing avoidable identity bias during initial scoring.
3. **Launch Readiness Checklist** — derives completion percentage and missing sections from the role-specific validation schema, includes jump links, and shows a reassuring saved timestamp.
4. **Expertise Radar** — aggregates the expertise tags of submitted Judge applications into simple bars so organizers can see category coverage and gaps without a chart library.
5. **Rocket Mission Tracker** — after submission, replaces the editable application dashboard with a visual journey: Launch, Cruise, and Landing. It communicates only real workflow state and never invents an ETA.

Product rationale: the prompt mentions tens of thousands of applications. Mission Review Queue and Blind Review Mode reduce organizer friction and improve consistency; Launch Readiness and Mission Tracker reduce applicant uncertainty; Expertise Radar turns Judge applications into useful event-planning information.

All five are intentionally small implementations built on data already required by the core portal. Empty, loading, success, and error states plus seeded demo data remain required product polish.

## 3. Explicit non-goals

Do not build these before submission:

- OAuth, magic links, password reset, or email notifications.
- File uploads or resume parsing.
- Team formation, comments between organizers, reviewer assignment algorithms, or real-time collaboration.
- Multiple hackathon events or a general form builder.
- Complex analytics, data exports, bulk decisions, or pagination beyond what the seeded demo needs.
- A custom backend server separate from Next.js and Supabase.

These are good “what I would build next” interview answers, but poor uses of the current deadline.

## 4. Information architecture and routes

| Route | Audience | Purpose |
| --- | --- | --- |
| `/` | Public | Branded landing page with product value and sign-in/apply calls to action |
| `/login` | Public | Email/password sign-in |
| `/signup` | Public | Account creation |
| `/auth/callback` | Public | Supabase auth callback if required by the chosen flow |
| `/onboarding` | Applicant | Confirm Hacker or Judge account details and create the draft application |
| `/portal` | Applicant | Dashboard, completion, deadline, saved/submitted status |
| `/portal/application` | Applicant | Sectioned application editor and review step |
| `/portal/mission` | Applicant | Post-submission Launch/Cruise/Landing tracker |
| `/organizer` | Organizer | Mission Control summary and review progress |
| `/organizer/applications` | Organizer | Searchable/filterable application list |
| `/organizer/applications/[id]` | Organizer | Blind-review workspace and rubric |

Authorization rules should live in a server-side data access layer and in Postgres RLS, not only in layouts or route redirects.

## 5. Application content

Keep each application short enough to complete during testing.

### Shared fields

- Preferred name
- Location/time zone
- Short biography
- Relevant links (optional)
- Code of conduct agreement

### Hacker-specific fields

- School
- Major/area of study
- Graduation year
- Experience level: first project / beginner / intermediate / advanced
- Skills or interests (multi-select chips)
- Previous hackathon count
- “What do you hope to build or learn at Cal Hacks?”
- “Tell us about something you made, explored, or taught yourself.”

### Judge-specific fields

- Company/organization (optional)
- Role/title
- Years of relevant experience
- Areas of expertise (multi-select chips)
- Prior judging or mentoring experience
- Availability blocks
- Preferred project categories
- Conflicts of interest (optional)
- “How do you evaluate an ambitious project that is not fully finished?”
- “Why do you want to judge at Cal Hacks?”

Do not collect sensitive demographic, dietary, travel, or government-ID data for this demonstration.

## 6. Organizer rubrics

All rubric items use 1–5 controls with short anchors. Store individual dimensions as JSON and a calculated overall score separately for easy listing/sorting.

Hacker rubric:

- Motivation and curiosity
- Initiative and evidence of building/learning
- Growth potential
- Community contribution

Judge rubric:

- Relevant expertise
- Evaluation and communication mindset
- Motivation to judge
- Availability and fit

Both include:

- Private organizer notes
- Recommendation: Strong yes / Yes / Maybe / No
- Draft or submitted review state

Application decisions are distinct from reviewer recommendations. A review can recommend “Yes” while the application's official status remains “In review.” Final outcomes are Accepted or Waitlisted; the demo does not use a Rejected state.

## 7. Status model

Database statuses and applicant-facing mission stages:

```text
draft -> submitted -> in_review -> accepted
                              \-> waitlisted

ASSEMBLY     LAUNCH          CRUISE         LANDING
```

Rules:

- Applicants may edit only drafts they own.
- Submitting requires server-side validation of the complete role-specific schema.
- Applicants cannot unsubmit or change decisions.
- Organizers can read submitted applications and update review/decision state.
- A valid submission sets `status = submitted` and `launched_at`; the tracker shows Launch completed and Cruise as the current leg.
- Starting or saving the first organizer review sets `status = in_review` and `review_started_at`; the tracker remains in Cruise with copy that Mission Control is reviewing the application.
- Releasing a result sets `status = accepted` or `waitlisted` plus `decision_released_at`; both outcomes animate a successful landing before showing the decision card.
- All applicants who are not accepted receive Waitlisted. There is no Rejected state in this project.
- Use direct copy alongside the theme: `Application submitted`, `Under review`, `Accepted`, and `Waitlisted` remain visible and accessible.
- Do not show fake percentages, reviewer identity, or estimated decision times.

## 8. Technical architecture

### Stack

- Next.js App Router, TypeScript, and Tailwind CSS.
- Supabase Auth and Postgres.
- `@supabase/ssr` cookie-based browser/server clients.
- Zod for server-side validation and a shared form contract.
- React Hook Form for multi-step client form state, if useful; avoid introducing it if native form handling stays simpler.
- Lucide icons.
- Vercel for preview and production deployments.

Prefer Server Components for reads and initial rendering. Use Client Components only for interactive controls such as the multi-step form, filters, blind-mode toggle, and rubric inputs. Use Server Actions for mutations.

### Request/data flow

```text
Browser
  -> Next.js route / Server Component
      -> server Supabase client (session cookie)
          -> Postgres tables guarded by RLS

Interactive form
  -> validated Server Action
      -> verify authenticated user and role in DAL
      -> Zod parse
      -> Supabase mutation (RLS still enforced)
      -> revalidate/redirect
```

Do not expose or require the Supabase service-role key in the web application. Use only the project URL and publishable key; authorization comes from the user's session plus RLS.

### Environment variables

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Configure both in local `.env.local` and in Vercel Preview and Production. Never commit values.

## 9. Database model

Use migrations committed in `supabase/migrations` and generate TypeScript database types.

### Enums

```sql
account_role: hacker | judge | organizer
application_type: hacker | judge
application_status: draft | submitted | in_review | accepted | waitlisted
recommendation: strong_yes | yes | maybe | no
```

### `profiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | References `auth.users(id)` with cascade delete |
| `display_name` | text | Required after onboarding |
| `account_role` | enum | Hacker or Judge from validated signup; Organizer only through admin/seed SQL |
| `created_at` | timestamptz | Default now |
| `updated_at` | timestamptz | Maintained by trigger |

Create profiles through a carefully validated post-signup action or auth trigger. The only accepted public values are Hacker and Judge. Organizer creation/promotion happens only through seed/admin SQL, and no client update policy may change `account_role`.

### `applications`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK | Owner |
| `application_type` | enum | Hacker or judge; must match the owner's account role |
| `responses` | jsonb | Role-specific answers; default `{}` |
| `completion_percent` | integer | 0–100; convenience value, validated server-side |
| `status` | enum | Default `draft` |
| `launched_at` | timestamptz nullable | Set once on valid submission |
| `review_started_at` | timestamptz nullable | Set when organizer review begins |
| `decision_released_at` | timestamptz nullable | Set with Accepted/Waitlisted outcome |
| `created_at` | timestamptz | Default now |
| `updated_at` | timestamptz | Maintained by trigger |

Constraint: unique (`user_id`). Each Hacker or Judge account owns exactly one application.

JSONB is deliberate: Hacker and Judge questions differ, and the correct Zod schema is selected by `application_type`. Shared/query-critical workflow metadata remains relational.

### `reviews`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `application_id` | uuid FK | Cascade delete |
| `reviewer_id` | uuid FK | Organizer profile |
| `rubric_scores` | jsonb | Role-specific integer scores |
| `overall_score` | numeric | Derived by server from rubric dimensions |
| `notes` | text | Private |
| `recommendation` | enum nullable | |
| `completed_at` | timestamptz nullable | Null while draft; set when the rubric is complete |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Constraint: unique (`application_id`). The take-home uses one organizer review per application. Multi-reviewer assignment is intentionally deferred.

Indexes:

- `applications(status, application_type, submitted_at)` for organizer filters/queue.
- `applications(user_id)` for applicant dashboard.
- `reviews(application_id)` and `reviews(reviewer_id, completed_at)`.

## 10. RLS and authorization contract

Enable RLS on every public table.

Create a small `is_organizer()` SQL helper that checks whether the current user's `profiles.account_role = 'organizer'`. Make it `security definer`, pin `search_path`, and revoke unintended execute privileges as appropriate.

Policies:

### Profiles

- Authenticated users can select/update their own safe profile fields.
- Organizers can select profiles needed for reviews.
- No client policy allows changing `account_role`.

### Applications

- Applicants can select their own applications.
- Applicants can insert only rows where `user_id = auth.uid()`.
- Applicants can update only their own application while its existing status is `draft`; the server action also prevents changing ownership/type/status arbitrarily.
- Organizers can select all applications.
- Organizers can update only official workflow fields through a role-checked server action.

### Reviews

- Organizers can select reviews.
- Organizers can insert/update only reviews whose `reviewer_id = auth.uid()`.
- Applicants have no review access.

Every Server Action must repeat authentication and authorization checks because it is a public mutation endpoint. Route guards are navigation conveniences, not the security boundary.

## 11. Server actions and validation

Recommended actions:

- `signUp(formData)`
- `signIn(formData)`
- `signOut()`
- `createApplication(type)`
- `saveApplication(applicationId, payload)`
- `submitApplication(applicationId)`
- `saveReview(applicationId, rubricPayload)`
- `submitReview(applicationId, rubricPayload)`
- `updateApplicationStatus(applicationId, status)`

Each action should:

1. Read and verify the session with the server Supabase client.
2. Fetch the profile/record needed for an ownership or organizer check.
3. Parse input with the appropriate Zod schema.
4. Perform the smallest mutation.
5. Return a typed success/error result without leaking internal details.
6. Revalidate the affected route or redirect.

Keep schemas in `lib/validation`, not inside components. The same schemas drive completion calculations and final submission validation.

## 12. Recommended code organization and ownership

```text
app/                                      # Astra, except actions
  (marketing)/page.tsx
  (auth)/login/page.tsx
  (auth)/signup/page.tsx
  onboarding/page.tsx
  portal/page.tsx
  portal/application/page.tsx
  portal/mission/page.tsx
  organizer/page.tsx
  organizer/applications/page.tsx
  organizer/applications/[id]/page.tsx
  actions/auth.ts                         # Claude
  actions/applications.ts                 # Claude
  actions/reviews.ts                      # Claude
components/                               # Astra
  application/
  organizer/
  layout/
  ui/
lib/
  auth/dal.ts                             # Claude
  application-config.ts                  # shared contract; Claude creates data shape, Astra uses it
  validation/                             # Claude
  supabase/client.ts                      # Claude
  supabase/server.ts                      # Claude
  supabase/proxy.ts                       # Claude
supabase/                                 # Claude
  migrations/
  seed.sql
types/
  database.ts                             # Claude-generated
proxy.ts                                  # Claude
```

Claude should not create the `components/` tree or the product routes during Phase 1. Astra will avoid giant page components and premature abstraction while building those areas. Shared backend files should export clear, typed functions and results without assuming a particular visual implementation.

## 13. Visual and creative direction

### Brand concept

**Launchpad — Your ideas are cleared for takeoff.**

Visual tone: optimistic, handcrafted, cartoony, and slightly nostalgic. Think model-rocket workshop, graph-paper plans, painted cardboard fins, mission patches, and friendly mission control—not sleek NASA realism or a dark sci-fi dashboard.

Use rocketry language for headings and moments of delight:

- “Launch readiness” for application sections.
- “Ready for launch” on the final review step.
- “Liftoff!” on submission confirmation.
- “Cruising to your destination” while under review.
- “Landing complete” when results are released.
- “Mission Control” for organizer dashboard.
- Keep buttons literal: `Save draft`, `Submit application`, `Next application`.

### Palette

- Midnight navy: `#14233B` — main text, navigation, dark surfaces.
- Cloud cream: `#FFF8ED` — warm page background.
- Sky blue: `#9EDAE5` — secondary surfaces and focus accents.
- Signal coral: `#EF6A5B` — primary calls to action.
- California gold: `#F6C453` — highlights and status accents.
- Evergreen: `#2D6A61` — success and accepted states.
- White: `#FFFFFF` — cards and form surfaces.

Run actual contrast checks during implementation. Do not put white body text on gold or sky blue.

### Type and shape

- Display: Bricolage Grotesque or Space Grotesk.
- Body/interface: Inter.
- Large friendly headlines, compact labels, readable 16px body text.
- Rounded cards (16–20px), crisp 1–2px navy borders, very restrained shadows.
- Hand-drawn trajectory lines, blueprint ticks, rivets, mission patches, star cutouts, and sticker-like badges.

### Hero art

Create a small reusable cartoony asset family rather than one large realistic scene:

- A friendly animal engineer assembling a coral-and-cream model rocket for the landing page and draft dashboard.
- A three-state rocket asset: launch plume, space cruise, and planet landing.
- Tiny supporting stickers: star, wrench, planet, antenna, bolt, and mission patch.

Keep shapes bold and readable at dashboard size, with slightly imperfect ink outlines and subtle screen-print texture. Use transparent backgrounds. Do not copy an official mascot asset or recreate an official university logo.

### Motion

- Slow 2–4px floating motion on stars and the cruising rocket.
- Progress line draws in when a section completes.
- Submission triggers a short rocket-liftoff transition, then routes to the Mission Tracker.
- Landing triggers once per results-page visit and then settles into a static accessible state.
- Respect `prefers-reduced-motion`.

### Accessibility

- Visible focus rings and full keyboard operation.
- Labels remain visible; placeholders are examples, not labels.
- Status uses text/icons as well as color.
- Error summary at the top plus inline field errors.
- Blind-mode state announced and clearly reversible.

## 14. Page-level experience

### Landing page

- Compact nav: Launchpad mark, `Sign in`, `Apply now`.
- Hero copy: “Build what comes next.” / “Your Cal Hacks mission starts here.”
- Cartoony model-rocket workshop illustration with a trajectory line leading toward the portal card.
- Three small promise cards: Assemble, Launch, Explore.
- No long marketing site; the application is the product.

### Applicant portal

- Welcome header and application-type badge.
- Main application card with percent complete and next incomplete section.
- Deadline card and last-saved timestamp.
- Launch Readiness checklist of sections with complete/current/not-started states and jump links.
- After submission, replace editing controls with a prominent `Track your mission` action.

### Rocket Mission Tracker

- A single responsive scene with a dotted path from launchpad to destination planet.
- **Launch:** submission is confirmed; show the real launch timestamp and direct `Application submitted` copy.
- **Cruise:** the application has been received or is actively being reviewed; show `Under review` without a fabricated ETA.
- **Landing:** when results are released, animate the landing and reveal Accepted or Waitlisted in a clear decision card.
- Past stages remain visibly completed, current stage is labeled, and future stages remain muted.
- The page works without animation and exposes the same ordered state text to screen readers.

### Application editor

- Desktop: sticky left section navigation, centered form, small help rail if space allows.
- Mobile: top progress indicator and section selector.
- Save & continue on each section.
- Review screen summarizes all answers with Edit links before the irreversible submission action.

### Organizer dashboard

- Mission Control heading.
- KPI cards: Submitted, Needs review, Reviews complete, Decisions made.
- Application-type/status breakdown with simple bars rather than a chart library.
- Expertise Radar with simple horizontal bars for Judge expertise tags and a short “coverage gap” callout.
- Large `Start reviewing` CTA that opens the next unreviewed application.
- Recent submissions list.

### Applications table

- Search by name/email/school/company.
- Filter by type, status, and reviewed/unreviewed.
- Sort by submitted date or score.
- Desktop table; mobile stacked cards.
- Query-string-backed filters if easy, so views are shareable and refresh-safe.

### Review workspace

- Header with back-to-list, queue progress, blind-mode toggle, previous/next.
- Wide left application narrative; sticky right scorecard.
- Identity fields replaced with neutral labels in blind mode (for example, “Applicant H-1042”).
- Rubric controls include short anchors for 1, 3, and 5.
- Saving a review does not automatically change the official decision.
- `Save review and continue` completes the review, advances queue progress, and opens the next unreviewed application.
- Success toast and an explicit fallback Next application action.

## 15. Seed/demo strategy

Seed 10–14 applications with a mix of:

- Hacker and judge types, with varied expertise tags for the Radar.
- Draft, submitted, in-review, accepted, and waitlisted statuses.
- Several unreviewed submitted applications.
- Realistic but fictional names, schools, companies, answers, and timestamps.
- Two or three completed reviews so score/status UI is populated.

Create one organizer login outside public seed data. Share credentials privately in the submission form or reviewer notes, not in the repository. Ensure no seeded password or secret is committed.

For the video, also keep one applicant account with a partially completed draft and one fresh email address available for the signup flow.

## 16. Testing and completion gates

### Automated minimum

- `npm run lint`
- `npm run typecheck` (add script if absent)
- `npm run build`
- Unit tests for Hacker/Judge Zod validation and completion calculation if time permits.

### Manual end-to-end matrix

Applicant:

- Signup creates a Hacker or Judge profile but cannot create an Organizer.
- Hacker and Judge choices show genuinely different fields.
- Draft persists across logout/login and page refresh.
- Incomplete submission is rejected with useful errors.
- Complete submission locks editing, records `launched_at`, and opens the Mission Tracker.
- Submitted/in-review/accepted/waitlisted records render the correct Launch/Cruise/Landing state.
- Accepted and Waitlisted both land successfully before the decision is revealed.
- Applicant cannot open organizer routes or another user's data.

Organizer:

- Organizer sees all submitted applications and filters work.
- Blind mode hides every intended identifying field.
- Draft review persists.
- Submitted review appears in list score/state.
- Decision update appears on the applicant's Landing stage and decision card.
- Mission Review Queue advances to the next unreviewed application and updates progress.
- Expertise Radar totals match submitted Judge expertise tags.
- Ordinary applicant cannot call review/decision actions directly.

Deployment:

- Fresh production build succeeds.
- Auth redirect URLs include localhost, Vercel preview, and production URL as appropriate.
- Vercel Preview and Production variables are set.
- No service-role key, secrets, or real applicant data exist in Git history/client bundle.
- Desktop and mobile layouts work in Chromium.
- Public URL works in an incognito session.

## 17. Build sequence and time budget

Deploy early. A plain working production app is safer than a polished local-only app.

### Phase 0 — scope lock and accounts (user + Claude, 45 minutes)

- Approve this plan, name, two application types, and creative direction.
- Create GitHub repo, Supabase project, and Vercel project.
- Record environment variables and auth redirect URLs.

### Phase 1 — infrastructure vertical slice (Claude only, 3–4 hours)

- Scaffold with the current Supabase Next.js template.
- Add migrations, enums, tables, indexes, triggers, RLS, and seed data.
- Implement auth and server clients.
- Implement DAL, validation schemas, and application/review/status actions.
- Add backend-focused tests or a small script proving one Hacker or Judge record can be created/submitted and securely read by an Organizer.
- Generate database types and document the exported actions, schemas, expected inputs, and typed return shapes for Astra.
- Run lint, typecheck, tests, and production build.
- Stop after reporting results; do not implement product pages or creative UI.

### Phase 2 — applicant product and frontend (Astra, 3 hours)

- Signup/login/onboarding.
- Hacker and Judge forms.
- Draft persistence, Launch Readiness, review, and submission.
- Applicant dashboard and Rocket Mission Tracker.

### Phase 3 — organizer product and frontend (Astra, 3 hours)

- Dashboard and applications table.
- Review workspace, rubrics, recommendations, decisions.
- Mission Review Queue, blind mode, and Expertise Radar.

### Phase 4 — visual system and creative implementation (Astra, 3 hours)

- Apply full design system and responsive layouts.
- Add original hero illustration and lightweight decorative assets.
- Add polished loading, empty, error, success, and hover/focus states.
- Add subtle motion and reduced-motion behavior.

### Phase 5 — integrated hardening (Astra leads, Claude may verify backend, 2–3 hours)

- Run build/lint/type checks and manual matrix.
- Verify RLS using applicant and organizer sessions.
- Test the production candidate in incognito and at mobile widths.
- Fix only submission-blocking and obvious presentation defects.

### Phase 6 — deployment and submission assets (split ownership, 2 hours plus buffer)

- Astra writes the README with architecture, setup, schema, RLS, feature rationale, trade-offs, and future work.
- Claude may configure and execute Vercel/Supabase deployment after Astra explicitly hands back the finished frontend; it must preserve the UI unchanged.
- Record a rehearsed 2:30–2:45 video.
- Prepare concise submission responses.
- Submit at least one hour before the deadline.

## 18. Division of work

### Claude Code infrastructure brief

Claude should own:

- Next.js/Supabase scaffold and package setup.
- SQL migrations, RLS policies, seed script, and generated database types.
- SSR auth clients, DAL, Server Actions, Zod schemas, and status rules.
- Backend-focused tests or scripts that prove the end-to-end data and authorization path without a designed UI.
- Environment-variable documentation and deployment configuration.
- Build/lint/type/test validation and infrastructure repair.

Claude should work in vertical slices and commit after each verified milestone. It must not weaken RLS, put a service-role key in application code, make Organizer status self-selectable, or replace Supabase with mocked state. It must also not build applicant/organizer pages, install a visual component system, style the product, write marketing copy, generate creative assets, or implement the visual feature experiences. When Phase 1 passes, Claude must provide Astra with a concise backend interface handoff and stop.

### Astra design, product, and frontend brief

Astra owns:

- Final creative direction, palette, typography, copy, illustration, and motion.
- Detailed page wireframes, route implementation, component states, and form UX.
- Applicant and Organizer interfaces connected to Claude's typed actions and schemas.
- Mission Review Queue, Blind Review Mode, Launch Readiness, Expertise Radar, and Rocket Mission Tracker as complete user-facing features.
- Responsive/accessibility polish and browser-level QA.
- README narrative, demo story, and interview walkthrough.

### User-owned account actions

- Create/authorize GitHub, Supabase, and Vercel accounts/projects.
- Keep secrets private.
- Provide any required deployment approval.
- Record and submit the final video/form.

## 19. Three-minute demo script

Aim for 2:35–2:50.

1. **0:00–0:15 — thesis:** “Launchpad is a miniature Cal Hacks application platform focused on a guided applicant experience and fast, fair organizer review.”
2. **0:15–0:55 — applicant:** sign in to the partial draft, show role-specific form, completion checklist, saved state, review, and submit.
3. **0:55–1:10 — status:** show the submitted dashboard/status timeline.
4. **1:10–1:35 — organizer overview:** sign in as organizer, show metrics, filters, statuses, and unreviewed queue.
5. **1:35–2:20 — signature feature:** open an application, demonstrate blind mode, score rubric, submit review, make a decision, and move to next unreviewed.
6. **2:20–2:40 — architecture:** briefly show Supabase tables/RLS or a README diagram and mention SSR auth, server validation, and role separation.
7. **2:40–2:50 — close:** explain that the queue solves consistency and bias at application scale.

Do not spend video time scrolling code, typing long answers, or explaining every visual choice.

## 20. Interview talking points and trade-offs

Be ready to explain:

- Why applicant type and system authorization role are separate concepts.
- Why responses are JSONB while workflow metadata is relational.
- Why RLS and Server Action checks are both present.
- Why email/password was chosen over OAuth under the deadline.
- Why the added feature focuses on organizer throughput and fairness.
- Why review recommendation and official decision are separate.
- Why one completed organizer review per application was chosen for a clear take-home scope.
- Why file uploads, notifications, and a generic form builder were deferred.

At real Cal Hacks scale, revisit:

- Event/form-definition tables and versioned question schemas.
- Multi-reviewer assignment and calibration.
- PII separation, retention/deletion rules, audit logging, and admin MFA.
- Pagination, database-side search, exports, and background jobs.
- Rate limiting, abuse protection, observability, and email delivery.
- Storage-based uploads and virus scanning.

## 21. Definition of done

The project is done only when:

- A new user can authenticate, select either role, save, and submit the correct application.
- An organizer can list, filter, open, grade, and decide applications.
- An applicant cannot access organizer data, verified by behavior and RLS review.
- Mission Review Queue, blind mode, Launch Readiness, Expertise Radar, and the Rocket Mission Tracker all work visibly.
- The production URL works in incognito with seeded demo data.
- The repository has setup instructions, migrations, `.env.example`, architecture notes, and no secrets.
- The demo video and submission answers are complete.
