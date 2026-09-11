-- =============================================================================
-- Restrict Supabase's automatic RLS function
--
-- Supabase's automatic RLS option adds public.rls_auto_enable(), the SECURITY DEFINER function that the ensure_rls
-- event trigger runs after DDL. New functions in public are executable by the Data API roles by default, so the
-- security advisor reports it as callable by anon and authenticated (lints 0028 and 0029). A direct call only errors,
-- because it is an event trigger function, and no client needs it. Triggers do not check EXECUTE when they fire, so
-- automatic RLS keeps working.
--
-- Local stacks and projects without automatic RLS have no such function, and this migration does nothing there.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
