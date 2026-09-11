-- =============================================================================
-- Round 2: shared About you section
--
-- Hacker and Judge applications share one About you section (PROJECT_PLAN.md section 0, Round 2 amendment).
-- In form order:
--   fullName            text          required, at most 120 characters
--   birthdate           date          required, a real calendar date from 1900-01-01 to 2026-09-20
--   countryOfResidence  choice        required, an ISO 3166-1 alpha-2 code from private.country_codes()
--   cityOfResidence     text          required, at most 120 characters
--   linkedinUrl         profile_link  optional, a LinkedIn profile link
--   githubUrl           profile_link  optional, a GitHub profile link
--   devpostUrl          profile_link  optional, a Devpost profile link
--   bio                 text          optional, at most 600 characters
-- preferredName, location, and links are removed from both forms.
--
-- lib/validation/application.ts mirrors every rule; tests/integration/schema-drift.test.ts keeps them in sync.
-- =============================================================================

-- Stop before changing anything when a launched application exists: it could not gain the new required answers,
-- and answers are never rewritten after submission.
do $$
declare
  launched_count bigint;
begin
  select count(*) into launched_count from public.applications where status <> 'draft';
  if launched_count > 0 then
    raise exception 'Cannot replace the About you section while % submitted applications exist', launched_count
      using hint = 'Decide how to handle submitted applications before applying this migration.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Country codes offered for countryOfResidence, in lib/countries.ts order (United States first).
create function private.country_codes()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'US', 'AF', 'AX', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AU',
    'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BA', 'BW',
    'BV', 'BR', 'IO', 'VG', 'BN', 'BG', 'BF', 'BI', 'KH', 'CM', 'CA', 'CV', 'BQ', 'KY', 'CF',
    'TD', 'CL', 'CN', 'CX', 'CC', 'CO', 'KM', 'CG', 'CD', 'CK', 'CR', 'CI', 'HR', 'CU', 'CW',
    'CY', 'CZ', 'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FK',
    'FO', 'FJ', 'FI', 'FR', 'GF', 'PF', 'TF', 'GA', 'GM', 'GE', 'DE', 'GH', 'GI', 'GR', 'GL',
    'GD', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'HN', 'HK', 'HU', 'IS', 'IN',
    'ID', 'IR', 'IQ', 'IE', 'IM', 'IL', 'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KI', 'XK',
    'KW', 'KG', 'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY',
    'MV', 'ML', 'MT', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS',
    'MA', 'MZ', 'MM', 'NA', 'NR', 'NP', 'NL', 'NC', 'NZ', 'NI', 'NE', 'NG', 'NU', 'NF', 'KP',
    'MK', 'MP', 'NO', 'OM', 'PK', 'PW', 'PS', 'PA', 'PG', 'PY', 'PE', 'PH', 'PN', 'PL', 'PT',
    'PR', 'QA', 'RE', 'RO', 'RU', 'RW', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG',
    'SX', 'SK', 'SI', 'SB', 'SO', 'ZA', 'GS', 'KR', 'SS', 'ES', 'LK', 'BL', 'SH', 'KN', 'LC',
    'MF', 'PM', 'VC', 'SD', 'SR', 'SJ', 'SE', 'CH', 'SY', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG',
    'TK', 'TO', 'TT', 'TN', 'TR', 'TM', 'TC', 'TV', 'UM', 'VI', 'UG', 'UA', 'AE', 'GB', 'UY',
    'UZ', 'VU', 'VA', 'VE', 'VN', 'WF', 'EH', 'YE', 'ZM', 'ZW'
  ]::text[];
$$;

comment on function private.country_codes() is
  'ISO 3166-1 alpha-2 codes accepted for countryOfResidence, in lib/countries.ts order. Kept in sync by an integration drift test.';

-- A profile link must point to a profile on its site. lib/validation/application.ts (PROFILE_LINK_PATTERN_SOURCES)
-- uses identical patterns. Null for any other field key.
create function private.profile_link_pattern(p_field_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_field_key
    when 'linkedinUrl' then '^https?://(?:[a-z]{2}\.|www\.)?linkedin\.com/in/[A-Za-z0-9_%-]{3,100}/?$'
    when 'githubUrl' then '^https?://(?:www\.)?github\.com/[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}/?$'
    when 'devpostUrl' then '^https?://(?:www\.)?devpost\.com/[A-Za-z0-9_-]{1,60}/?$'
  end;
$$;

comment on function private.profile_link_pattern(text) is
  'Profile link pattern for a profile link field key, or null. Kept in sync with Zod by an integration drift test.';

-- ---------------------------------------------------------------------------
-- Field rules
-- Kinds, as required for a submitted application (drafts may omit any answer or set it to null):
--   text          string; after trimming, non-empty when required and at most max_length characters
--                 (char_length counts Unicode code points, exactly as Zod 4 measures strings)
--   integer       whole number from min_value to max_value
--   date          string YYYY-MM-DD naming a real calendar date from min_value to max_value (bounds written as
--                 YYYYMMDD integers); checked in drafts too
--   choice        one of options
--   choices       non-empty array of distinct options with at most max_items entries
--   profile_link  string of at most max_length characters matching profile_link_pattern(field_key); checked in
--                 drafts too
--   accepted      JSON true
-- ---------------------------------------------------------------------------

create or replace function private.application_field_rules(p_type public.application_type)
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
      ('hacker', 'fullName', 'text', true, 120, null, null, null, null),
      ('hacker', 'birthdate', 'date', true, null, 19000101, 20260920, null, null),
      ('hacker', 'countryOfResidence', 'choice', true, null, null, null, null, private.country_codes()),
      ('hacker', 'cityOfResidence', 'text', true, 120, null, null, null, null),
      ('hacker', 'linkedinUrl', 'profile_link', false, 300, null, null, null, null),
      ('hacker', 'githubUrl', 'profile_link', false, 300, null, null, null, null),
      ('hacker', 'devpostUrl', 'profile_link', false, 300, null, null, null, null),
      ('hacker', 'bio', 'text', false, 600, null, null, null, null),
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
      ('judge', 'fullName', 'text', true, 120, null, null, null, null),
      ('judge', 'birthdate', 'date', true, null, 19000101, 20260920, null, null),
      ('judge', 'countryOfResidence', 'choice', true, null, null, null, null, private.country_codes()),
      ('judge', 'cityOfResidence', 'text', true, 120, null, null, null, null),
      ('judge', 'linkedinUrl', 'profile_link', false, 300, null, null, null, null),
      ('judge', 'githubUrl', 'profile_link', false, 300, null, null, null, null),
      ('judge', 'devpostUrl', 'profile_link', false, 300, null, null, null, null),
      ('judge', 'bio', 'text', false, 600, null, null, null, null),
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

create or replace function private.application_responses_valid(
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
  item_count integer;
  text_value text;
  number_value numeric;
  year_value integer;
  month_value integer;
  day_value integer;
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

      when 'date' then
        if jsonb_typeof(answer) <> 'string' then
          return false;
        end if;
        text_value := answer #>> '{}';
        if text_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
          return false;
        end if;
        year_value := substr(text_value, 1, 4)::integer;
        month_value := substr(text_value, 6, 2)::integer;
        day_value := substr(text_value, 9, 2)::integer;
        -- Checked before make_date, which raises on a year of zero or a month out of range.
        if year_value < 1 or month_value < 1 or month_value > 12 or day_value < 1 then
          return false;
        end if;
        if day_value > extract(day from (make_date(year_value, month_value, 1) + interval '1 month')::date - 1) then
          return false;
        end if;
        if year_value * 10000 + month_value * 100 + day_value not between rule.min_value and rule.max_value then
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

      when 'profile_link' then
        if jsonb_typeof(answer) <> 'string' then
          return false;
        end if;
        text_value := answer #>> '{}';
        if char_length(text_value) > rule.max_length
          or not coalesce(text_value ~ private.profile_link_pattern(rule.field_key), false) then
          return false;
        end if;

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

-- Relevant links were the only field using the generic link pattern.
drop function private.http_link_pattern();

-- ---------------------------------------------------------------------------
-- Existing drafts
-- Answers that still have a field move to it: preferredName becomes fullName and location becomes cityOfResidence.
-- Relevant links have no equivalent and are dropped. Only drafts holding a removed key are touched.
-- ---------------------------------------------------------------------------

update public.applications as a
set responses = (a.responses - array['preferredName', 'location', 'links'])
  || case
       when jsonb_typeof(a.responses -> 'preferredName') = 'string'
         then jsonb_build_object('fullName', left(a.responses ->> 'preferredName', 120))
       else '{}'::jsonb
     end
  || case
       when jsonb_typeof(a.responses -> 'location') = 'string'
         then jsonb_build_object('cityOfResidence', left(a.responses ->> 'location', 120))
       else '{}'::jsonb
     end
where a.responses ?| array['preferredName', 'location', 'links'];

do $$
begin
  if exists (
    select 1
    from public.applications a
    where not private.application_responses_valid(a.application_type, a.responses, a.status <> 'draft')
  ) then
    raise exception 'An existing application does not satisfy the new About you rules';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizer application list: the applicant name is now the full name answer.
-- ---------------------------------------------------------------------------

create or replace function public.list_review_applications(
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
    coalesce(nullif(btrim(a.responses ->> 'fullName'), ''), p.display_name, '') as applicant_name,
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
      or coalesce(a.responses ->> 'fullName', '') ilike search_pattern
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

-- ---------------------------------------------------------------------------
-- Privileges: CHECK constraints call these helpers as the writing role.
-- ---------------------------------------------------------------------------

revoke all on function private.country_codes() from public, anon;
revoke all on function private.profile_link_pattern(text) from public, anon;
grant execute on function private.country_codes() to authenticated, service_role;
grant execute on function private.profile_link_pattern(text) to authenticated, service_role;
