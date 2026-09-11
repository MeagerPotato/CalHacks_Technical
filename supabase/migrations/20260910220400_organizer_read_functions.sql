-- =============================================================================
-- Organizer read functions
--
-- SECURITY INVOKER functions exposed through the Data API for organizer dashboards,
-- filtered listing, and the review queue. They run with the caller's privileges, so
-- RLS still applies, and they refuse non-organizers explicitly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Dashboard KPIs (single row)
-- ---------------------------------------------------------------------------

create function public.get_organizer_overview()
returns table (
  total_applications bigint,
  draft_count bigint,
  submitted_count bigint,
  awaiting_review_count bigint,
  in_review_count bigint,
  needs_review_count bigint,
  reviews_completed_count bigint,
  ready_for_decision_count bigint,
  accepted_count bigint,
  waitlisted_count bigint,
  decisions_made_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_organizer() then
    raise exception 'Organizer access required'
      using errcode = '42501', hint = 'forbidden';
  end if;

  return query
  select
    count(*) as total_applications,
    count(*) filter (where a.status = 'draft') as draft_count,
    count(*) filter (where a.status <> 'draft') as submitted_count,
    count(*) filter (where a.status = 'submitted') as awaiting_review_count,
    count(*) filter (where a.status = 'in_review') as in_review_count,
    count(*) filter (
      where a.status in ('submitted', 'in_review') and r.completed_at is null
    ) as needs_review_count,
    count(*) filter (where r.completed_at is not null) as reviews_completed_count,
    count(*) filter (
      where a.status = 'in_review' and r.completed_at is not null
    ) as ready_for_decision_count,
    count(*) filter (where a.status = 'accepted') as accepted_count,
    count(*) filter (where a.status = 'waitlisted') as waitlisted_count,
    count(*) filter (where a.status in ('accepted', 'waitlisted')) as decisions_made_count
  from public.applications a
  left join public.reviews r on r.application_id = a.id;
end;
$$;

comment on function public.get_organizer_overview() is
  'Organizer-only KPI counts for Mission Control and review queue progress.';

-- ---------------------------------------------------------------------------
-- Application type x status breakdown
-- ---------------------------------------------------------------------------

create function public.get_application_status_breakdown()
returns table (
  application_type public.application_type,
  status public.application_status,
  application_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_organizer() then
    raise exception 'Organizer access required'
      using errcode = '42501', hint = 'forbidden';
  end if;

  return query
  select a.application_type, a.status, count(*) as application_count
  from public.applications a
  group by a.application_type, a.status
  order by a.application_type, a.status;
end;
$$;

comment on function public.get_application_status_breakdown() is
  'Organizer-only counts grouped by application type and status. Missing combinations mean zero.';

-- ---------------------------------------------------------------------------
-- Expertise Radar data: expertise tags across submitted Judge applications
-- ---------------------------------------------------------------------------

create function public.get_judge_expertise_counts()
returns table (
  expertise text,
  judge_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_organizer() then
    raise exception 'Organizer access required'
      using errcode = '42501', hint = 'forbidden';
  end if;

  return query
  select tag.value as expertise, count(distinct a.id) as judge_count
  from public.applications a
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(a.responses -> 'expertiseAreas') = 'array' then a.responses -> 'expertiseAreas'
      else '[]'::jsonb
    end
  ) as tag (value)
  where a.application_type = 'judge'
    and a.status <> 'draft'
    -- Only the known areas are counted, so the result has at most one row per area.
    and tag.value in (
      select unnest(rule.options)
      from private.application_field_rules('judge') as rule
      where rule.field_key = 'expertiseAreas'
    )
  group by tag.value
  order by judge_count desc, expertise;
end;
$$;

comment on function public.get_judge_expertise_counts() is
  'Organizer-only counts of known expertise areas across non-draft Judge applications. Areas with zero judges are omitted.';

-- ---------------------------------------------------------------------------
-- Filtered, searchable, sortable application list
-- ---------------------------------------------------------------------------

create function public.list_review_applications(
  p_search text default null,
  p_application_type public.application_type default null,
  p_status public.application_status default null,
  p_review_state text default null,
  p_sort text default 'submitted_desc',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  reference_number bigint,
  application_type public.application_type,
  status public.application_status,
  applicant_name text,
  applicant_email text,
  affiliation text,
  launched_at timestamptz,
  review_started_at timestamptz,
  decision_released_at timestamptz,
  review_id uuid,
  reviewer_id uuid,
  overall_score numeric,
  recommendation public.recommendation,
  review_completed_at timestamptz,
  total_count bigint
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  search_pattern text;
begin
  if not private.is_organizer() then
    raise exception 'Organizer access required'
      using errcode = '42501', hint = 'forbidden';
  end if;

  if p_review_state is not null and p_review_state not in ('reviewed', 'unreviewed') then
    raise exception 'Invalid review state filter: %', p_review_state
      using errcode = '22023', hint = 'invalid_filter';
  end if;

  if coalesce(p_sort, 'submitted_desc') not in ('submitted_desc', 'submitted_asc', 'score_desc', 'score_asc') then
    raise exception 'Invalid sort: %', p_sort
      using errcode = '22023', hint = 'invalid_filter';
  end if;

  if nullif(btrim(coalesce(p_search, '')), '') is not null then
    search_pattern := '%'
      || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_')
      || '%';
  end if;

  return query
  select
    a.id,
    a.reference_number,
    a.application_type,
    a.status,
    coalesce(nullif(btrim(a.responses ->> 'preferredName'), ''), p.display_name, '') as applicant_name,
    p.email as applicant_email,
    nullif(
      btrim(
        case a.application_type
          when 'hacker' then coalesce(a.responses ->> 'school', '')
          else coalesce(a.responses ->> 'company', '')
        end
      ),
      ''
    ) as affiliation,
    a.launched_at,
    a.review_started_at,
    a.decision_released_at,
    r.id as review_id,
    r.reviewer_id,
    r.overall_score,
    r.recommendation,
    r.completed_at as review_completed_at,
    count(*) over () as total_count
  from public.applications a
  join public.profiles p on p.id = a.user_id
  left join public.reviews r on r.application_id = a.id
  where
    (case when p_status is null then a.status <> 'draft' else a.status = p_status end)
    and (p_application_type is null or a.application_type = p_application_type)
    and (
      p_review_state is null
      or (p_review_state = 'reviewed' and r.completed_at is not null)
      or (p_review_state = 'unreviewed' and r.completed_at is null)
    )
    and (
      search_pattern is null
      or coalesce(a.responses ->> 'preferredName', '') ilike search_pattern
      or coalesce(p.display_name, '') ilike search_pattern
      or p.email ilike search_pattern
      or coalesce(a.responses ->> 'school', '') ilike search_pattern
      or coalesce(a.responses ->> 'company', '') ilike search_pattern
      or (case a.application_type when 'hacker' then 'H-' else 'J-' end || a.reference_number::text)
        ilike search_pattern
    )
  order by
    case when p_sort = 'score_desc' then r.overall_score end desc nulls last,
    case when p_sort = 'score_asc' then r.overall_score end asc nulls last,
    case when p_sort = 'submitted_asc' then a.launched_at end asc nulls last,
    a.launched_at desc nulls last,
    a.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.list_review_applications(text, public.application_type, public.application_status, text, text, integer, integer) is
  'Organizer-only application list. Drafts are excluded unless p_status = draft. p_review_state: reviewed | unreviewed. p_sort: submitted_desc | submitted_asc | score_desc | score_asc.';

-- ---------------------------------------------------------------------------
-- Mission Review Queue: next unreviewed application
-- ---------------------------------------------------------------------------

create function public.get_next_unreviewed_application_id(p_after_id uuid default null)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  after_launched_at timestamptz;
  next_id uuid;
begin
  if not private.is_organizer() then
    raise exception 'Organizer access required'
      using errcode = '42501', hint = 'forbidden';
  end if;

  if p_after_id is not null then
    select a.launched_at
    into after_launched_at
    from public.applications a
    where a.id = p_after_id;
  end if;

  -- Oldest submission first. Applications already reviewed, or with a draft review by a
  -- different organizer, are skipped. With p_after_id the search continues after that
  -- application in queue order and wraps around to the start.
  select a.id
  into next_id
  from public.applications a
  left join public.reviews r on r.application_id = a.id
  where a.status in ('submitted', 'in_review')
    and (
      r.id is null
      or (r.completed_at is null and r.reviewer_id = (select auth.uid()))
    )
    and (p_after_id is null or a.id <> p_after_id)
  order by
    case
      when after_launched_at is null then 0
      when (a.launched_at, a.id) > (after_launched_at, p_after_id) then 0
      else 1
    end,
    a.launched_at,
    a.id
  limit 1;

  return next_id;
end;
$$;

comment on function public.get_next_unreviewed_application_id(uuid) is
  'Organizer-only: id of the next application needing review (oldest first), optionally after a given application. Null when the queue is empty.';

-- ---------------------------------------------------------------------------
-- Execute privileges: revoked from PUBLIC and anon, granted to authenticated.
-- service_role keeps Supabase's default EXECUTE; every call still refuses non-organizers.
-- ---------------------------------------------------------------------------

revoke all on function public.get_organizer_overview() from public, anon;
revoke all on function public.get_application_status_breakdown() from public, anon;
revoke all on function public.get_judge_expertise_counts() from public, anon;
revoke all on function public.list_review_applications(text, public.application_type, public.application_status, text, text, integer, integer) from public, anon;
revoke all on function public.get_next_unreviewed_application_id(uuid) from public, anon;

grant execute on function public.get_organizer_overview() to authenticated;
grant execute on function public.get_application_status_breakdown() to authenticated;
grant execute on function public.get_judge_expertise_counts() to authenticated;
grant execute on function public.list_review_applications(text, public.application_type, public.application_status, text, text, integer, integer) to authenticated;
grant execute on function public.get_next_unreviewed_application_id(uuid) to authenticated;
