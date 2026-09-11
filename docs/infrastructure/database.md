# Database, security model, and seed data

The schema lives in `supabase/migrations`. Migrations apply in filename order: locally with `npm run db:reset`, and on a hosted project with `supabase db push`. The generated TypeScript types are in `types/database.ts`; regenerate them with `npm run db:types` after any schema change.

## Migrations

| File | Purpose |
|---|---|
| `20260910220000_core_schema.sql` | Creates the non-exposed `private` schema, the enums, and the response validation functions. Defines `profiles`, `applications`, and `reviews` with their CHECK constraints, plus indexes and `updated_at` triggers. RLS is enabled and Data API privileges are revoked in the same migration, so the tables deny access by default. |
| `20260910220100_auth_profile_provisioning.sql` | Signup trigger that creates profiles (Hacker or Judge only), the email sync trigger, the profile write guard, and the admin-only `private.promote_to_organizer(email)`. |
| `20260910220200_workflow_guards.sql` | Adds `private.is_organizer()` and `private.current_account_role()`, the application state-machine guard, and the review guard (rubric validation, overall score, completion lock). Also adds the trigger that moves an application into review when its first review is saved. |
| `20260910220300_rls_and_privileges.sql` | Table and column grants for `authenticated`, function grants for the private helpers, and every RLS policy. |
| `20260910220400_organizer_read_functions.sql` | Organizer-only read functions for the dashboard, filtered listing, and the review queue. |

## Enums

| Enum | Values |
|---|---|
| `account_role` | `hacker`, `judge`, `organizer` |
| `application_type` | `hacker`, `judge` |
| `application_status` | `draft`, `submitted`, `in_review`, `accepted`, `waitlisted` (there is no rejected state) |
| `recommendation` | `strong_yes`, `yes`, `maybe`, `no` |

## Tables

### `profiles`

| Column | Notes |
|---|---|
| `id` | Primary key; references `auth.users` (cascade delete). |
| `email` | Copied from `auth.users` by trigger so organizers can search. Clients cannot write it. |
| `display_name` | 1–80 characters or null. This is the only column a client may edit. |
| `account_role` | `hacker` or `judge` from signup; `organizer` only through admin SQL. |
| `created_at`, `updated_at` | Maintained by the database. |

### `applications`

| Column | Notes |
|---|---|
| `id` | UUID primary key. |
| `reference_number` | Identity starting at 1001, unique. Used for non-identifying labels such as `H-1042`. |
| `user_id` | References `profiles` (cascade delete). Unique, so each account has at most one application. |
| `application_type` | Must equal the owner's `account_role`. |
| `responses` | JSON object of at most 32 KB. CHECK constraints enforce the draft or submission contract of `lib/validation/application.ts` (see [Response validation](#response-validation)). |
| `completion_percent` | 0–100. The server computes it for drafts; it is always 100 once submitted. |
| `status` | Defaults to `draft`. |
| `launched_at` | Set by the database on submit. |
| `review_started_at` | Set by the database when the first review is saved. |
| `decision_released_at` | Set by the database when Accepted or Waitlisted is released. |
| `created_at`, `updated_at` | Maintained by the database. The Server Actions use `updated_at` to detect overlapping saves. |

CHECK constraints:

- `applications_status_timestamps`: the three workflow timestamps match the status.
- `applications_timestamp_order`: `launched_at` ≤ `review_started_at` ≤ `decision_released_at`.
- `applications_draft_responses_valid`: a draft's answers have valid types, option values, and limits, and no unknown keys.
- `applications_submitted_responses_complete`: every non-draft row satisfies the full submission contract and has `completion_percent` 100.
- `applications_responses_is_object`, `applications_responses_size`, and `applications_completion_percent_range`.

Index: `applications_review_queue_idx (status, application_type, launched_at)`.

### `reviews`

| Column | Notes |
|---|---|
| `id` | UUID primary key. |
| `application_id` | References `applications` (cascade delete). Unique, so there is one review per application. |
| `reviewer_id` | References `profiles` (restrict delete). |
| `rubric_scores` | JSON object of integer scores 1–5, keyed by rubric dimension. |
| `overall_score` | `numeric(3,2)`. The database computes it as the average once every dimension is scored; otherwise it is null. |
| `notes` | Private organizer notes, up to 5000 characters. Applicants can never read them. |
| `recommendation` | Reviewer recommendation, or null. This is separate from the official decision. |
| `completed_at` | Null while the review is a draft. The database sets it and never changes it afterwards. |
| `created_at`, `updated_at` | Maintained by the database. |

Rubric dimensions:

- Hacker: `motivation`, `initiative`, `growth`, `community`.
- Judge: `expertise`, `evaluation`, `motivation`, `availability`.

The SQL function `private.rubric_dimensions` and `lib/validation/review.ts` must list the same dimensions. An integration test fails if they drift apart.

## Response validation

The database enforces the Zod response contract, plus the stricter cases listed below, so writes that bypass the Server Actions (for example direct Data API calls) cannot store answers the app would reject.

| Function | Purpose |
|---|---|
| `private.application_field_rules(type)` | One row per response field: its kind (`text`, `integer`, `choice`, `choices`, `links`, `accepted`), whether it is required, and its length, range, item-count, and option limits. |
| `private.application_responses_valid(type, responses, submitted)` | Checks responses against the draft rules (`submitted = false`) or the submission rules (`submitted = true`). Used by both CHECK constraints. |
| `private.trim_js_whitespace(text)` | Trims exactly the characters JavaScript's `trim()` removes, so blank checks and length limits match Zod. Lengths are then measured with `char_length`, which counts Unicode code points exactly as Zod 4 does. |
| `private.http_link_pattern()` | The link pattern for submitted applications. It is identical to `HTTP_LINK_PATTERN_SOURCE` in TypeScript. |

- **Draft rules.** Any answer may be missing or null. A present answer must have the right JSON type, use allowed option values without duplicates, and stay within the length, range, and item limits. Draft links may be any text up to 300 characters.
- **Submission rules.** Every required answer must be present: non-blank text, a non-empty choice list, and an accepted code of conduct. Optional answers are omitted rather than null, and every link must match the link pattern.
- **Stricter than Zod.**
  - Unknown keys are always rejected. Zod strips them, and the Server Actions never write them.
  - Text containing a NUL character (U+0000) cannot be stored in `jsonb` at all (SQLSTATE `22P05`).
  - `applications_responses_size` caps `responses` at 32 KB of JSON text. Answers within the field limits reach that only when they are full of control characters.
  - The Server Actions return `validation_failed` without field details for the last two.

`tests/integration/schema-drift.test.ts` checks that the field keys, required flags, option lists, and link pattern are identical in SQL and TypeScript. It then compares the database with Zod on boundary values for every field in both modes, and fails on any disagreement. When changing a field, limit, or option, update `lib/validation/application.ts` and `private.application_field_rules` together.

## Workflow state machine

```
draft ──applicant submits complete answers──────────────▶ submitted     sets launched_at
submitted ──organizer saves the first review────────────▶ in_review     sets review_started_at
in_review ──organizer releases (completed review needed)▶ accepted | waitlisted   sets decision_released_at
```

`private.guard_application_write` enforces these rules for client requests, i.e. those made as the `anon` or `authenticated` role:

- **Applicants** may insert only their own draft, whose type must equal their role. They may update the application only while it is a draft, and may keep it as a draft or submit it. Submitted applications cannot be edited or unsubmitted.
- **Organizers** cannot change `responses`, `completion_percent`, or `launched_at`. They may move an application from `submitted` to `in_review`. They may release `accepted` or `waitlisted` only when a completed review exists. Released decisions are final.
- **Timestamps** are always set by the database. Clients have no grant to write them.

`private.guard_review_write` enforces these rules:

- Only organizers may write reviews. On insert, `reviewer_id` must be the caller. IDs are immutable.
- Reviews can be written only while the application is `submitted` or `in_review`.
- Unknown dimensions and scores that are not integers from 1 to 5 are rejected. `overall_score` is always recomputed.
- The database sets `completed_at`, which cannot go back to null. Completing a review requires every score and a recommendation.

`private.start_application_review`, an AFTER trigger on `reviews`, moves a `submitted` application to `in_review`. It runs as the calling organizer, so RLS and the application guard still apply.

## Authorization layers

Every client write must pass three independent layers. Server Actions also authenticate and authorize before calling the database.

### 1. Grants

- `anon` has no access to any table, sequence, or function in `public` or `private`.
- `authenticated` has `SELECT` on the three tables, plus only these column writes:

| Table | INSERT columns | UPDATE columns |
|---|---|---|
| `profiles` | none | `display_name` |
| `applications` | `user_id`, `application_type`, `responses`, `completion_percent` | `responses`, `completion_percent`, `status` |
| `reviews` | `application_id`, `reviewer_id`, `rubric_scores`, `notes`, `recommendation`, `completed_at` | `rubric_scores`, `notes`, `recommendation`, `completed_at` |

Clients have no `DELETE` or `TRUNCATE` privileges and no sequence privileges.

`authenticated` can execute the five organizer read functions and these private helpers, because CHECK constraints, policies, and `SECURITY INVOKER` functions call them with the caller's privileges: `application_field_rules`, `application_responses_valid`, `trim_js_whitespace`, `http_link_pattern`, `rubric_dimensions`, `is_organizer`, and `current_account_role`. The `private` schema is not exposed through the Data API.

### 2. Row Level Security

| Policy | Rule |
|---|---|
| `profiles_select_own_or_organizer` | Own profile; organizers can read all profiles. |
| `profiles_update_own` | Own profile only. |
| `applications_select_own_or_organizer` | Own application; organizers can read all applications. |
| `applications_insert_own_draft` | `user_id` is the caller, `status` is `draft`, and the type equals the caller's role. |
| `applications_update_own_draft_or_organizer_workflow` | Applicant branch: own row that is currently a draft, and the new status is `draft` or `submitted`. Organizer branch: a `submitted` or `in_review` row, and the new status is `in_review`, `accepted`, or `waitlisted`. |
| `reviews_select_organizer` | Organizers only. Applicants cannot read any review, including reviews of their own application. |
| `reviews_insert_own_as_organizer` | Organizer, and `reviewer_id` is the caller. |
| `reviews_update_own_as_organizer` | Organizer, and only reviews they wrote. |

### 3. Guard triggers

These are the guard functions described in the workflow section. All three are `SECURITY INVOKER`, so they see the caller's role and session.

`private.is_organizer()` and `private.current_account_role()` are `SECURITY DEFINER` so policies can read `profiles` without recursion. They live in `private`, which the Data API does not expose. EXECUTE is granted to `authenticated` and `service_role`, never to `anon`. Every function pins `search_path = ''`.

### Signup and roles

`private.handle_new_auth_user` reads `raw_user_meta_data.account_role` exactly once, when the auth user is created. Matching ignores case and leading or trailing spaces. Other whitespace, such as a tab, is not trimmed, so such a value is rejected.

- A blank or missing value becomes `hacker`.
- `hacker` and `judge` are accepted.
- Anything else, including `organizer`, raises an error and aborts the signup. Supabase Auth then returns HTTP 500 "Database error saving new user", and no user row is created.

After signup, user metadata is never read again; `profiles.account_role` is the only source of truth. Users can edit their own metadata with `auth.updateUser`, but that has no effect on their role.

## Organizer read functions

All five functions are `SECURITY INVOKER`. EXECUTE is revoked from `PUBLIC` and `anon` and granted to `authenticated`; `service_role` keeps Supabase's default EXECUTE. Every call raises `42501` with hint `forbidden` unless the signed-in caller is an organizer, so a service-role call without a user session is refused too. Prefer the typed DAL wrappers in `lib/data/organizer.ts`: the generated RPC types mark every returned column as non-null, but several columns can be null.

| Function | Result |
|---|---|
| `get_organizer_overview()` | One row with these counts: `total_applications`, `draft_count`, `submitted_count` (all non-drafts), `awaiting_review_count` (status `submitted`), `in_review_count`, `needs_review_count` (submitted or in review without a completed review), `reviews_completed_count`, `ready_for_decision_count` (in review with a completed review), `accepted_count`, `waitlisted_count`, `decisions_made_count`. |
| `get_application_status_breakdown()` | `(application_type, status, application_count)`. Combinations with no applications are omitted; the DAL fills them in as zero. |
| `get_judge_expertise_counts()` | `(expertise, judge_count)` for the 12 known expertise areas across non-draft Judge applications, so the result never exceeds 12 rows. Areas with zero judges are omitted; the DAL adds them back as zero. |
| `list_review_applications(p_search, p_application_type, p_status, p_review_state, p_sort, p_limit, p_offset)` | Page of applications with applicant name, email, affiliation, workflow timestamps, review summary, and `total_count`. See the details below. |
| `get_next_unreviewed_application_id(p_after_id)` | ID of the earliest-launched `submitted` or `in_review` application that has no review, or whose draft review belongs to the caller; null when none remain. See the queue rules below. |

`list_review_applications` details:

- Drafts are excluded unless `p_status = 'draft'`.
- Search is a case-insensitive substring match with escaped wildcards. It covers preferred name, display name, email, school, company, and `H-`/`J-` reference numbers.
- `p_review_state` is `reviewed` (has a completed review) or `unreviewed`.
- `p_sort` is `submitted_desc`, `submitted_asc`, `score_desc`, or `score_asc`.
- The limit is clamped to 1–200. `p_offset` is an `integer`.
- `total_count` is repeated on every returned row, so an offset past the last match returns no count. The DAL runs a separate count in that case.

`get_next_unreviewed_application_id` queue rules:

- An application is skipped if its review is completed, or if another organizer has a draft review for it.
- With `p_after_id`, the search continues after that application in queue order and wraps around to the start.

## Database error hints

The guards and functions raise stable `HINT` values. `lib/actions/errors.ts` maps them to action error codes and never forwards database messages or details to the client.

| Hint | Action error code |
|---|---|
| `forbidden`, `invalid_account_role`, `role_application_mismatch` | `forbidden` |
| `not_found` | `not_found` |
| `application_type_mismatch` | `application_type_mismatch` |
| `application_locked` | `application_locked` |
| `invalid_status_transition` | `invalid_status_transition` |
| `review_locked` | `review_locked` |
| `review_already_completed` | `review_already_completed` |
| `review_not_completed` | `review_not_completed` |
| `review_incomplete`, `invalid_rubric`, `invalid_filter` | `validation_failed` |

Violations without a hint are mapped by constraint name or SQLSTATE:

| Violation | Action error code |
|---|---|
| `applications_submitted_responses_complete` | `application_incomplete` |
| `applications_status_timestamps`, `applications_timestamp_order` | `invalid_status_transition` |
| `reviews_one_per_application` | `review_owned_by_another_organizer` |
| `42501` | `forbidden` |
| `23505` | `conflict` |
| `23502`, `23514` (including `applications_draft_responses_valid`), `22P02`, `22P05`, `22023` | `validation_failed` |
| `23503`, `PGRST116` | `not_found` |

## Seed data

`supabase/seed.sql` runs locally the first time `npm run db:start` creates the database and on every `npm run db:reset`. It contains no passwords, and every row satisfies the response validation constraints.

- **Auth users:** 14 users at `@example.com`, all without passwords, so none can sign in. There are 7 Hackers, 6 Judges, and 1 Organizer (`seed.reviewer@example.com`, promoted with `private.promote_to_organizer`).
- **Applications:** 13 in total.
  - Hackers: 2 draft, 3 submitted, 1 in review, 1 accepted.
  - Judges: 1 draft, 4 submitted, 1 waitlisted.
- **Reviews:** 3 completed reviews, on the in-review, accepted, and waitlisted applications.
- **Judge expertise** (non-draft Judges, meaning the 4 submitted and the 1 waitlisted, as counted by `get_judge_expertise_counts`):
  - `ai_ml`: 2.
  - `data`, `design_ux`, `developer_tools`, `education`, `fintech`, `hardware`, `health`, `security`, and `web`: 1 each.
  - `mobile` and `climate`: 0, so the expertise gaps are visible.
- **Timestamps** are relative to `now()`, so the demo always looks recent.
- **Fixed ID prefixes:** users `a0000000-…`, applications `b0000000-…`, reviews `c0000000-…`.

## Admin SQL

Run these as `postgres`: in the Supabase SQL editor, in local Studio at http://127.0.0.1:54323, or with psql. They are not reachable through the Data API or the app.

```sql
-- Promote an account you have just created yourself. With email confirmation off, anyone can
-- register any address, so never promote an account that already existed. It must not own an application.
select private.promote_to_organizer('organizer@example.org');

-- Return an Organizer to an applicant role.
update public.profiles set account_role = 'hacker' where email = 'organizer@example.org';

-- Before deleting an Organizer who wrote reviews (reviews.reviewer_id is ON DELETE RESTRICT):
delete from public.reviews
where reviewer_id = (select id from public.profiles where email = 'organizer@example.org');
-- Then delete the user in Authentication > Users.
```

Trusted roles (`postgres`, `service_role`) skip the client-only checks: ownership, the organizer requirement, application status transitions, and the review lock after a decision. They must still satisfy every CHECK constraint and the guard rules that apply to all writers: immutable identifiers, an application type that matches the owner's role, valid rubric scores, complete reviews on completion, and completed reviews that cannot return to draft. Do not add `SECURITY DEFINER` functions or RPCs that write `applications` or `reviews`, because they would run with those trusted privileges.
