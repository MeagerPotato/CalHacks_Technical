# Organizer pages (Phase 3)

The organizer product from `PROJECT_PLAN.md` section 14: the Mission Control dashboard, the applications table, and
the blind review workspace. This document is the contract for those pages. It covers routes and guards, the client
containers, every organizer view's props and DOM hooks, the gallery, and what Astra may restyle.

The same architecture rules as the applicant product apply (see `docs/frontend/README.md`):

- `app/organizer/**` holds routes and containers only (no `className` or `style`).
- `components/organizer/**` holds presentational views that take display-ready props.
- `lib/view-models/organizer-*.ts` holds the pure builders.
- Pages read through `lib/data/organizer.ts` and write only through the Server Actions in `app/actions/reviews.ts` and
  `app/actions/applications.ts`.

## File map

| Layer | Files |
| --- | --- |
| Routes | `app/organizer/layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`; `app/organizer/applications/page.tsx`; `app/organizer/applications/[id]/page.tsx`, `loading.tsx`, `not-found.tsx` |
| Containers | `app/organizer/_components/OrganizerNavigation.tsx`; `app/organizer/applications/_components/ApplicationFiltersForm.tsx`; `app/organizer/applications/[id]/_components/ReviewWorkspaceClient.tsx`, `use-review-workspace.ts` |
| View models | `lib/view-models/organizer-types.ts` (types), `organizer-routes.ts`, `organizer-shared.ts`, `organizer-dashboard.ts`, `organizer-applications.ts`, `organizer-review.ts`, `organizer-scorecard.ts`, `organizer-feedback.ts` |
| Views | `components/organizer/*.tsx` |
| Copy | `ORGANIZER_LOCKED` and `ORGANIZER_COPY` at the end of `content/copy.ts` |
| Gallery | `app/dev/gallery/organizer/page.tsx`, `app/dev/gallery/organizer/_fixtures.ts` |
| Tests | `tests/unit/organizer-*.test.ts`, `tests/unit/view-contracts-organizer.test.tsx`, `tests/fixtures/organizer.ts`, `e2e/organizer.spec.ts` |

## Routes and guards

| Route | Page | Data |
| --- | --- | --- |
| `/organizer` | Mission Control dashboard | `getOrganizerDashboard()` |
| `/organizer/applications` | Applications table | `listApplications(parseApplicationListFilters(searchParams))` |
| `/organizer/applications/[id]` | Review workspace | `getReviewWorkspace(id, { revealIdentity })` |

Guards run in three places:

1. **Proxy.** `proxy.ts` sends a signed-out GET or HEAD for any `/organizer` path to `/login?next=<path and query>`.
   It does not check roles.
2. **Layout.** `app/organizer/layout.tsx` awaits `requireOrganizer()` before rendering the shell. A signed-out
   visitor goes to `/login` and an applicant to `/portal`, so no organizer markup is sent, not even the navigation.
3. **Pages.** Every page awaits `requireOrganizer()` again, and the data functions call it too. Layouts do not
   re-render on client navigations, so the page guard is the one that runs on every navigation.

The layout reads no organizer data. A failed read renders `app/organizer/error.tsx` inside the shell.

Signing in lands an organizer on the dashboard without any route change: `signIn` sends organizers to
`getHomeRouteForRole("organizer")`, which is `/organizer`, and keeps a `next` path unless it starts with `/portal` or is
`/onboarding`.

Loading, error, and not-found states:

- `app/organizer/loading.tsx` shows `PageLoading` inside the shell's `main`.
- `app/organizer/applications/[id]/loading.tsx` shows it while another workspace loads, for example after Save
  review and continue.
- `app/organizer/error.tsx` shows `PageError` with the `retry` prop, inside the shell.
- `app/organizer/applications/[id]/not-found.tsx` handles a malformed or unknown id (`getReviewWorkspace` returns
  null, and the page calls `notFound()`). It shows `PageNotFound` linking back to the applications table.

One account may hold both a Hacker and a Judge application. Every organizer page works on application ids and never
assumes one application per user.

### Query-string contracts

| Page | Parameter | Meaning |
| --- | --- | --- |
| Applications | `search`, `type`, `status`, `reviewState`, `sort`, `page`, `pageSize` | Parsed leniently by `parseApplicationListFilters`; invalid values fall back to defaults. Links are built by `applicationsHref`, which omits defaults. |
| Workspace | `identity=revealed` | Loads identifying details. Any other value, or none, keeps blind review on (`isIdentityRevealed`). |
| Workspace | `reviewed=H-1042` | The blind reference reviewed just before, shown in the arrival notice. Only `^[HJ]-\d{1,12}$` is accepted (`parseReviewedReference`), and the container removes it after arrival. |

## Containers

### `OrganizerNavigation`

A client component that reads `usePathname()` and renders `OrganizerNav` with `toOrganizerNavItems(pathname)`, so
`aria-current` stays correct across client navigations.

### `ApplicationFiltersForm`

This container enhances the native GET form rendered by `ApplicationFilters`.

- **State:** `hasSubmitted` and a transition (`isPending`).
- **Submit:** the container reads `FormData` into `URLSearchParams`, parses it with `parseApplicationListFilters`,
  and calls `router.push(applicationsHref(filters))` inside a transition. The URL never contains blank or default
  values, and history keeps each filter state. Without JavaScript the browser submits the same field names.
- **URL sync:** the controls are uncontrolled. When the URL changes without this form (a sort header, Clear filters,
  pagination, back or forward), an effect writes the new values into the controls directly, so focus stays where it
  is.
- **Announcements:** the container keeps a `LiveStatus` mounted inside `main`. It stays silent until the first
  submission, reads `COPY.common.loading` while the results load, and then reads the result count (for example
  "3 applications"). Later URL changes update the count it reads.
- **Focus:** focus stays on the submit button.

### `ReviewWorkspaceClient` and `useReviewWorkspace`

This container holds one review workspace. A different application id mounts a new workspace, because the App Router
keys page segments by their params. Search-parameter changes (`identity`, `reviewed`) keep its state.

**State:**

| State | Meaning |
| --- | --- |
| `values` | Scorecard form values (`ScorecardValues`), starting from `view.scorecard.initialValues`. |
| `baseline` | The last saved values. The form is dirty when it is editable and `values` differs from `baseline`. |
| `pending` | The scorecard action in flight: `draft`, `review`, `continue`, or null. |
| `decisionPending` | True while a decision release is in flight. |
| `errorState` | Inline errors, summary items, and form-level messages from `toReviewErrorState`. |
| `notice` | The client notice: a failure, or the queue-done success. |
| `announcement` | The `LiveStatus` text. |
| `decisionStep`, `decisionChoice`, `decisionError` | The two-step release. |
| `identityPending` | Transition state for the blind-mode toggle. |

**Server sync:** when `view.scorecard.initialValues` changes (a save here, a refresh, or another tab), the saved
review becomes the new baseline during render. It also replaces the form values unless there are unsaved edits.

**Saves.** All saves are single-flight.

- **Save draft** calls `saveReview` with every dimension (a null score clears it). The button is hidden once the
  review is complete.
- **Save review** and **Save review and continue** first validate with `REVIEW_SCHEMAS[type].submission`, so missing
  scores and a missing recommendation show without a round trip. Both then call `submitReview`.
- **Save review and continue** moves to `nextApplicationId` with `?reviewed=<reference>`. When nothing is left, it
  stays on the page and shows the `queue-done` success notice. The header's Next application link is the explicit
  fallback.
- **Failed saves:** a validation failure fills the error summary and inline errors, and focuses the summary. Any
  other failure shows an organizer notice from `organizerNoticeFor` as an alert. If the same notice is already
  showing, its title is repeated in the live status.

**Notice actions:**

| Action | Behavior |
| --- | --- |
| `retry` | Repeats the last action. |
| `reload_latest` | Discards local edits and calls `router.refresh()`. |
| `reload` | Reloads the document. |
| `sign_in_new_tab` | A link to `/login?next=<current path and query>`. |

**Blind mode:** the toggle calls `router.replace(view.blind.toggleHref, { scroll: false })` in a transition and
announces "Loading identifying details…" or "Hiding identifying details…". When the page data for the new state
arrives, it announces the blind-mode status text. Focus stays on the toggle. Unsaved edits survive the toggle.

**Arrival after Save review and continue:** the page focuses `h1#workspace-heading`, announces the arrival notice
title on the next task, and removes `?reviewed=` with `history.replaceState`.

**Decision release:**

1. Release decision without a choice shows "Choose a decision to release." and focuses `#decision-choice`.
2. With unsaved review edits, it shows "Save your review before releasing a decision."
3. Otherwise the confirmation group opens and takes focus (`#decision-confirm`).
4. Cancel returns focus to Release decision.
5. Confirm release calls `updateApplicationStatus` and announces "Decision released: <label>". The action
   revalidates the page, so the section turns `released`, and focus moves to `h2#decision-release-title`.

**Leaving the page:**

- The workspace registers with the navigation guard. When the form is dirty, internal links and sign-out flush it
  first: a draft save, or a complete save for a completed review. If the flush fails, the guard asks before leaving.
- Closing or reloading the tab while the form is dirty triggers `beforeunload`.

## View models

| Module | Exports |
| --- | --- |
| `organizer-routes.ts` (client-safe) | `toOrganizerNavItems`, `applicationsHref`, `reviewWorkspaceHref`, `isIdentityRevealed`, `parseReviewedReference`, `IDENTITY_QUERY_PARAM`, `IDENTITY_REVEALED_VALUE`, `REVIEWED_QUERY_PARAM` |
| `organizer-shared.ts` (server) | `toApplicationRowView`, `toQueueProgressView`, `formatScore`, `formatCount`, `toCount`, `toPercent` |
| `organizer-dashboard.ts` (server) | `toDashboardView`, `toExpertiseRadarView` |
| `organizer-applications.ts` (server) | `toApplicationsPageView`, `hasActiveFilters`, `APPLICATION_FILTER_IDS` |
| `organizer-review.ts` (server) | `toReviewWorkspaceView`, `toIdentityView`, `toNarrativeSections` |
| `organizer-scorecard.ts` (client-safe) | `toScorecardValues`, `scorecardValuesEqual`, `toReviewDraftPayload`, `toReviewSubmissionPayload`, `overallScoreText`, `notesCounterText`, `toReviewErrorState`, `emptyScorecardErrors`, `reviewScoreControlId`, `scoreErrorKey`, `REVIEW_NOTES_ID`, `REVIEW_RECOMMENDATION_ID` |
| `organizer-feedback.ts` (client-safe) | `organizerNoticeFor`, `organizerSignInHref`, `queueDoneNotice` |

"Server" builders format timestamps with `toTimestampView`, so only server code calls them.

Narrative answers come from `APPLICATION_FORMS[type].sections` through `toAnswerSections(type, narrative,
{ editable: false })`. Answers whose field is marked `identifying` are dropped, and sections left empty are removed.
New field kinds and changed About-you fields render without changes here.

`toIdentityView` is the only organizer code that reads `ApplicantIdentity` fields.

## Component contracts

Every view is presentational and attaches a handler only when its callback is provided. States use kebab-case or the
data layer's values, as listed below. Style underscore values (`owned_by_another_organizer`, `in_review`) with class
maps, never with `data-[...]` variants.

### `OrganizerShell`

Props: `{ homeHref, nav, actions, children }`.

- `header[data-testid=organizer-header]` holds the brand link to `homeHref`, then `nav`, then `actions`.
- `main#main[tabIndex=-1]` wraps a `max-w-7xl` container.

### `OrganizerNav`

Props: `{ label, items: OrganizerNavItemView[] }`.

- `nav[aria-label=label][data-testid=organizer-nav]` contains `ul > li[data-current=page|true|false]`.
- Each link carries `data-testid="organizer-nav-<id>"` and `aria-current` of `page` or `true`.

### `MissionControlDashboard`

Props: `{ view: DashboardView }`.

- Root: `div[data-testid=organizer-dashboard][data-empty]`.
- The `h1`, then `a[data-testid=start-reviewing]` when an application needs review.
- `notice-dashboard-empty` shows before any submission.
- Composes `KpiCards`, `QueueProgressCard`, `StatusBreakdown`, `ExpertiseRadar`, and `RecentSubmissions`.

### `KpiCards`

Props: `{ title, kpis }`.

- `section[aria-labelledby=kpis-title][data-testid=kpi-cards]` with a visually hidden `h2#kpis-title`.
- One `dl` of `div[data-kpi][data-testid=kpi-<id>]` entries, each with a `dt` label and a `dd` value.
- Ids: `submitted`, `needs-review`, `reviews-complete`, `decisions-made`.

### `QueueProgressCard`

Props: `{ title, progress, emptyText }`.

- A card section named by `h2#queue-title`.
- `ProgressMeter#queue-progress` and `p[data-testid=queue-remaining]`.

### `StatusBreakdown`

Props: `{ title, types }`.

- A section named by `h2#status-breakdown-title`, with one `div[data-type]` per type, each with an `h3`.
- Rows are `li[data-status]` with the label and "count of total" text.
- The bar is `aria-hidden`. Its fill width is the only inline style.

### `ExpertiseRadar`

Props: `{ radar }`.

- A section named by `h2#expertise-radar-title`.
- `svg[role=img][aria-labelledby=expertise-radar-image-title][data-testid=expertise-radar-chart]` with a `<title>`.
- `polygon[data-testid=expertise-radar-shape]`; spoke labels are `text[data-expertise]`.
- `table[data-testid=expertise-radar-table]` has a `caption`, two `th[scope=col]`, and one
  `tr[data-expertise][data-gap=true|false]` per category with a `th[scope=row]`.
- `div[data-testid=coverage-gap][data-gap-count]` holds an `h3` and the gap list.

### `RecentSubmissions`

Props: `{ title, rows, emptyText, viewAll }`.

- A section named by `h2#recent-submissions-title`.
- `li[data-testid=recent-submission-<id>][data-status]` entries link by blind reference ("Applicant H-1042"). The
  dashboard never shows applicant names.

### `ApplicationsView`

Props: `{ view, filters? }`. The `filters` slot replaces the static form.

- Root: `div[data-testid=organizer-applications]`, then the `h1` and intro, then the filters and results.

### `ApplicationFilters`

Props: `{ filters, onSubmit?, pending?, formRef? }`.

- `section[data-testid=application-filters]` named by `h2#application-filters-title`.
- `form[role=search][method=get][action=/organizer/applications]` contains:
  - `input[type=search]#filter-search[name=search]`
  - `select#filter-type[name=type]`, `#filter-status[name=status]`, `#filter-review-state[name=reviewState]`,
    `#filter-sort[name=sort]`
  - hidden `pageSize` when set
  - `button[data-testid=apply-filters]`
  - `a[data-testid=clear-filters]` while filters are active

### `ApplicationsResults`

Props: `{ results }`.

- `section[data-testid=application-results][data-state=results|empty|no-results|past-end]`, named by
  `h2#application-results-title` (the count).
- With results:
  - From `md`: `table[data-testid=applications-table]` with a `caption` and seven `th[scope=col][data-column]`.
    Sortable columns (`submitted`, `score`) carry `data-sorted=ascending|descending|none`. Only the sorted column
    carries `aria-sort`. Sort links are `a[data-testid=sort-<column>]`, with visually hidden text naming the order
    they apply.
  - Rows are `tr[data-testid=application-row-<id>][data-status][data-review-state=complete|in-progress|none]`, each
    with a `th[scope=row]` holding the name link, email, and affiliation.
  - Below `md`: `ul[data-testid=application-cards]` of `li[data-testid=application-card-<id>]` with the same data and
    links.
  - `nav[data-testid=pagination][aria-label]` holds `pagination-previous`, `pagination-status`, and `pagination-next`.
- Otherwise: `div[data-testid=application-results-message]` with an `h3` and its action link.

### `ReviewWorkspaceLayout`

Props: `{ isBlind, access, header, notices?, identity?, narrative, scorecard, decision?, status? }`.

- Root: `div[data-testid=review-workspace][data-blind][data-access]`.
- `header`, then `div[data-testid=workspace-notices]` (only with notices).
- Left column `workspace-narrative-column`: identity, then narrative.
- Right column `workspace-scorecard-column`: scorecard, then decision. It is sticky from `lg`.
- `status` comes last.

### `WorkspaceHeader`

Props: `{ header, blind, onToggleIdentity?, identityPending?, headingRef? }`.

- Links: `a[data-testid=back-to-applications]` and `a[data-testid=next-application]`.
- `h1#workspace-heading[tabIndex=-1]` with type and status badges and the submitted time.
- `div[data-testid=workspace-queue]` holds `ProgressMeter#workspace-queue-progress`.
- `div[data-testid=blind-mode][data-blind]` holds `p#blind-mode-status` and `[data-testid=identity-toggle]`
  (described by that status). The toggle is a button with a callback, otherwise a link to `blind.toggleHref`.

### `IdentityPanel`

Props: `{ identity, panelRef? }`.

- `section#identity-panel[tabIndex=-1][data-testid=identity-panel]` named by `h2#identity-panel-title`.
- A `dl` of `div[data-identity-field=name|email|affiliation|links]` entries. Links open in a new tab.

### `NarrativePanel`

Props: `{ title, sections }`.

- `section[data-testid=narrative-panel]` named by `h2#narrative-title`, containing `AnswerSummary` with `h3` section
  headings.

### `Scorecard`

Props:

| Group | Props |
| --- | --- |
| Data | `view`, `values`, `overallText` |
| Form feedback | `notesCounter?`, `errors?`, `summaryItems?`, `formErrors?`, `summaryRef?`, `onSummaryItemActivate?` |
| Actions | `pending?`, `onScoreChange?`, `onNotesChange?`, `onRecommendationChange?`, `onSaveDraft?`, `onSaveReview?`, `onSaveAndContinue?` |

- Root: `section[data-testid=scorecard][data-access=editable|owned_by_another_organizer|locked][data-completed]`,
  named by `h2#scorecard-title`, with `p[data-testid=scorecard-saved]`.
- Editable, `form#review-form[novalidate]` contains:
  - `ErrorSummary` with `headingId="scorecard-error-summary-title"`
  - one `RubricScoreField` per dimension
  - `[data-testid=overall-score]` (not a live region)
  - recommendation radios (the first is `#review-recommendation`)
  - `textarea#review-notes`
  - buttons `save-review-and-continue` (a submit button when handled), `save-review`, and `save-draft`
- Read-only: `dl[data-testid=scorecard-read-only]` with `div[data-dimension]` entries.

### `RubricScoreField`

Props: `{ dimension, value, errors?, onValueChange? }`.

- A `fieldset` whose legend is the dimension label, containing `div[data-testid=rubric-<key>][data-invalid]` with
  five native radios.
- The first radio's id is `review-score-<key>`; the rest are `review-score-<key>-<score>`.
- Anchor text is `#<radio id>-anchor`, referenced by that radio's `aria-describedby`.
- The error id is `review-score-<key>-error`.

### `DecisionRelease`

Props: `{ view, step?, choice?, error?, pending?, headingRef?, confirmRef?, releaseRef?, onChoiceChange?, onRelease?,
onConfirm?, onCancel? }`.

- Root: `section[data-testid=decision-release][data-state=available|unavailable|released][data-step=choose|confirm]`,
  named by `h2#decision-release-title[tabIndex=-1]`. `data-step` is present only while available.
- Choose: radios with the first `#decision-choice`, and `button[data-testid=release-decision]`.
- Confirm: `div#decision-confirm[role=group][tabIndex=-1][data-decision]`, labelled by `#decision-confirm-title` and
  described by `#decision-confirm-body`, with `confirm-decision` and `cancel-decision` buttons.
- Unavailable: `p[data-testid=decision-unavailable]`.
- Released: `div[data-testid=decision-released][data-decision]` with the release time.

### Page notices

`NoticeFromView` renders page notices as `notice-<id>`:

- **Server:** `review-continued`, `review-owned`, `review-not-submitted`, `review-decided`, `review-completed`.
- **Client:** `queue-done`, plus every organizer feedback code: `unauthenticated`, `forbidden`, `not_found`,
  `validation_failed`, `conflict`, `rate_limited`, `invalid_status_transition`,
  `review_owned_by_another_organizer`, `review_locked`, `review_already_completed`, `review_not_completed`,
  `unexpected_error`, `network`, `stale_deployment`.

## Gallery

`/dev/gallery/organizer` (404 in production) builds every state from the real view models and
`tests/fixtures/organizer.ts`. Views with fixed ids show one variant at a time:

- **Navigation:** on the dashboard, on the table, and inside a workspace.
- **`?dashboard=`:** `data`, `queue-empty`, `empty`.
- **`?applications=`:** `results` (with pagination), `filtered`, `no-results`, `empty`, `past-end`.
- **`?workspace=`:** `blind`, `revealed`, `judge-revealed`, `errors`, `arrival`, `completed`, `choose-error`,
  `confirm`, `queue-done`, `conflict`, `owned`, `not-submitted`, `decided`.
- **Notices:** every distinct organizer notice.
- **Page states:** the workspace not-found state.

Controls have no handlers in the gallery; the containers own behavior.

## What Astra may and may not change

Astra may:

- Restyle every `components/organizer/*` view within the section 13 tokens and contrast rules:
  - composition, spacing, typography, and card treatment
  - the KPI cards, the bars, and the queue meter
  - the radar's colors, rings, and label placement
  - the table and card density
  - the blind-mode bar
  - the sticky scorecard column and the decision confirmation styling
- Rewrite any value in `ORGANIZER_COPY`, keeping keys and function signatures.
- Add decorative art that is `aria-hidden` and never replaces text.

Astra must not:

- Change `ORGANIZER_LOCKED` strings, ids, `data-testid` and `data-*` hooks, ARIA attributes, heading levels, landmark
  structure, or the element types listed above (`table` semantics, `fieldset` radios, `dl` lists, `svg[role=img]`
  with its table alternative).
- Remove the visible text that carries meaning: counts next to bars, the table beside the radar, and the status
  text beside the blind-mode toggle.
- Add motion beyond the plan baseline, move logic into views, or import runtime modules the ESLint boundaries forbid.
- Touch `app/organizer/**`, `lib/view-models/organizer-*.ts`, validation, data, actions, or tests.

## Known gaps

- **No previous application.** The plan asks for previous and next in the workspace header. The data layer exposes
  only `nextUnreviewedApplicationId`, so only Next application is shown. Adding "previous" needs a data-layer
  function such as `get_previous_unreviewed_application_id`.
- **`RadioGroup` only stacks vertically.** The rubric row is built in `RubricScoreField` from `FieldGroup`,
  `choiceControlId`, and native radios. An `orientation` prop on the primitive would let it reuse `RadioGroup`.
- **No select primitive.** The filter selects use a native `select` with `INPUT_CLASSES` inside `Field`.
- **Applicant notice copy.** `lib/editor/feedback.ts` maps organizer and review codes to applicant copy, so organizer
  pages use `organizerNoticeFor` instead.
- **In-app links in notices.** `Notice` link actions always open a new tab, so a notice cannot carry an in-app link
  such as "Back to applications"; that link lives in the workspace header instead.
- **Sticky scorecard column.** From `lg` the scorecard column is sticky and can be taller than the viewport; its lower
  controls are reached by scrolling the page past the column's natural height.
- **Phase 2 access test.** `e2e/access.spec.ts` still accepts a 404 for `/organizer` until Phase 3 lands. After merge
  it can require the redirect away, which `e2e/organizer.spec.ts` already checks.
