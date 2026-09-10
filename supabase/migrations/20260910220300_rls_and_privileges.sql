-- =============================================================================
-- Row Level Security policies and Data API privileges
--
-- Three layers protect every write:
--   1. Column-level GRANTs limit which columns a client may name in INSERT/UPDATE.
--   2. RLS policies limit which rows a client may read or write.
--   3. Guard triggers (previous migration) enforce transitions and server timestamps.
-- anon has no table access at all. service_role keeps Supabase defaults for admin use
-- and is never used by the web application.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Schema and helper function access
-- ---------------------------------------------------------------------------

grant usage on schema private to authenticated, service_role;

grant execute on function private.is_organizer() to authenticated, service_role;
grant execute on function private.current_account_role() to authenticated, service_role;
-- Called from CHECK constraints and guard triggers, which run as the writing role.
grant execute on function private.application_response_requirements(public.application_type) to authenticated, service_role;
grant execute on function private.application_responses_complete(public.application_type, jsonb) to authenticated, service_role;
grant execute on function private.rubric_dimensions(public.application_type) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Table privileges (all client access is through the authenticated role)
-- ---------------------------------------------------------------------------

revoke all on table public.profiles, public.applications, public.reviews from anon, authenticated;

grant select on table public.profiles, public.applications, public.reviews to authenticated;

grant update (display_name) on table public.profiles to authenticated;

grant insert (user_id, application_type, responses, completion_percent)
  on table public.applications to authenticated;
grant update (responses, completion_percent, status)
  on table public.applications to authenticated;

grant insert (application_id, reviewer_id, rubric_scores, notes, recommendation, completed_at)
  on table public.reviews to authenticated;
grant update (rubric_scores, notes, recommendation, completed_at)
  on table public.reviews to authenticated;

-- Identity values are generated without sequence privileges, so clients need none.
revoke all on sequence public.applications_reference_number_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_own_or_organizer
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_organizer())
  );

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------

create policy applications_select_own_or_organizer
  on public.applications
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_organizer())
  );

create policy applications_insert_own_draft
  on public.applications
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'draft'
    and application_type::text = (select private.current_account_role())::text
  );

-- One UPDATE policy with two branches (equivalent to two permissive policies,
-- without the multiple_permissive_policies performance lint):
--   applicant branch: own row, existing status draft, may stay draft or become submitted
--   organizer branch: submitted/in_review rows may move to in_review/accepted/waitlisted
-- The guard trigger additionally pins which columns each branch may change.
create policy applications_update_own_draft_or_organizer_workflow
  on public.applications
  for update
  to authenticated
  using (
    (user_id = (select auth.uid()) and status = 'draft')
    or ((select private.is_organizer()) and status in ('submitted', 'in_review'))
  )
  with check (
    (user_id = (select auth.uid()) and status in ('draft', 'submitted'))
    or ((select private.is_organizer()) and status in ('in_review', 'accepted', 'waitlisted'))
  );

-- ---------------------------------------------------------------------------
-- reviews (organizers only; applicants have no access)
-- ---------------------------------------------------------------------------

create policy reviews_select_organizer
  on public.reviews
  for select
  to authenticated
  using ((select private.is_organizer()));

create policy reviews_insert_own_as_organizer
  on public.reviews
  for insert
  to authenticated
  with check (
    (select private.is_organizer())
    and reviewer_id = (select auth.uid())
  );

create policy reviews_update_own_as_organizer
  on public.reviews
  for update
  to authenticated
  using (
    (select private.is_organizer())
    and reviewer_id = (select auth.uid())
  )
  with check (
    (select private.is_organizer())
    and reviewer_id = (select auth.uid())
  );
