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
-- Validation helpers used by CHECK constraints
-- ---------------------------------------------------------------------------

-- Required response keys per application type and the minimal shape each must have.
-- This mirrors the required fields of the Zod schemas in lib/validation/application.ts;
-- tests/integration/schema-drift.test.ts fails if the two drift apart.
-- Kinds: text = non-blank string, integer = whole number >= 0,
--        list = non-empty array, accepted = JSON true.
create function private.application_response_requirements(p_type public.application_type)
returns table (field_key text, field_kind text)
language sql
immutable
set search_path = ''
as $$
  select r.field_key, r.field_kind
  from (
    values
      ('hacker', 'preferredName', 'text'),
      ('hacker', 'location', 'text'),
      ('hacker', 'bio', 'text'),
      ('hacker', 'school', 'text'),
      ('hacker', 'major', 'text'),
      ('hacker', 'graduationYear', 'integer'),
      ('hacker', 'experienceLevel', 'text'),
      ('hacker', 'skills', 'list'),
      ('hacker', 'previousHackathonCount', 'integer'),
      ('hacker', 'buildGoals', 'text'),
      ('hacker', 'proudProject', 'text'),
      ('hacker', 'codeOfConductAccepted', 'accepted'),
      ('judge', 'preferredName', 'text'),
      ('judge', 'location', 'text'),
      ('judge', 'bio', 'text'),
      ('judge', 'roleTitle', 'text'),
      ('judge', 'yearsExperience', 'integer'),
      ('judge', 'expertiseAreas', 'list'),
      ('judge', 'judgingExperience', 'text'),
      ('judge', 'availability', 'list'),
      ('judge', 'preferredCategories', 'list'),
      ('judge', 'evaluationApproach', 'text'),
      ('judge', 'motivation', 'text'),
      ('judge', 'codeOfConductAccepted', 'accepted')
  ) as r (application_type, field_key, field_kind)
  where r.application_type = p_type::text
  order by r.field_key;
$$;

comment on function private.application_response_requirements(public.application_type) is
  'Required response keys per application type. Kept in sync with Zod by an integration drift test.';

-- Coarse database-side completeness guard for non-draft applications. The Server
-- Action performs full Zod validation first; this guard guarantees the rule still
-- holds for requests that bypass the Next.js server (for example direct Data API calls).
create function private.application_responses_complete(p_type public.application_type, p_responses jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  requirement record;
  answer jsonb;
begin
  if p_type is null or p_responses is null or jsonb_typeof(p_responses) <> 'object' then
    return false;
  end if;

  for requirement in
    select req.field_key, req.field_kind
    from private.application_response_requirements(p_type) as req
  loop
    answer := p_responses -> requirement.field_key;

    if answer is null then
      return false;
    end if;

    if requirement.field_kind = 'text' then
      if jsonb_typeof(answer) <> 'string' then
        return false;
      end if;
      if btrim(answer #>> '{}') = '' then
        return false;
      end if;
    elsif requirement.field_kind = 'integer' then
      if jsonb_typeof(answer) <> 'number' then
        return false;
      end if;
      if (answer #>> '{}')::numeric < 0
        or (answer #>> '{}')::numeric <> trunc((answer #>> '{}')::numeric) then
        return false;
      end if;
    elsif requirement.field_kind = 'list' then
      if jsonb_typeof(answer) <> 'array' then
        return false;
      end if;
      if jsonb_array_length(answer) = 0 then
        return false;
      end if;
    elsif requirement.field_kind = 'accepted' then
      if answer <> 'true'::jsonb then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  return true;
end;
$$;

comment on function private.application_responses_complete(public.application_type, jsonb) is
  'True when every required response key is present with the expected JSON shape.';

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
  constraint applications_submitted_responses_complete check (
    status = 'draft'
    or (completion_percent = 100 and private.application_responses_complete(application_type, responses))
  )
);

comment on table public.applications is
  'Exactly one application per Hacker or Judge account. Responses are role-specific JSONB; workflow metadata is relational.';
comment on column public.applications.reference_number is
  'Stable non-identifying number for blind review labels such as H-1042.';
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

revoke all on function private.application_response_requirements(public.application_type) from public;
revoke all on function private.application_responses_complete(public.application_type, jsonb) from public;
revoke all on function private.rubric_dimensions(public.application_type) from public;
revoke all on function private.set_updated_at() from public;
