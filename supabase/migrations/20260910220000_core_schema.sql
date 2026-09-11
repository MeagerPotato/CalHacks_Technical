-- =============================================================================
-- Launchpad core schema
--
-- Enums, tables, CHECK constraints, indexes, and updated_at maintenance.
-- Row Level Security is enabled and Data API privileges are revoked in this same
-- migration so the tables are deny-by-default from the moment they exist.
-- Policies and column-level grants are added in 20260910220300_rls_and_privileges.
-- =============================================================================

create schema if not exists private;
comment on schema private is
  'Internal helpers for triggers, constraints, and RLS. Not exposed through the Data API.';
revoke all on schema private from public;
-- Postgres grants EXECUTE on new functions to PUBLIC, and a per-schema ALTER DEFAULT
-- PRIVILEGES cannot remove that grant. Every function in these migrations therefore
-- revokes PUBLIC access explicitly and grants EXECUTE only where it is required.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.account_role as enum ('hacker', 'judge', 'organizer');
create type public.application_type as enum ('hacker', 'judge');
create type public.application_status as enum ('draft', 'submitted', 'in_review', 'accepted', 'waitlisted');
create type public.recommendation as enum ('strong_yes', 'yes', 'maybe', 'no');

comment on type public.account_role is
  'System authorization role. Public signup may only create hacker or judge; organizer is granted by admin SQL.';
comment on type public.application_type is 'Which application form an applicant completes.';
comment on type public.application_status is
  'draft -> submitted -> in_review -> accepted | waitlisted. There is no rejected state.';

-- ---------------------------------------------------------------------------
-- Response validation used by CHECK constraints
--
-- The database enforces the same response contract as the Zod schemas in
-- lib/validation/application.ts, so requests that bypass the Next.js server (for
-- example direct Data API calls) cannot store answers the app would reject.
-- tests/integration/schema-drift.test.ts compares both implementations value by value.
-- ---------------------------------------------------------------------------

-- Removes the characters JavaScript's String.prototype.trim() removes, matching Zod's .trim().
create function private.trim_js_whitespace(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    p_value,
    '^[\x09-\x0d\x20\xa0\x1680\x2000-\x200a\x2028\x2029\x202f\x205f\x3000\xfeff]+|[\x09-\x0d\x20\xa0\x1680\x2000-\x200a\x2028\x2029\x202f\x205f\x3000\xfeff]+$',
    '',
    'g'
  );
$$;

-- Submitted links must be http(s) URLs with a domain name and an optional port.
-- lib/validation/application.ts (HTTP_LINK_PATTERN_SOURCE) uses the identical pattern.
create function private.http_link_pattern()
returns text
language sql
immutable
set search_path = ''
as $$
  select '^https?://(?=[A-Za-z0-9.-]{1,253}(?:[:/?#]|$))(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(?::(?:[1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?(?:[/?#][^\x01-\x20\x7f]*)?$'::text;
$$;

-- Response fields per application type, mirroring the Zod schemas.
-- Kinds, as required for a submitted application (drafts may omit any answer or set it to null):
--   text      string; after trimming, non-empty when required and at most max_length characters
--             (char_length counts Unicode code points, exactly as Zod 4 measures strings)
--   integer   whole number from min_value to max_value
--   choice    one of options
--   choices   non-empty array of distinct options with at most max_items entries
--   links     array of at most max_items links matching http_link_pattern, each at most max_length
--   accepted  JSON true
create function private.application_field_rules(p_type public.application_type)
returns table (
  field_key text,
  field_kind text,
  is_required boolean,
  max_length integer,
  min_value integer,
  max_value integer,
  max_items integer,
  options text[]
)
language sql
immutable
set search_path = ''
as $$
  select
    r.field_key,
    r.field_kind,
    r.is_required,
    r.max_length::integer,
    r.min_value::integer,
    r.max_value::integer,
    r.max_items::integer,
    r.options::text[]
  from (
    values
      ('hacker', 'preferredName', 'text', true, 80, null, null, null, null),
      ('hacker', 'location', 'text', true, 120, null, null, null, null),
      ('hacker', 'bio', 'text', true, 600, null, null, null, null),
      ('hacker', 'links', 'links', false, 300, null, null, 5, null),
      ('hacker', 'school', 'text', true, 120, null, null, null, null),
      ('hacker', 'major', 'text', true, 120, null, null, null, null),
      ('hacker', 'graduationYear', 'integer', true, null, 2000, 2040, null, null),
      ('hacker', 'experienceLevel', 'choice', true, null, null, null, null,
        array['first_project', 'beginner', 'intermediate', 'advanced']),
      ('hacker', 'skills', 'choices', true, null, null, null, 8,
        array['web', 'mobile', 'ai_ml', 'data', 'hardware', 'design', 'game_dev', 'security', 'cloud', 'robotics',
              'ar_vr', 'blockchain']),
      ('hacker', 'previousHackathonCount', 'integer', true, null, 0, 100, null, null),
      ('hacker', 'buildGoals', 'text', true, 1500, null, null, null, null),
      ('hacker', 'proudProject', 'text', true, 1500, null, null, null, null),
      ('hacker', 'codeOfConductAccepted', 'accepted', true, null, null, null, null, null),
      ('judge', 'preferredName', 'text', true, 80, null, null, null, null),
      ('judge', 'location', 'text', true, 120, null, null, null, null),
      ('judge', 'bio', 'text', true, 600, null, null, null, null),
      ('judge', 'links', 'links', false, 300, null, null, 5, null),
      ('judge', 'company', 'text', false, 120, null, null, null, null),
      ('judge', 'roleTitle', 'text', true, 120, null, null, null, null),
      ('judge', 'yearsExperience', 'integer', true, null, 0, 60, null, null),
      ('judge', 'expertiseAreas', 'choices', true, null, null, null, 6,
        array['ai_ml', 'web', 'mobile', 'hardware', 'data', 'security', 'design_ux', 'developer_tools', 'health',
              'climate', 'fintech', 'education']),
      ('judge', 'judgingExperience', 'text', true, 1000, null, null, null, null),
      ('judge', 'availability', 'choices', true, null, null, null, 6,
        array['friday_evening', 'saturday_morning', 'saturday_afternoon', 'saturday_evening', 'sunday_morning',
              'sunday_afternoon']),
      ('judge', 'preferredCategories', 'choices', true, null, null, null, 5,
        array['ai_ml', 'hardware', 'health', 'sustainability', 'education', 'fintech', 'social_impact',
              'developer_tools', 'entertainment', 'beginner_friendly']),
      ('judge', 'conflictsOfInterest', 'text', false, 1000, null, null, null, null),
      ('judge', 'evaluationApproach', 'text', true, 1500, null, null, null, null),
      ('judge', 'motivation', 'text', true, 1500, null, null, null, null),
      ('judge', 'codeOfConductAccepted', 'accepted', true, null, null, null, null, null)
  ) as r (application_type, field_key, field_kind, is_required, max_length, min_value, max_value, max_items, options)
  where r.application_type = p_type::text
  order by r.field_key;
$$;

comment on function private.application_field_rules(public.application_type) is
  'Response field rules per application type. Kept in sync with Zod by an integration drift test.';

-- True when responses satisfy the draft contract (p_submitted = false) or the complete
-- submission contract (p_submitted = true). Unknown keys are always rejected; the Server
-- Actions drop them before writing.
create function private.application_responses_valid(
  p_type public.application_type,
  p_responses jsonb,
  p_submitted boolean
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  rule record;
  answer jsonb;
  item jsonb;
  item_count integer;
  text_value text;
  number_value numeric;
begin
  if p_type is null or p_submitted is null or p_responses is null or jsonb_typeof(p_responses) <> 'object' then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_responses) as response_key
    where not exists (
      select 1
      from private.application_field_rules(p_type) as known
      where known.field_key = response_key
    )
  ) then
    return false;
  end if;

  for rule in
    select *
    from private.application_field_rules(p_type)
  loop
    answer := p_responses -> rule.field_key;

    if answer is null then
      if p_submitted and rule.is_required then
        return false;
      end if;
      continue;
    end if;

    -- Drafts use null for "no answer"; a submission omits optional answers instead.
    if jsonb_typeof(answer) = 'null' then
      if p_submitted then
        return false;
      end if;
      continue;
    end if;

    case rule.field_kind
      when 'text' then
        if jsonb_typeof(answer) <> 'string' then
          return false;
        end if;
        text_value := private.trim_js_whitespace(answer #>> '{}');
        if char_length(text_value) > rule.max_length then
          return false;
        end if;
        if p_submitted and rule.is_required and text_value = '' then
          return false;
        end if;

      when 'integer' then
        if jsonb_typeof(answer) <> 'number' then
          return false;
        end if;
        number_value := (answer #>> '{}')::numeric;
        if number_value <> trunc(number_value)
          or number_value < rule.min_value
          or number_value > rule.max_value then
          return false;
        end if;

      when 'choice' then
        if jsonb_typeof(answer) <> 'string' or not ((answer #>> '{}') = any (rule.options)) then
          return false;
        end if;

      when 'choices' then
        if jsonb_typeof(answer) <> 'array' then
          return false;
        end if;
        item_count := jsonb_array_length(answer);
        if item_count > rule.max_items or (p_submitted and item_count = 0) then
          return false;
        end if;
        if exists (
          select 1
          from jsonb_array_elements(answer) as element (value)
          where jsonb_typeof(element.value) <> 'string'
            or not ((element.value #>> '{}') = any (rule.options))
        ) then
          return false;
        end if;
        if (select count(distinct element.value) from jsonb_array_elements(answer) as element (value)) <> item_count then
          return false;
        end if;

      when 'links' then
        if jsonb_typeof(answer) <> 'array' or jsonb_array_length(answer) > rule.max_items then
          return false;
        end if;
        for item in
          select element.value
          from jsonb_array_elements(answer) as element (value)
        loop
          if jsonb_typeof(item) <> 'string' then
            return false;
          end if;
          if p_submitted then
            if char_length(item #>> '{}') > rule.max_length
              or (item #>> '{}') !~ private.http_link_pattern() then
              return false;
            end if;
          elsif char_length(private.trim_js_whitespace(item #>> '{}')) > rule.max_length then
            return false;
          end if;
        end loop;

      when 'accepted' then
        if p_submitted then
          if answer <> 'true'::jsonb then
            return false;
          end if;
        elsif jsonb_typeof(answer) <> 'boolean' then
          return false;
        end if;

      else
        return false;
    end case;
  end loop;

  return true;
end;
$$;

comment on function private.application_responses_valid(public.application_type, jsonb, boolean) is
  'True when responses satisfy the draft (p_submitted = false) or submission (true) contract of lib/validation/application.ts.';

-- Rubric dimension keys per application type. Mirrors lib/validation/review.ts.
create function private.rubric_dimensions(p_type public.application_type)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'hacker' then array['motivation', 'initiative', 'growth', 'community']
    when 'judge' then array['expertise', 'evaluation', 'motivation', 'availability']
  end;
$$;

comment on function private.rubric_dimensions(public.application_type) is
  'Rubric dimension keys per application type. Kept in sync with Zod by an integration drift test.';

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  account_role public.account_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 80)
);

comment on table public.profiles is 'One row per auth user. Created only by the auth.users signup trigger.';
comment on column public.profiles.email is
  'Copied from auth.users by trigger so organizers can search applicants. Not client-writable.';
comment on column public.profiles.account_role is
  'hacker | judge from validated signup; organizer only through admin SQL (private.promote_to_organizer).';

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  reference_number bigint generated always as identity (start with 1001) unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_type public.application_type not null,
  responses jsonb not null default '{}'::jsonb,
  completion_percent integer not null default 0,
  status public.application_status not null default 'draft',
  launched_at timestamptz,
  review_started_at timestamptz,
  decision_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_one_per_user unique (user_id),
  constraint applications_completion_percent_range
    check (completion_percent between 0 and 100),
  constraint applications_responses_is_object
    check (jsonb_typeof(responses) = 'object'),
  constraint applications_responses_size
    check (octet_length(responses::text) <= 32768),
  constraint applications_status_timestamps check (
    case status
      when 'draft' then
        launched_at is null and review_started_at is null and decision_released_at is null
      when 'submitted' then
        launched_at is not null and review_started_at is null and decision_released_at is null
      when 'in_review' then
        launched_at is not null and review_started_at is not null and decision_released_at is null
      else
        launched_at is not null and review_started_at is not null and decision_released_at is not null
    end
  ),
  constraint applications_timestamp_order check (
    (review_started_at is null or review_started_at >= launched_at)
    and (decision_released_at is null or decision_released_at >= review_started_at)
  ),
  constraint applications_draft_responses_valid check (
    status <> 'draft'
    or private.application_responses_valid(application_type, responses, false)
  ),
  constraint applications_submitted_responses_complete check (
    status = 'draft'
    or (completion_percent = 100 and private.application_responses_valid(application_type, responses, true))
  )
);

comment on table public.applications is
  'Exactly one application per Hacker or Judge account. Responses are role-specific JSONB; workflow metadata is relational.';
comment on column public.applications.reference_number is
  'Stable non-identifying number for blind review labels such as H-1042.';
comment on column public.applications.responses is
  'Role-specific answers. CHECK constraints enforce the draft or submission contract of lib/validation/application.ts.';
comment on column public.applications.completion_percent is
  'Convenience value computed from the Zod schema by the server. Always 100 once submitted.';
comment on column public.applications.launched_at is 'Set by the database when a valid draft is submitted.';
comment on column public.applications.review_started_at is 'Set by the database when the first organizer review is saved.';
comment on column public.applications.decision_released_at is 'Set by the database when Accepted or Waitlisted is released.';

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  rubric_scores jsonb not null default '{}'::jsonb,
  overall_score numeric(3, 2),
  notes text not null default '',
  recommendation public.recommendation,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_one_per_application unique (application_id),
  constraint reviews_rubric_scores_is_object
    check (jsonb_typeof(rubric_scores) = 'object'),
  constraint reviews_overall_score_range
    check (overall_score is null or overall_score between 1 and 5),
  constraint reviews_notes_length
    check (char_length(notes) <= 5000),
  constraint reviews_completed_is_complete
    check (completed_at is null or (overall_score is not null and recommendation is not null))
);

comment on table public.reviews is
  'One organizer review per application (multi-reviewer assignment is intentionally deferred).';
comment on column public.reviews.rubric_scores is 'Role-specific integer scores 1-5 keyed by rubric dimension.';
comment on column public.reviews.overall_score is 'Average of all rubric dimensions, computed by the database once every dimension is scored.';
comment on column public.reviews.notes is 'Private organizer notes. Never readable by applicants.';
comment on column public.reviews.completed_at is 'Null while the review is a draft; set by the database when completed.';

-- ---------------------------------------------------------------------------
-- Indexes
-- applications(user_id) and reviews(application_id) are already covered by their
-- unique constraints, so no duplicate indexes are created for them.
-- The plan's (status, application_type, submitted_at) index maps to launched_at.
-- ---------------------------------------------------------------------------

create index applications_review_queue_idx
  on public.applications (status, application_type, launched_at);

create index reviews_reviewer_completed_idx
  on public.reviews (reviewer_id, completed_at);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function private.set_updated_at();

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Deny by default until policies and grants are added.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.reviews enable row level security;

revoke all on table public.profiles, public.applications, public.reviews from anon, authenticated;

revoke all on function private.trim_js_whitespace(text) from public;
revoke all on function private.http_link_pattern() from public;
revoke all on function private.application_field_rules(public.application_type) from public;
revoke all on function private.application_responses_valid(public.application_type, jsonb, boolean) from public;
revoke all on function private.rubric_dimensions(public.application_type) from public;
revoke all on function private.set_updated_at() from public;
