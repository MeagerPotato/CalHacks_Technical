import { describe, expect, it } from "vitest";

import {
  ACCOUNT_ROLES,
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  RECOMMENDATIONS,
  type ApplicationType,
} from "@/lib/domain/enums";
import {
  EXPERIENCE_LEVELS,
  HACKER_SKILLS,
  HTTP_LINK_PATTERN_SOURCE,
  JUDGE_AVAILABILITY_BLOCKS,
  JUDGE_EXPERTISE_AREAS,
  PROJECT_CATEGORIES,
  getApplicationDraftSchema,
  getApplicationFieldKeys,
  getApplicationSubmissionSchema,
  isRequiredApplicationField,
} from "@/lib/validation/application";
import { calculateApplicationCompletion } from "@/lib/validation/completion";
import { RUBRIC_DIMENSIONS, calculateOverallScore } from "@/lib/validation/review";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";
import { queryRows } from "./helpers";

const FIXTURES: Record<ApplicationType, Record<string, unknown>> = {
  hacker: validHackerResponses,
  judge: validJudgeResponses,
};

interface FieldRule {
  field_key: string;
  field_kind: "text" | "integer" | "choice" | "choices" | "links" | "accepted";
  is_required: boolean;
  max_length: number | null;
  min_value: number | null;
  max_value: number | null;
  max_items: number | null;
  options: string[] | null;
}

function fieldRules(type: ApplicationType): Promise<FieldRule[]> {
  return queryRows<FieldRule>("select * from private.application_field_rules($1::public.application_type)", [type]);
}

// Special characters are built from code points so this file stays plain ASCII.
const EMOJI = String.fromCodePoint(0x1f600);
/** Characters JavaScript's trim() removes (U+2000-U+200A is sampled at both ends and the middle). */
const TRIMMED_WHITESPACE = String.fromCharCode(
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2005, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
  0xfeff,
);
/** Characters that look blank but trim() keeps. */
const UNTRIMMED_BLANKS = [0x85, 0x180e, 0x200b].map((code) => String.fromCharCode(code));

const LINKS = [
  "https://example.com",
  "http://example.com/path?query=1#section",
  "https://sub.example.co.uk/a/b",
  "https://EXAMPLE.com",
  "https://example.com:8080/x",
  "https://example.com:65535",
  "https://example.com:65536",
  "https://example.com:0",
  "https://example.com:080",
  "https://localhost",
  "https://localhost:3000",
  "http://192.168.0.1",
  "javascript:alert(1)",
  "data:text/html,hi",
  "ftp://example.com",
  "https://user@example.com",
  "https://example.com@evil.example",
  "https://exa mple.com",
  "https://example.com/a b",
  `https://example.com/${String.fromCharCode(0x7f)}`,
  `https://example.com/caf${String.fromCharCode(0xe9)}`,
  " https://example.com",
  "https://example.com ",
  "https://example.com.",
  "https://-example.com",
  "https://example-.com",
  "https://example.c",
  `https://example.${"a".repeat(63)}`,
  `https://example.${"a".repeat(64)}`,
  "http:example.com",
  "https://",
  `https://${"a".repeat(63)}.com`,
  `https://${"a".repeat(64)}.com`,
  `https://${"abcdefghi.".repeat(25)}com`, // 253-character host
  `https://${"abcdefghi.".repeat(25)}comx`, // 254-character host
  `https://example.com/${"p".repeat(280)}`, // 300 characters
  `https://example.com/${"p".repeat(281)}`, // 301 characters
  `https://example.com/${EMOJI.repeat(280)}`, // 300 code points, 580 UTF-16 units
  `https://example.com/${EMOJI.repeat(281)}`, // 301 code points
];

function textVariants(max: number): unknown[] {
  return [
    "Answer",
    "",
    TRIMMED_WHITESPACE,
    `${TRIMMED_WHITESPACE}Answer${TRIMMED_WHITESPACE}`,
    ...UNTRIMMED_BLANKS,
    "x".repeat(max),
    "x".repeat(max + 1),
    `${TRIMMED_WHITESPACE}${"x".repeat(max)}${TRIMMED_WHITESPACE}`,
    // Zod and char_length both count code points, so an emoji counts once.
    EMOJI.repeat(max),
    EMOJI.repeat(max + 1),
    `${"x".repeat(max - 1)}${EMOJI}`,
    `${"x".repeat(max)}${EMOJI}`,
    String.fromCharCode(0xe9).repeat(max),
    42,
    true,
    null,
    ["Answer"],
    { text: "Answer" },
  ];
}

function integerVariants(min: number, max: number): unknown[] {
  return [min, max, min - 1, max + 1, min + 0.5, String(min), null, true, [min], 1e300];
}

function choiceVariants(options: string[]): unknown[] {
  return [...options, "not_an_option", options[0].toUpperCase(), "", null, 1, [options[0]]];
}

function choicesVariants(options: string[], maxItems: number): unknown[] {
  return [
    ...options.map((option) => [option]),
    options.slice(0, maxItems),
    options.length > maxItems ? options.slice(0, maxItems + 1) : [...options, options[0]],
    [],
    [options[0], options[0]],
    ["not_an_option"],
    [options[0], 1],
    [options[0], null],
    options[0],
    null,
  ];
}

function linksVariants(maxItems: number): unknown[] {
  return [
    [],
    ...LINKS.map((link) => [link]),
    Array.from({ length: maxItems }, (_, index) => `https://example.com/${index}`),
    Array.from({ length: maxItems + 1 }, (_, index) => `https://example.com/${index}`),
    [EMOJI.repeat(300)],
    [EMOJI.repeat(301)],
    [`  ${"x".repeat(300)}  `],
    [1],
    [null],
    "https://example.com",
    null,
  ];
}

function variantsFor(rule: FieldRule): unknown[] {
  switch (rule.field_kind) {
    case "text":
      return textVariants(rule.max_length ?? 0);
    case "integer":
      return integerVariants(rule.min_value ?? 0, rule.max_value ?? 0);
    case "choice":
      return choiceVariants(rule.options ?? []);
    case "choices":
      return choicesVariants(rule.options ?? [], rule.max_items ?? 0);
    case "links":
      return linksVariants(rule.max_items ?? 0);
    case "accepted":
      return [true, false, "true", 1, null, [true]];
  }
}

// The parity checks below build choice variants from the SQL options, so an option added
// only in TypeScript would go unnoticed without this exact comparison.
const OPTION_LISTS: Record<string, readonly string[]> = {
  experienceLevel: EXPERIENCE_LEVELS,
  skills: HACKER_SKILLS,
  expertiseAreas: JUDGE_EXPERTISE_AREAS,
  availability: JUDGE_AVAILABILITY_BLOCKS,
  preferredCategories: PROJECT_CATEGORIES,
};

describe("SQL and TypeScript contracts stay in sync", () => {
  it.each(APPLICATION_TYPES)("%s response fields, required keys, and options match TypeScript", async (type) => {
    const rules = await fieldRules(type);
    expect(rules.map((rule) => rule.field_key).sort()).toEqual(getApplicationFieldKeys(type).sort());
    for (const rule of rules) {
      expect(rule.is_required, rule.field_key).toBe(isRequiredApplicationField(type, rule.field_key));
      const options = OPTION_LISTS[rule.field_key];
      expect(rule.options, `${rule.field_key} options`).toEqual(options ? [...options] : null);
    }
  });

  it("uses the same link pattern in SQL and TypeScript", async () => {
    const [row] = await queryRows<{ pattern: string }>("select private.http_link_pattern() as pattern");
    expect(row.pattern).toBe(HTTP_LINK_PATTERN_SOURCE);
  });

  it.each(APPLICATION_TYPES)("the database accepts exactly the %s responses Zod accepts", async (type) => {
    const fixture = FIXTURES[type];
    const cases: Array<{ label: string; responses: Record<string, unknown> }> = [
      { label: "complete fixture", responses: fixture },
      { label: "empty object", responses: {} },
    ];

    for (const rule of await fieldRules(type)) {
      const missing = { ...fixture };
      delete missing[rule.field_key];
      cases.push({ label: `${rule.field_key} missing`, responses: missing });
      variantsFor(rule).forEach((value, index) => {
        cases.push({
          label: `${rule.field_key} #${index} ${JSON.stringify(value).slice(0, 60)}`,
          responses: { ...fixture, [rule.field_key]: value },
        });
      });
    }

    for (const submitted of [false, true]) {
      const rows = await queryRows<{ index: number; valid: boolean }>(
        `select (c.ordinality - 1)::int as index,
                private.application_responses_valid($1::public.application_type, c.value, $2) as valid
         from jsonb_array_elements($3::jsonb) with ordinality as c (value, ordinality)`,
        [type, submitted, JSON.stringify(cases.map((entry) => entry.responses))],
      );
      expect(rows).toHaveLength(cases.length);

      const schema = submitted ? getApplicationSubmissionSchema(type) : getApplicationDraftSchema(type);
      const mismatches = rows
        .filter((row) => row.valid !== schema.safeParse(cases[row.index].responses).success)
        .map((row) => `${submitted ? "submission" : "draft"} ${cases[row.index].label}: database says ${row.valid}`);
      expect(mismatches).toEqual([]);
    }
  });

  it.each(APPLICATION_TYPES)("the database rejects unknown %s response keys that Zod strips", async (type) => {
    const [row] = await queryRows<{ draft: boolean; submitted: boolean }>(
      `select private.application_responses_valid($1::public.application_type, $2::jsonb, false) as draft,
              private.application_responses_valid($1::public.application_type, $2::jsonb, true) as submitted`,
      [type, JSON.stringify({ ...FIXTURES[type], injectedKey: "stored anyway" })],
    );
    expect(row).toEqual({ draft: false, submitted: false });
  });

  it.each(APPLICATION_TYPES)("%s rubric dimensions match", async (type) => {
    const rows = await queryRows<{ dimensions: string[] }>(
      "select private.rubric_dimensions($1::public.application_type) as dimensions",
      [type],
    );
    expect(rows[0].dimensions).toEqual([...RUBRIC_DIMENSIONS[type]]);
  });

  it("enum values match the database", async () => {
    const rows = await queryRows<{ type_name: string; labels: string[] }>(
      `select t.typname::text as type_name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
       from pg_type t
       join pg_enum e on e.enumtypid = t.oid
       where t.typnamespace = 'public'::regnamespace
       group by t.typname`,
    );
    expect(Object.fromEntries(rows.map((row) => [row.type_name, row.labels]))).toEqual({
      account_role: [...ACCOUNT_ROLES],
      application_type: [...APPLICATION_TYPES],
      application_status: [...APPLICATION_STATUSES],
      recommendation: [...RECOMMENDATIONS],
    });
  });
});

describe("seed data", () => {
  it("matches the TypeScript completion and validation rules", async () => {
    const applications = await queryRows<{
      application_type: ApplicationType;
      status: string;
      responses: unknown;
      completion_percent: number;
    }>(
      `select application_type::text as application_type, status::text as status, responses, completion_percent
       from public.applications
       where id::text like 'b0000000-%'
       order by reference_number`,
    );
    expect(applications.length).toBeGreaterThanOrEqual(10);
    expect(applications.length).toBeLessThanOrEqual(14);

    for (const row of applications) {
      if (row.status === "draft") {
        expect(calculateApplicationCompletion(row.application_type, row.responses).percent).toBe(row.completion_percent);
      } else {
        expect(getApplicationSubmissionSchema(row.application_type).safeParse(row.responses).success).toBe(true);
      }
    }

    const reviews = await queryRows<{
      application_type: ApplicationType;
      rubric_scores: unknown;
      overall_score: string | null;
      completed: boolean;
    }>(
      `select a.application_type::text as application_type, r.rubric_scores, r.overall_score::text as overall_score,
              (r.completed_at is not null) as completed
       from public.reviews r
       join public.applications a on a.id = r.application_id
       where r.id::text like 'c0000000-%'`,
    );
    expect(reviews.filter((review) => review.completed).length).toBeGreaterThanOrEqual(2);
    for (const review of reviews) {
      expect(calculateOverallScore(review.application_type, review.rubric_scores)).toBe(
        review.overall_score === null ? null : Number(review.overall_score),
      );
    }
  });
});

describe("database security posture", () => {
  it("enables Row Level Security on every public table", async () => {
    const rows = await queryRows<{ table_name: string; rls: boolean }>(
      `select relname::text as table_name, relrowsecurity as rls
       from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'
       order by relname`,
    );
    expect(rows).toEqual([
      { table_name: "applications", rls: true },
      { table_name: "profiles", rls: true },
      { table_name: "reviews", rls: true },
    ]);
  });

  it("gives signed-out visitors no table, sequence, or function access", async () => {
    const tables = await queryRows<{ grant: string }>(
      `select format('%s %s', p.privilege, t.name) as grant
       from unnest(array['public.profiles', 'public.applications', 'public.reviews']) as t(name)
       cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(privilege)
       where has_table_privilege('anon', t.name, p.privilege)`,
    );
    expect(tables).toEqual([]);

    const functions = await queryRows<{ signature: string }>(
      `select p.oid::regprocedure::text as signature
       from pg_proc p
       where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
         and has_function_privilege('anon', p.oid, 'EXECUTE')`,
    );
    expect(functions).toEqual([]);

    const sequences = await queryRows<{ role: string }>(
      `select r.role
       from unnest(array['anon', 'authenticated']) as r(role)
       where has_sequence_privilege(r.role, 'public.applications_reference_number_seq', 'USAGE,SELECT,UPDATE')`,
    );
    expect(sequences).toEqual([]);
  });

  it("limits signed-in clients to SELECT plus the intended column writes", async () => {
    const tableGrants = await queryRows<{ grant: string }>(
      `select format('%s %s', privilege_type, table_name) as grant
       from information_schema.table_privileges
       where grantee = 'authenticated' and table_schema = 'public'`,
    );
    expect(tableGrants.map((row) => row.grant).sort()).toEqual([
      "SELECT applications",
      "SELECT profiles",
      "SELECT reviews",
    ]);

    const columnGrants = await queryRows<{ grant: string }>(
      `select format('%s %s.%s', privilege_type, table_name, column_name) as grant
       from information_schema.column_privileges
       where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE')`,
    );
    expect(columnGrants.map((row) => row.grant).sort()).toEqual(
      [
        "INSERT applications.application_type",
        "INSERT applications.completion_percent",
        "INSERT applications.responses",
        "INSERT applications.user_id",
        "INSERT reviews.application_id",
        "INSERT reviews.completed_at",
        "INSERT reviews.notes",
        "INSERT reviews.recommendation",
        "INSERT reviews.reviewer_id",
        "INSERT reviews.rubric_scores",
        "UPDATE applications.completion_percent",
        "UPDATE applications.responses",
        "UPDATE applications.status",
        "UPDATE profiles.display_name",
        "UPDATE reviews.completed_at",
        "UPDATE reviews.notes",
        "UPDATE reviews.recommendation",
        "UPDATE reviews.rubric_scores",
      ].sort(),
    );
  });

  it("exposes only the intended functions to signed-in clients", async () => {
    const rows = await queryRows<{ name: string }>(
      `select format('%s.%s', n.nspname, p.proname) as name
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')
         and has_function_privilege('authenticated', p.oid, 'EXECUTE')`,
    );
    expect(rows.map((row) => row.name).sort()).toEqual(
      [
        // Called from RLS policies, CHECK constraints, and guard triggers.
        "private.application_field_rules",
        "private.application_responses_valid",
        "private.current_account_role",
        "private.http_link_pattern",
        "private.is_organizer",
        "private.rubric_dimensions",
        "private.trim_js_whitespace",
        // Organizer read RPCs; each refuses non-organizers itself.
        "public.get_application_status_breakdown",
        "public.get_judge_expertise_counts",
        "public.get_next_unreviewed_application_id",
        "public.get_organizer_overview",
        "public.list_review_applications",
      ].sort(),
    );
  });

  it("has no SECURITY DEFINER functions in the exposed schema and pins every search_path", async () => {
    const definers = await queryRows<{ signature: string }>(
      `select p.oid::regprocedure::text as signature
       from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.prosecdef`,
    );
    expect(definers).toEqual([]);

    const unpinned = await queryRows<{ signature: string }>(
      `select p.oid::regprocedure::text as signature
       from pg_proc p
       where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
         and not exists (
           select 1 from pg_depend d
           where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
         )
         and not exists (
           select 1 from unnest(coalesce(p.proconfig, array[]::text[])) as setting
           where setting like 'search_path=%'
         )`,
    );
    expect(unpinned).toEqual([]);
  });
});
