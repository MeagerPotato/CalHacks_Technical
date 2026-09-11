-- =============================================================================
-- Round 2: one account may hold a Hacker and a Judge application
--
-- profiles.application_types lists the applications an account applies for, chosen at signup: Hacker, Judge, or
-- both, always in enum order. account_role stays the authorization role: organizer for organizers, otherwise the
-- first application type. An account holds at most one application of each type.
--
-- Signup metadata:
--   application_types  JSON array of 1-2 distinct values from hacker and judge. Anything else aborts the signup.
--   account_role       Legacy single-type request, used only when application_types is absent. Blank starts a
--                      hacker account; any value other than hacker or judge still aborts the signup.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles.application_types
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column application_types public.application_type[] not null default '{}';

update public.profiles
set application_types = array[account_role::text::public.application_type]
where account_role in ('hacker', 'judge');

-- Applicants apply for one or two distinct types in enum order, and account_role is the first. Organizers apply for
-- none.
create function private.application_types_valid(
  p_account_role public.account_role,
  p_application_types public.application_type[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_account_role is null or p_application_types is null then false
    when p_account_role = 'organizer' then cardinality(p_application_types) = 0
    when array_ndims(p_application_types) is distinct from 1 or array_lower(p_application_types, 1) <> 1 then false
    when cardinality(p_application_types) = 1 then
      p_application_types[1] is not null and p_application_types[1]::text = p_account_role::text
    when cardinality(p_application_types) = 2 then
      p_application_types[1] = 'hacker' and p_application_types[2] = 'judge' and p_account_role = 'hacker'
    else false
  end;
$$;

comment on function private.application_types_valid(public.account_role, public.application_type[]) is
  'True when application_types fits the account role: 1-2 distinct types in enum order led by account_role, or none for organizers.';

alter table public.profiles
  add constraint profiles_application_types_valid
  check (private.application_types_valid(account_role, application_types));

comment on column public.profiles.account_role is
  'organizer only through admin SQL (private.promote_to_organizer); otherwise the first of application_types.';
comment on column public.profiles.application_types is
  'Applications this account applies for, chosen at signup (hacker, judge, or both). Not client-writable.';

-- ---------------------------------------------------------------------------
-- Signup
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata constant jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_role text := lower(btrim(coalesce(metadata ->> 'account_role', '')));
  requested_name text := btrim(coalesce(metadata ->> 'display_name', ''));
  requested_types jsonb := metadata -> 'application_types';
  granted_types public.application_type[];
begin
  -- Explicit requests for anything other than hacker or judge abort the auth.users insert.
  if requested_role <> '' and requested_role not in ('hacker', 'judge') then
    raise exception 'Public signup can only create hacker or judge accounts'
      using errcode = '42501', hint = 'invalid_account_role';
  end if;

  if requested_types is not null and jsonb_typeof(requested_types) <> 'null' then
    if jsonb_typeof(requested_types) <> 'array'
      or jsonb_array_length(requested_types) not between 1 and 2
      or exists (
        select 1
        from jsonb_array_elements(requested_types) as element (value)
        where jsonb_typeof(element.value) <> 'string'
          or (element.value #>> '{}') not in ('hacker', 'judge')
      )
      or (select count(distinct element.value) from jsonb_array_elements(requested_types) as element (value))
        <> jsonb_array_length(requested_types) then
      raise exception 'Public signup can only apply for Hacker and Judge applications'
        using errcode = '42501', hint = 'invalid_application_types';
    end if;

    select array_agg(requested.application_type order by requested.application_type)
    into granted_types
    from (
      select (element.value #>> '{}')::public.application_type as application_type
      from jsonb_array_elements(requested_types) as element (value)
    ) as requested;
  else
    -- Users created without metadata (for example from the Supabase dashboard) start as hackers.
    granted_types := array[coalesce(nullif(requested_role, ''), 'hacker')::public.application_type];
  end if;

  insert into public.profiles (id, email, display_name, account_role, application_types)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(requested_name, 80), ''),
    granted_types[1]::text::public.account_role,
    granted_types
  );

  return new;
end;
$$;

comment on function private.handle_new_auth_user() is
  'Creates the public profile for a new auth user. Only Hacker and Judge applications may be requested.';

-- ---------------------------------------------------------------------------
-- Profile writes: clients still change only display_name. Admin changes to the role or application types must keep
-- every existing application.
-- ---------------------------------------------------------------------------

create or replace function private.guard_profile_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      raise exception 'Profiles are created by signup'
        using errcode = '42501', hint = 'forbidden';
    end if;

    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.account_role is distinct from old.account_role
      or new.application_types is distinct from old.application_types
      or new.created_at is distinct from old.created_at then
      raise exception 'Only the display name can be changed'
        using errcode = '42501', hint = 'forbidden';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.account_role is distinct from old.account_role
      or new.application_types is distinct from old.application_types then
      if exists (
        select 1
        from public.applications a
        where a.user_id = new.id
          and not (a.application_type = any (new.application_types))
      ) then
        raise exception 'Application types must include every existing application'
          using errcode = '23514', hint = 'role_application_mismatch';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.promote_to_organizer(p_email text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target_id uuid;
begin
  select p.id
  into target_id
  from public.profiles p
  where p.email = lower(btrim(p_email));

  if target_id is null then
    raise exception 'No profile exists for email %', p_email
      using errcode = 'P0002', hint = 'profile_not_found';
  end if;

  if exists (select 1 from public.applications a where a.user_id = target_id) then
    raise exception 'Accounts that own an application cannot become organizers'
      using errcode = '23514', hint = 'role_application_mismatch';
  end if;

  update public.profiles
  set account_role = 'organizer',
      application_types = '{}'
  where id = target_id;

  return target_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create function private.current_application_types()
returns public.application_type[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.application_types from public.profiles p where p.id = (select auth.uid())),
    '{}'::public.application_type[]
  );
$$;

comment on function private.current_application_types() is
  'Application types of the current JWT subject; empty when signed out or an organizer.';

create or replace function private.guard_application_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  client_request constant boolean := current_user in ('anon', 'authenticated');
  actor_id constant uuid := auth.uid();
  owner_types public.application_type[];
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

    select p.application_types
    into owner_types
    from public.profiles p
    where p.id = new.user_id;

    if owner_types is null or not (new.application_type = any (owner_types)) then
      raise exception 'Application type must be one the owner account applies for'
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
      select p.application_types
      into owner_types
      from public.profiles p
      where p.id = new.user_id;

      if owner_types is null or not (new.application_type = any (owner_types)) then
        raise exception 'Application type must be one the owner account applies for'
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

drop policy applications_insert_own_draft on public.applications;

create policy applications_insert_own_draft
  on public.applications
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'draft'
    and application_type = any (private.current_application_types())
  );

alter table public.applications drop constraint applications_one_per_user;

-- Also serves lookups by user_id, the leading column.
alter table public.applications
  add constraint applications_one_per_type unique (user_id, application_type);

comment on table public.applications is
  'At most one Hacker and one Judge application per account. Responses are type-specific JSONB; workflow metadata is relational.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function private.application_types_valid(public.account_role, public.application_type[]) from public, anon;
revoke all on function private.current_application_types() from public, anon;
-- The profiles CHECK constraint runs as the writing role, and the insert policy calls current_application_types.
grant execute on function private.application_types_valid(public.account_role, public.application_type[]) to authenticated, service_role;
grant execute on function private.current_application_types() to authenticated, service_role;
