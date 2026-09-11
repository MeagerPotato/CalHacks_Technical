# Backend contract for the product phase

Product pages can be built entirely on the typed modules below, with no SQL, direct Supabase calls, or infrastructure changes. Every mutation goes through a Server Action that authenticates, authorizes, and validates on its own. The database then enforces the same rules again with grants, Row Level Security, CHECK constraints, and guard triggers (see [database.md](database.md)).

## Module map

| Import from | Where it can run | What it provides |
|---|---|---|
| `@/app/actions/auth` | Server Actions, callable from Client Components | `signUp`, `signIn`, `signOut`, `updateProfile` |
| `@/app/actions/applications` | Server Actions | `createApplication`, `saveApplication`, `submitApplication`, `updateApplicationStatus` |
| `@/app/actions/reviews` | Server Actions | `saveReview`, `submitReview`, `revealApplicantIdentity`, `findNextUnreviewedApplication` |
| `@/lib/auth/dal` | Server only | `getViewer`, `requireViewer`, `requireApplicant`, `requireOrganizer` |
| `@/lib/auth/callback` | Anywhere | `AUTH_CALLBACK_ERROR_CODES`, `isAuthCallbackErrorCode`, `parseAuthCallbackParams`, `mapAuthCallbackError` for `/auth/callback` and the `/login?error=` notice |
| `@/lib/env` | Server; `getSupabasePublicEnv` anywhere | `getSupabasePublicEnv`, `hasSupabasePublicEnv`, `getSiteUrl`, `InvalidSiteUrlError` |
| `@/lib/data/applications` | Server only | `getMyApplication` |
| `@/lib/data/organizer` | Server only | `getOrganizerDashboard`, `listApplications`, `getNextUnreviewedApplicationId`, `getReviewWorkspace`, `DataAccessError` |
| `@/lib/actions/result`, `@/lib/actions/types` | Anywhere | `ActionResult`, `ActionError`, `ActionErrorCode`, `ACTION_ERROR_MESSAGES`, action payload types |
| `@/lib/data/types`, `@/lib/auth/types` | Anywhere | DTOs such as `ApplicantApplication`, `ReviewWorkspace`, `OrganizerDashboard`, and `Viewer`, plus the `isApplicantViewer` and `isOrganizerViewer` type guards |
| `@/lib/validation/*` | Anywhere | Zod schemas, limits, option values, completion calculation, list filters |
| `@/lib/application-config` | Anywhere | Labels, option lists, application form sections, rubric forms |
| `@/lib/domain/*` | Anywhere | Enums, mission tracker state, blind-review helpers |
| `@/lib/routes` | Anywhere | Route paths, role home routes, safe redirect paths |
| `@/types/database` | Anywhere | Generated database types and the generated `Constants` enum values |

Server-only modules import `server-only`, so importing one into a Client Component fails the build. Client Components receive DTOs as props and call Server Actions for changes. `@/lib/supabase/client` exists but none of the planned pages need it.

## Results and errors

Server Actions return a result instead of throwing for expected failures:

```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

interface ActionError {
  code: ActionErrorCode;
  message: string; // neutral default from ACTION_ERROR_MESSAGES; safe to show or replace
  fieldErrors?: Record<string, string[]>; // per-field Zod messages
  formErrors?: string[]; // messages not tied to one field
}
```

Error codes:

| Code | Meaning | Returned by |
|---|---|---|
| `unauthenticated` | No valid session | Every action except `signUp`, `signIn`, and `signOut` |
| `forbidden` | Signed in with the wrong role, the database refused the operation, or Supabase Auth has signups or the email provider disabled | Role-gated actions, `updateProfile`, `signUp`, `signIn` |
| `not_found` | The record does not exist or the caller cannot see it. A malformed application id also returns this. | Application, review, and identity actions, and `updateProfile` |
| `validation_failed` | The input payload failed validation, or the database refused a value (for example a NUL character). See `fieldErrors` and `formErrors` when present. | `signUp`, `signIn`, `updateProfile`, `createApplication`, `saveApplication`, `updateApplicationStatus`, `saveReview`, `submitReview` |
| `conflict` | Another request created or changed the same record first and retrying did not resolve it; reload and try again | `createApplication`, `saveApplication`, `submitApplication`, `saveReview`, `submitReview` |
| `rate_limited` | Supabase Auth rate limit | `signUp`, `signIn`, `signOut` |
| `email_taken` | The account already exists (only reported when email confirmation is off) | `signUp` |
| `weak_password` | Supabase Auth rejected the password | `signUp` |
| `invalid_credentials` | Wrong email or password | `signIn` |
| `email_not_confirmed` | Email confirmation is pending (hosted projects with confirmation on) | `signIn` |
| `application_type_mismatch` | The requested type differs from the account role | `createApplication` |
| `application_locked` | The application is no longer a draft | `saveApplication`, `submitApplication` |
| `application_incomplete` | Required answers are missing or invalid; see `fieldErrors`. `submitApplication` reports invalid answers with this code, not `validation_failed`. | `submitApplication` |
| `invalid_status_transition` | A decision on a draft or an already decided application, or a review on a draft | `updateApplicationStatus`, `saveReview`, `submitReview` |
| `review_owned_by_another_organizer` | Another organizer started this application's review | `saveReview`, `submitReview` |
| `review_locked` | A decision has been released | `saveReview`, `submitReview` |
| `review_already_completed` | A draft save after completion (use `submitReview` to amend) | `saveReview` |
| `review_not_completed` | A decision was attempted before the review was completed | `updateApplicationStatus` |
| `unexpected_error` | Anything else; details are logged on the server only | Any action |

`fieldErrors` keys:

| Area | Keys |
|---|---|
| Applications | Top-level response keys such as `bio` or `skills`. Errors inside a list are reported on the list's key. |
| Reviews | `scores.<dimension>`, `scores` (for an unknown dimension), `notes`, `recommendation` |
| Auth | `email`, `password`, `accountRole`, `displayName`, `next` |
| Decisions | `status` |

Server Component reads return data, redirect through the guards, or throw `DataAccessError` (with the same `code` values) when the database fails. Let the nearest error boundary handle those.

If the two Supabase environment variables are missing, Server Component reads and `signUp`, `signIn`, and `signOut` throw a configuration error. Every other action returns `unexpected_error`.

Payload arguments are plain objects: auth inputs, `saveApplication` answers, and review rubrics. Ids, the application type, and decision statuses are positional string arguments. `signUp`, `signIn`, and `updateProfile` also accept `FormData`.

Text containing a NUL character (U+0000) passes the Zod schemas, but PostgreSQL cannot store it. `saveApplication`, `saveReview`, and `submitReview` then return `validation_failed` without `fieldErrors` or `formErrors`.

## Current user and guards (`@/lib/auth/dal`)

```ts
interface Viewer {
  userId: string;
  email: string;
  displayName: string | null;
  accountRole: "hacker" | "judge" | "organizer"; // always read from public.profiles
  isOrganizer: boolean;
}

getViewer(): Promise<Viewer | null>; // memoized per request
requireViewer(): Promise<Viewer>; // redirects to /login when signed out
requireApplicant(): Promise<ApplicantViewer>; // Hacker or Judge; Organizers redirect to /organizer
requireOrganizer(): Promise<OrganizerViewer>; // Organizer; applicants redirect to /portal
```

Call a guard at the top of each protected page or layout. `proxy.ts` refreshes the session cookie and optimistically sends signed-out page loads (GET and HEAD) on protected paths to `/login?next=…` with no-store headers. Server Action POSTs are never redirected, so an expired session reaches the action and returns `unauthenticated` instead of the login page HTML. The proxy is a convenience only, not the authorization boundary: it does not check roles.

## Authentication actions (`@/app/actions/auth`)

| Action | Input | Success data |
|---|---|---|
| `signUp(input)` | `{ email, password, accountRole: "hacker" \| "judge", displayName? }` or `FormData` | `{ viewer: Viewer \| null, requiresEmailConfirmation: boolean, redirectTo: "/onboarding" \| "/login" }` |
| `signIn(input)` | `{ email, password, next? }` or `FormData` | `{ viewer: Viewer, redirectTo: string }` |
| `signOut()` | none | `{ redirectTo: "/login" }` |
| `updateProfile(input)` | `{ displayName }` or `FormData` | `{ viewer: Viewer }` |

- **Email:** trimmed and lowercased.
- **Password:** 8–72 characters at signup. `signIn` only checks for 1–72 characters and leaves the rest to Supabase Auth.
- **Display name:** 1–80 characters. It is optional at signup and can be set with `updateProfile`.
- **Account role:** can only be `hacker` or `judge`. `organizer` fails validation here, and the database signup trigger rejects it for any other client.
- **Sign-in redirect:** `next` is optional. When present it must be a string of at most 2048 characters (pass `undefined`, not `null`); otherwise `signIn` returns `validation_failed` with `fieldErrors.next` and does not sign in. A valid `next` is used only when it is a same-origin path allowed for the role. Otherwise `redirectTo` is the role home: `/portal` for applicants, `/organizer` for Organizers.
- **Navigation:** actions do not redirect. Navigate to `redirectTo` in the UI after `ok: true`, for example with `router.push` or `router.refresh`. Auth cookies are set by the action.
- **Email confirmation:** when it is enabled (the hosted default), `signUp` returns `requiresEmailConfirmation: true` and no session. The email links to `<origin>/auth/callback`, with the origin from `getSiteUrl()`. The callback signs the user in and continues to `/onboarding`. See [environment-and-deployment.md](environment-and-deployment.md).

## Applicant application

### Reads (`@/lib/data/applications`)

`getMyApplication(): Promise<ApplicantApplication | null>` returns the signed-in applicant's application, or null before `createApplication`.

### Actions (`@/app/actions/applications`)

| Action | Behavior |
|---|---|
| `createApplication(type?)` | Creates the caller's draft. It is idempotent and returns the existing application if there is one. The type always equals the account role; passing a different type returns `application_type_mismatch`. |
| `saveApplication(applicationId, payload)` | Saves a partial draft. See the save rules below. Returns the updated `ApplicantApplication`. |
| `submitApplication(applicationId)` | Validates the saved answers against the full role schema. On failure it returns `application_incomplete` with `fieldErrors`. On success the status becomes `submitted`, the database sets `launched_at`, and the application locks. Submission is irreversible. |

`saveApplication` rules:

- Payload keys follow `HackerApplicationDraftInput` or `JudgeApplicationDraftInput`.
- Provided keys are validated (types, option values, limits) and merged. Omitted keys keep their saved values. Unknown keys are ignored.
- `null` clears any answer. A blank or whitespace-only string also clears a text answer. For choice (including `countryOfResidence`), number, date (`birthdate`), profile link, agreement (`codeOfConductAccepted`), and list fields, send `null` to clear; a blank string fails with `validation_failed`.
- Drafts and submissions check answers the same way. `birthdate` must be a real `YYYY-MM-DD` calendar date from `APPLICATION_LIMITS.birthdate.min` to `.max`. `countryOfResidence` must be one of `COUNTRY_CODES`. `linkedinUrl`, `githubUrl`, and `devpostUrl` must match their pattern in `PROFILE_LINK_PATTERN_SOURCES` (a LinkedIn `/in/` page, a GitHub username, or a Devpost username) and stay within 300 characters.
- `completion_percent` is computed on the server.
- Overlapping saves are merged instead of overwriting each other: a write only succeeds against the version it read, and after three lost races the action returns `conflict`.

The database enforces the same draft and submission rules (see [database.md](database.md#response-validation)), so a direct Data API write cannot store answers these actions would reject. The database is stricter in three cases. It rejects unknown response keys, which the Zod schemas strip and the actions never write. It also refuses text containing a NUL character, and `responses` larger than 32 KB of JSON text; answers within the field limits exceed that only when they are full of control characters. In those two cases `saveApplication` returns `validation_failed` without field details.

### `ApplicantApplication`

This is a union discriminated by `type`.

```ts
{
  id: string;
  referenceNumber: number;
  applicantReference: string; // "H-1042" / "J-1043"
  type: "hacker" | "judge";
  status: "draft" | "submitted" | "in_review" | "accepted" | "waitlisted";
  completionPercent: number; // stored value; 100 once submitted
  launchedAt: string | null;
  reviewStartedAt: string | null;
  decisionReleasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responses: Partial<HackerApplicationDraft | JudgeApplicationDraft>; // saved, valid answers
  completion: ApplicationCompletion; // Launch Readiness data (below)
  mission: MissionState; // Rocket Mission Tracker data (below)
  isEditable: boolean; // true only for drafts
}
```

Applicants never receive review scores, notes, recommendations, or reviewer identity.

### Onboarding flow

The role is chosen at signup. `/onboarding` calls `requireApplicant()` and shows `viewer.accountRole`. To confirm the account details and create the draft, it calls `updateProfile({ displayName })` and then `createApplication()`.

### Completion and Launch Readiness (`@/lib/validation/completion`)

`calculateApplicationCompletion(type, responses)` is pure, so it can also run in a Client Component to preview unsaved answers. The server returns the same shape as `application.completion`:

```ts
{
  percent: number; // 0-100; 100 only when submission would succeed
  isSubmittable: boolean;
  requiredFieldCount: number;
  completedRequiredFieldCount: number;
  sections: Array<{
    id: string; // hacker: about | education | experience | short_answers | agreements
                // judge:  about | professional | judging | short_answers | agreements
    status: "complete" | "in_progress" | "not_started";
    requiredFieldCount: number;
    completedRequiredFieldCount: number;
    missingRequiredFields: string[];
    invalidFields: string[];
  }>;
  nextIncompleteSectionId: string | null;
  missingRequiredFields: string[];
  fieldErrors: Record<string, string[]>; // submission-schema messages
}
```

### Mission tracker (`@/lib/domain/mission`)

`application.mission` is derived only from `status` and the three workflow timestamps. It never contains an ETA or reviewer identity.

| `status` | `stage` | launch leg | cruise leg | landing leg | Flags |
|---|---|---|---|---|---|
| `draft` | `assembly` | upcoming | upcoming | upcoming | |
| `submitted` | `cruise` | complete | current | upcoming | `isSubmitted` |
| `in_review` | `cruise` | complete | current | upcoming | `isSubmitted`, `isUnderReview` |
| `accepted` / `waitlisted` | `landing` | complete | complete | complete | `isSubmitted`; `decision` is set |

Each leg is `{ leg, state, occurredAt }`. `occurredAt` is `launchedAt`, `reviewStartedAt`, or `decisionReleasedAt` respectively.

## Organizer data (`@/lib/data/organizer`)

Every read calls `requireOrganizer()` first. The underlying database functions also refuse non-organizers.

### `getOrganizerDashboard(): Promise<OrganizerDashboard>`

```ts
{
  overview: {
    totalApplications, draftCount, submittedCount /* all non-drafts */, awaitingReviewCount /* submitted */,
    inReviewCount, needsReviewCount /* submitted or in review without a completed review */,
    reviewsCompletedCount, readyForDecisionCount /* in review with a completed review */,
    acceptedCount, waitlistedCount, decisionsMadeCount
  };
  queueProgress: { total; reviewed; remaining };
  statusBreakdown: Array<{ type; total; counts: Record<ApplicationStatus, number> }>; // zeros included
  expertiseCoverage: Array<{ expertise: JudgeExpertiseArea; judgeCount: number }>; // all 12 areas, highest first
  expertiseGaps: JudgeExpertiseArea[]; // areas with zero non-draft Judges
  submittedJudgeCount: number; // non-draft Judge applications
  recentSubmissions: ApplicationListItem[]; // five most recent
  nextUnreviewedApplicationId: string | null;
}
```

### `listApplications(filters): Promise<ApplicationListPage>`

`filters` can be the page's awaited `searchParams` object or a plain object. Invalid values fall back to defaults, so a malformed URL never throws. To start from a `URLSearchParams`, convert it with `parseApplicationListFilters(params)` from `@/lib/validation/organizer` first. Use `toApplicationListSearchParams(filters)` to build shareable URLs.

| Filter | Values | Default |
|---|---|---|
| `search` | Case-insensitive match on name, display name, email, school, company, or `H-`/`J-` reference (max 100 characters; NUL characters are removed) | none |
| `type` | `hacker`, `judge` | both |
| `status` | Any status. Drafts are excluded unless `status=draft`. | all non-drafts |
| `reviewState` | `reviewed` (completed review), `unreviewed` | both |
| `sort` | `submitted_desc`, `submitted_asc`, `score_desc`, `score_asc` | `submitted_desc` |
| `page` | 1 to 21,474,836 (`MAX_PAGE`); anything else becomes 1 | 1 |
| `pageSize` | 1–100; anything else becomes 25 | 25 |

```ts
ApplicationListPage = { items: ApplicationListItem[]; total; page; pageSize; pageCount; filters };

ApplicationListItem = {
  id; referenceNumber; applicantReference; type; status;
  applicantName; applicantEmail; affiliation /* school or company */ | null;
  launchedAt; reviewStartedAt; decisionReleasedAt;
  review: { id; reviewerId; overallScore: number | null; recommendation; completedAt; isCompleted } | null;
};
```

A page past the end returns no items but still reports the real `total` and `pageCount`. List items include name and email for the table view. Blind review (below) omits them.

### `getReviewWorkspace(applicationId, { revealIdentity? }): Promise<ReviewWorkspace | null>`

Returns null for an unknown or invalid id.

```ts
{
  application: {
    id; referenceNumber; applicantReference; type; status; completionPercent;
    launchedAt; reviewStartedAt; decisionReleasedAt; createdAt; updatedAt;
    narrative: /* responses without the IDENTITY_RESPONSE_KEYS answers */;
  };
  identity: {
    applicationId; displayName; email;
    fullName; birthdate /* YYYY-MM-DD */; countryOfResidence /* ISO code */; cityOfResidence; // each string | null
    affiliation /* school or company */ | null;
    links: string[]; // LinkedIn, GitHub, then Devpost, when answered
  } | null; // null unless revealIdentity
  isBlind: boolean;
  review: {
    id; applicationId; reviewerId; isMine: boolean; scores: Record<string, number>;
    overallScore: number | null; notes: string; recommendation: Recommendation | null;
    completedAt: string | null; isCompleted: boolean; createdAt; updatedAt;
  } | null;
  reviewAccess: "editable" | "owned_by_another_organizer" | "locked"; // locked unless status is submitted or in_review
  canReleaseDecision: boolean; // completed review and no decision yet
  nextUnreviewedApplicationId: string | null; // next in queue after this application
  queueProgress: { total; reviewed; remaining };
}
```

Blind review is the default. `IDENTITY_RESPONSE_KEYS` and `splitIdentityResponses` in `@/lib/domain/applicant-identity` define which answers are withheld: full name, birthdate, country and city of residence, the three profile links, and school (Hacker) or company (Judge). `identity.links` contains only links that pass `isProfileLink`, so they are safe to render as `href` values.

### `getNextUnreviewedApplicationId(afterApplicationId?)`

Returns the earliest-launched `submitted` or `in_review` application that has no review, or whose draft review belongs to the caller. Returns null when none remain.

- Applications with a completed review are skipped.
- Applications whose draft review belongs to another organizer are also skipped.
- With an id, the search continues after that application and wraps around to the start.

## Reviews and decisions

### Actions (`@/app/actions/reviews`, `@/app/actions/applications`)

| Action | Behavior |
|---|---|
| `saveReview(applicationId, payload: unknown)` | Draft save. Send a `ReviewDraftInput` object from `@/lib/validation/review`; it is validated at runtime, not at compile time. See the draft rules below. Returns `{ review, application: { id, status, reviewStartedAt } }`. |
| `submitReview(applicationId, payload: unknown)` | Completes the review. Send a `ReviewSubmissionInput` object, validated at runtime. See the completion rules below. Returns the same data plus `nextApplicationId` and `queueProgress` for "Save review and continue". |
| `revealApplicantIdentity(applicationId)` | Returns `ApplicantIdentity` for the blind-review reveal. |
| `findNextUnreviewedApplication(afterApplicationId?)` | Returns `{ applicationId: string \| null }`. |
| `updateApplicationStatus(applicationId, "accepted" \| "waitlisted")` | Releases the official decision. It requires a completed review, sets `decision_released_at`, and is final. Any other status returns `validation_failed`. Returns `{ applicationId, status, decisionReleasedAt }`. |

`saveReview` draft rules:

- The payload is `{ scores?: { [dimension]: 1-5 | null }, notes?, recommendation? }`.
- Omitted fields keep their saved values, and a `null` score clears that score.
- The first save moves a submitted application to `in_review`.
- It never changes the official decision.
- Overlapping saves by the owning organizer are merged; after three lost races the action returns `conflict`.

`submitReview` completion rules:

- Every rubric dimension and a recommendation are required, and the saved scores are replaced.
- The database computes `overallScore` (average of the scores, two decimals) and `completedAt`.
- A completed review can be amended with `submitReview` until a decision is released.

Review ownership:

- There is one review per application. The organizer who saves it first owns it, and others get `review_owned_by_another_organizer`.
- Any organizer may release the decision once the review is complete.

### Rubrics (`@/lib/validation/review`)

- `RUBRIC_DIMENSIONS` lists the dimensions for each type. Hacker: `motivation`, `initiative`, `growth`, `community`. Judge: `expertise`, `evaluation`, `motivation`, `availability`.
- `RUBRIC_SCORE_RANGE` is `{ min: 1, max: 5 }`, and `REVIEW_NOTES_MAX_LENGTH` is 5000.
- `calculateOverallScore(type, scores)` returns the same value the database stores, for live previews.

## Forms, options, and labels

| Module | Exports |
|---|---|
| `@/lib/application-config` | `APPLICATION_FORMS[type].sections[]`, each `{ id, label, fields: ApplicationFieldConfig[] }`. Each field is `{ key, label, kind, required, identifying, maxLength?, min?, max?, maxItems?, options? }`, with `kind` one of `short_text`, `long_text`, `whole_number`, `date`, `single_choice`, `searchable_choice` (a filterable list, used for `countryOfResidence`), `multi_choice`, `profile_link`, `agreement`. Also `RUBRIC_FORMS[type]`, `RUBRIC_DIMENSION_LABELS`, the label maps (`ACCOUNT_ROLE_LABELS`, `APPLICATION_TYPE_LABELS`, `APPLICATION_STATUS_LABELS`, `RECOMMENDATION_LABELS`), and the option lists (`PUBLIC_ACCOUNT_ROLE_OPTIONS`, `COUNTRY_OPTIONS`, `EXPERIENCE_LEVEL_OPTIONS`, `HACKER_SKILL_OPTIONS`, `JUDGE_EXPERTISE_OPTIONS`, `JUDGE_AVAILABILITY_OPTIONS`, `PROJECT_CATEGORY_OPTIONS`, `RECOMMENDATION_OPTIONS`). Field, rubric, recommendation, experience-level, and status labels use the plan's wording. Section labels and the option labels for skills, expertise areas, availability blocks, and project categories are not in the plan; they are placeholders the product phase may replace. |
| `@/lib/validation/application` | `hackerApplicationSchema`, `judgeApplicationSchema`, `hackerApplicationDraftSchema`, `judgeApplicationDraftSchema`, `APPLICATION_SCHEMAS`, `getApplicationSubmissionSchema`, `getApplicationDraftSchema`, `APPLICATION_SECTIONS`, `APPLICATION_LIMITS`, `PROFILE_LINK_PATTERN_SOURCES`, `PROFILE_LINK_KEYS`, the option tuples (`COUNTRY_CODES`, `EXPERIENCE_LEVELS`, `HACKER_SKILLS`, `JUDGE_EXPERTISE_AREAS`, `JUDGE_AVAILABILITY_BLOCKS`, `PROJECT_CATEGORIES`), the helpers (`getApplicationSections`, `getApplicationFieldKeys`, `isRequiredApplicationField`, `getRequiredApplicationFieldKeys`, `mergeApplicationResponses`, `parseStoredResponses`, `isCalendarDate`, `isProfileLink`), and the response and draft types. Country names and codes come from `@/lib/countries` (`COUNTRIES`, United States first). |
| `@/lib/validation/review` | `hackerReviewDraftSchema`, `judgeReviewDraftSchema`, `hackerReviewSubmissionSchema`, `judgeReviewSubmissionSchema`, `REVIEW_SCHEMAS`, `RUBRIC_DIMENSIONS`, `RUBRIC_SCORE_RANGE`, `REVIEW_NOTES_MAX_LENGTH`, `compactRubricScores`, `calculateOverallScore`, and the input and output types. |
| `@/lib/validation/auth` | `emailSchema`, `signUpSchema`, `signInSchema`, `profileUpdateSchema`, `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, `DISPLAY_NAME_MAX_LENGTH`, and the input types. |
| `@/lib/validation/organizer` | `applicationIdSchema`, `applicationListFiltersSchema`, `parseApplicationListFilters`, `toApplicationListSearchParams`, `decisionSchema`, `REVIEW_STATE_FILTERS`, `APPLICATION_SORTS`, `DEFAULT_APPLICATION_SORT`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `MAX_PAGE`, `SEARCH_MAX_LENGTH`. |
| `@/lib/validation/errors`, `@/lib/validation/form-data` | `toFieldErrors`, `toFormErrors`, `FieldErrors`, `formDataToObject`, `toPlainInput`. |
| `@/lib/domain/enums` | `ACCOUNT_ROLES`, `PUBLIC_ACCOUNT_ROLES`, `APPLICATION_TYPES`, `APPLICATION_STATUSES`, `DECISION_STATUSES`, `RECOMMENDATIONS`, their types, `isApplicantRole`, `isDecisionStatus`. |
| `@/lib/domain/applicant-identity` | `IDENTITY_RESPONSE_KEYS`, `formatApplicantReference`, `isIdentityResponseKey`, `splitIdentityResponses`. |
| `@/lib/routes` | `ROUTES`, `organizerApplicationRoute(id)`, `getHomeRouteForRole`, `PROTECTED_ROUTE_PREFIXES`, `isProtectedPath`, `getSafeRedirectPath`. |

The same Zod schemas run on the server. The client may use them for instant feedback, but the server's `fieldErrors` are authoritative.

## Pages in the plan

| Route | Guard | Reads | Actions |
|---|---|---|---|
| `/` | none | `getViewer()` (optional) | none |
| `/signup` | none | `getViewer()` to redirect signed-in users | `signUp` |
| `/login` | none | `searchParams.next` | `signIn` |
| `/auth/callback` | none (GET Route Handler) | `code` only; `next` and token parameters are ignored | none. Exchanges the PKCE code for a session and redirects to `/onboarding`, or to `/login?error=<code>` (`link_expired`, `confirm_link_other_browser`, `invalid_link`, `auth_callback_failed`), always with no-store headers |
| `/onboarding` | `requireApplicant()` | `getMyApplication()` | `updateProfile`, `createApplication` |
| `/portal` | `requireApplicant()` | `getMyApplication()` | `signOut` |
| `/portal/application` | `requireApplicant()` | `getMyApplication()`, `APPLICATION_FORMS[application.type]` | `saveApplication`, `submitApplication` |
| `/portal/mission` | `requireApplicant()` | `getMyApplication()` → `.mission` | none |
| `/organizer` | `requireOrganizer()` | `getOrganizerDashboard()` | `signOut` |
| `/organizer/applications` | `requireOrganizer()` | `listApplications(await searchParams)` | none |
| `/organizer/applications/[id]` | `requireOrganizer()` | `getReviewWorkspace(id, { revealIdentity })`, `RUBRIC_FORMS[type]` | `saveReview`, `submitReview`, `revealApplicantIdentity`, `updateApplicationStatus`, `findNextUnreviewedApplication` |

## Calling actions from Client Components

Actions can be called directly with plain objects:

```ts
"use client";
import { saveApplication } from "@/app/actions/applications";

const result = await saveApplication(application.id, { bio, skills });
if (!result.ok) {
  // result.error.code, result.error.fieldErrors
}
```

With `useActionState`, wrap the action so it receives the form data:

```ts
"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/actions/result";
import type { SignInData } from "@/lib/actions/types";

const [state, formAction, isPending] = useActionState(
  (_previous: ActionResult<SignInData> | null, formData: FormData) => signIn(formData),
  null,
);
// After state?.ok, navigate to state.data.redirectTo.
```

Server Actions revalidate the routes they affect:

- Auth actions: the root layout.
- Application actions: `/onboarding` and the `/portal` layout. `submitApplication` also revalidates the `/organizer` layout, and `createApplication` revalidates only when it creates a new draft.
- Reviews and decisions: the `/organizer` and `/portal` layouts.

Call `router.refresh()` only when data on the current page must update without navigating.
