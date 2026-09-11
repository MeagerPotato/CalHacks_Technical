-- =============================================================================
-- Auth profile provisioning
--
-- Profiles are created only by a trigger on auth.users. Public signup may request
-- hacker or judge through user metadata; any other requested role aborts the signup.
-- Organizer is granted only by trusted admin SQL through private.promote_to_organizer.
--
-- Authorization never reads auth.users.raw_user_meta_data after signup because users
-- can edit their own metadata; public.profiles.account_role is the source of truth.
-- =============================================================================

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'account_role', '')));
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  -- Users created without metadata (for example from the Supabase dashboard) start as
  -- hackers and can be promoted by an admin. Explicit requests for anything other than
  -- hacker or judge are rejected, which aborts the auth.users insert.
  if requested_role = '' then
    requested_role := 'hacker';
  end if;

  if requested_role not in ('hacker', 'judge') then
    raise exception 'Public signup can only create hacker or judge accounts'
      using errcode = '42501', hint = 'invalid_account_role';
  end if;

  insert into public.profiles (id, email, display_name, account_role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(requested_name, 80), ''),
    requested_role::public.account_role
  );

  return new;
end;
$$;

comment on function private.handle_new_auth_user() is
  'Creates the public profile for a new auth user. Only hacker or judge may be requested.';

create function private.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(new.email, '')
  where id = new.id;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_auth_user_email_change();

-- Profiles: clients may change only display_name (also enforced by column grants).
-- Role changes by admins must stay consistent with any existing application.
create function private.guard_profile_write()
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
      or new.created_at is distinct from old.created_at then
      raise exception 'Only the display name can be changed'
        using errcode = '42501', hint = 'forbidden';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.account_role is distinct from old.account_role then
      if exists (
        select 1
        from public.applications a
        where a.user_id = new.id
          and a.application_type::text <> new.account_role::text
      ) then
        raise exception 'Account role must match the existing application type'
          using errcode = '23514', hint = 'role_application_mismatch';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_write
  before insert or update on public.profiles
  for each row execute function private.guard_profile_write();

-- Admin-only organizer promotion. Run as postgres from the SQL editor, psql, or a
-- trusted script. Not exposed through the Data API and not executable by client roles.
-- Promote only an account the admin just created: with email confirmation disabled,
-- anyone can register any address, so a pre-existing account proves nothing.
create function private.promote_to_organizer(p_email text)
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
  set account_role = 'organizer'
  where id = target_id;

  return target_id;
end;
$$;

comment on function private.promote_to_organizer(text) is
  'Admin-only: grants the organizer role to an existing account that has no application.';

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.handle_auth_user_email_change() from public, anon, authenticated;
revoke all on function private.guard_profile_write() from public, anon, authenticated;
revoke all on function private.promote_to_organizer(text) from public, anon, authenticated, service_role;
