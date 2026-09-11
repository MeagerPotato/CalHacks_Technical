-- =============================================================================
-- Workflow guards
--
-- Authorization helpers plus triggers that enforce the application state machine
-- and set workflow timestamps on the server for every writer.
--
-- Client requests (Data API roles anon/authenticated) get the strict rules below.
-- Trusted admin SQL (postgres, service_role) may backfill historical data but must
-- still satisfy every CHECK constraint on the tables.
--
--   draft --(applicant submits, responses complete)--> submitted       sets launched_at
--   submitted --(first organizer review saved)------> in_review        sets review_started_at
--   in_review --(organizer, review completed)-------> accepted | waitlisted  sets decision_released_at
--
-- Decisions are final. Applicants cannot unsubmit or change status after submission.
-- =============================================================================

create function private.is_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_role = 'organizer'
  );
$$;

comment on function private.is_organizer() is
  'True when the current JWT subject has the organizer role. SECURITY DEFINER to avoid RLS recursion.';

create function private.current_account_role()
returns public.account_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.account_role
  from public.profiles p
  where p.id = (select auth.uid());
$$;

comment on function private.current_account_role() is
  'Account role of the current JWT subject, or null when signed out.';

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create function private.guard_application_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  client_request constant boolean := current_user in ('anon', 'authenticated');
  actor_id constant uuid := auth.uid();
  owner_role public.account_role;
begin
  if tg_op = 'INSERT' then
    if client_request then
      if actor_id is null or new.user_id is distinct from actor_id then
        raise exception 'Applications can only be created for the signed-in user'
          using errcode = '42501', hint = 'forbidden';
      end if;

      new.status := 'draft';
      new.launched_at := null;
      new.review_started_at := null;
      new.decision_released_at := null;
    end if;

    select p.account_role
    into owner_role
    from public.profiles p
    where p.id = new.user_id;

    if owner_role is null or owner_role::text <> new.application_type::text then
      raise exception 'Application type must match the owner account role'
        using errcode = '23514', hint = 'application_type_mismatch';
    end if;

    if not client_request then
      if new.status <> 'draft' and new.launched_at is null then
        new.launched_at := now();
      end if;
      if new.status in ('in_review', 'accepted', 'waitlisted') and new.review_started_at is null then
        new.review_started_at := now();
      end if;
      if new.status in ('accepted', 'waitlisted') and new.decision_released_at is null then
        new.decision_released_at := now();
      end if;
    end if;

    return new;
  end if;

  -- UPDATE
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Application identifiers are immutable'
      using errcode = '42501', hint = 'forbidden';
  end if;

  if not client_request then
    if new.user_id is distinct from old.user_id
      or new.application_type is distinct from old.application_type then
      select p.account_role
      into owner_role
      from public.profiles p
      where p.id = new.user_id;

      if owner_role is null or owner_role::text <> new.application_type::text then
        raise exception 'Application type must match the owner account role'
          using errcode = '23514', hint = 'application_type_mismatch';
      end if;
    end if;

    if new.status <> 'draft' and new.launched_at is null then
      new.launched_at := now();
    end if;
    if new.status in ('in_review', 'accepted', 'waitlisted') and new.review_started_at is null then
      new.review_started_at := now();
    end if;
    if new.status in ('accepted', 'waitlisted') and new.decision_released_at is null then
      new.decision_released_at := now();
    end if;

    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.application_type is distinct from old.application_type then
    raise exception 'Application owner and type cannot be changed'
      using errcode = '42501', hint = 'forbidden';
  end if;

  -- Applicant editing or submitting their own application.
  if actor_id is not null and actor_id = old.user_id then
    if old.status <> 'draft' then
      raise exception 'Submitted applications can no longer be edited'
        using errcode = '42501', hint = 'application_locked';
    end if;

    new.review_started_at := null;
    new.decision_released_at := null;

    if new.status = 'draft' then
      new.launched_at := null;
    elsif new.status = 'submitted' then
      new.launched_at := now();
      new.completion_percent := 100;
    else
      raise exception 'Applicants can only save or submit their own application'
        using errcode = '42501', hint = 'invalid_status_transition';
    end if;

    return new;
  end if;

  -- Organizer moving an application through review and decision.
  if private.is_organizer() then
    if new.responses is distinct from old.responses
      or new.completion_percent is distinct from old.completion_percent
      or new.launched_at is distinct from old.launched_at then
      raise exception 'Organizers cannot change applicant responses'
        using errcode = '42501', hint = 'forbidden';
    end if;

    new.review_started_at := old.review_started_at;
    new.decision_released_at := old.decision_released_at;

    if new.status = old.status then
      return new;
    end if;

    if old.status = 'submitted' and new.status = 'in_review' then
      new.review_started_at := now();
    elsif old.status in ('submitted', 'in_review') and new.status in ('accepted', 'waitlisted') then
      if not exists (
        select 1
        from public.reviews r
        where r.application_id = old.id
          and r.completed_at is not null
      ) then
        raise exception 'Complete the review before releasing a decision'
          using errcode = '23514', hint = 'review_not_completed';
      end if;
      -- Saving a review normally moved the application into review already.
      new.review_started_at := coalesce(old.review_started_at, now());
      new.decision_released_at := now();
    else
      raise exception 'Invalid status change from % to %', old.status, new.status
        using errcode = '23514', hint = 'invalid_status_transition';
    end if;

    return new;
  end if;

  raise exception 'Not allowed to update this application'
    using errcode = '42501', hint = 'forbidden';
end;
$$;

comment on function private.guard_application_write() is
  'Enforces application ownership, the status state machine, and server-set workflow timestamps.';

create trigger applications_guard_write
  before insert or update on public.applications
  for each row execute function private.guard_application_write();

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create function private.guard_review_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  client_request constant boolean := current_user in ('anon', 'authenticated');
  actor_id constant uuid := auth.uid();
  target_type public.application_type;
  target_status public.application_status;
  dimensions text[];
  dimension text;
  score jsonb;
  score_total numeric := 0;
  scored_count integer := 0;
begin
  if client_request then
    if actor_id is null or not private.is_organizer() then
      raise exception 'Organizer access required'
        using errcode = '42501', hint = 'forbidden';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if client_request and new.reviewer_id is distinct from actor_id then
      raise exception 'Reviews can only be written by their reviewer'
        using errcode = '42501', hint = 'forbidden';
    end if;
  else
    if new.id is distinct from old.id
      or new.application_id is distinct from old.application_id
      or new.reviewer_id is distinct from old.reviewer_id
      or new.created_at is distinct from old.created_at then
      raise exception 'Review identifiers are immutable'
        using errcode = '42501', hint = 'forbidden';
    end if;
  end if;

  select a.application_type, a.status
  into target_type, target_status
  from public.applications a
  where a.id = new.application_id;

  if target_type is null then
    raise exception 'Application not found'
      using errcode = '23503', hint = 'not_found';
  end if;

  if client_request and target_status not in ('submitted', 'in_review') then
    raise exception 'Reviews can only be edited before a decision is released'
      using errcode = '42501', hint = 'review_locked';
  end if;

  -- Validate rubric scores: known dimensions only, integers 1-5.
  new.rubric_scores := jsonb_strip_nulls(coalesce(new.rubric_scores, '{}'::jsonb));
  dimensions := private.rubric_dimensions(target_type);

  if exists (
    select 1
    from jsonb_object_keys(new.rubric_scores) as score_key
    where not (score_key = any (dimensions))
  ) then
    raise exception 'Unknown rubric dimension for a % application', target_type
      using errcode = '23514', hint = 'invalid_rubric';
  end if;

  foreach dimension in array dimensions loop
    score := new.rubric_scores -> dimension;
    continue when score is null;

    if jsonb_typeof(score) <> 'number' then
      raise exception 'Rubric scores must be integers from 1 to 5'
        using errcode = '23514', hint = 'invalid_rubric';
    end if;

    if (score #>> '{}')::numeric not in (1, 2, 3, 4, 5) then
      raise exception 'Rubric scores must be integers from 1 to 5'
        using errcode = '23514', hint = 'invalid_rubric';
    end if;

    new.rubric_scores := jsonb_set(
      new.rubric_scores,
      array[dimension],
      to_jsonb((score #>> '{}')::numeric::integer)
    );
    score_total := score_total + (score #>> '{}')::numeric;
    scored_count := scored_count + 1;
  end loop;

  if scored_count = cardinality(dimensions) then
    new.overall_score := round(score_total / scored_count, 2);
  else
    new.overall_score := null;
  end if;

  -- completed_at is server-controlled for clients and immutable once set.
  if tg_op = 'UPDATE' then
    if old.completed_at is not null then
      if new.completed_at is null then
        raise exception 'Completed reviews cannot return to draft'
          using errcode = '23514', hint = 'review_already_completed';
      end if;
      new.completed_at := old.completed_at;
    elsif client_request and new.completed_at is not null then
      new.completed_at := now();
    end if;
  elsif client_request and new.completed_at is not null then
    new.completed_at := now();
  end if;

  if new.completed_at is not null
    and (new.overall_score is null or new.recommendation is null) then
    raise exception 'Score every rubric dimension and choose a recommendation before completing the review'
      using errcode = '23514', hint = 'review_incomplete';
  end if;

  return new;
end;
$$;

comment on function private.guard_review_write() is
  'Validates rubric scores per application type, computes overall_score, and locks completed reviews.';

create trigger reviews_guard_write
  before insert or update on public.reviews
  for each row execute function private.guard_review_write();

-- Saving the first review moves a submitted application into review. Runs as the
-- caller so the organizer's RLS policy and the application guard still apply.
create function private.start_application_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.applications
  set status = 'in_review'
  where id = new.application_id
    and status = 'submitted';

  return null;
end;
$$;

create trigger reviews_start_application_review
  after insert or update on public.reviews
  for each row execute function private.start_application_review();

revoke all on function private.is_organizer() from public, anon;
revoke all on function private.current_account_role() from public, anon;
revoke all on function private.guard_application_write() from public, anon, authenticated;
revoke all on function private.guard_review_write() from public, anon, authenticated;
revoke all on function private.start_application_review() from public, anon, authenticated;
