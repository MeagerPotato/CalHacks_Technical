import { describe, expect, it } from "vitest";

import {
  ACCOUNT_ROLES,
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  RECOMMENDATIONS,
  type ApplicationType,
} from "@/lib/domain/enums";
import { getApplicationSubmissionSchema, getRequiredApplicationFieldKeys } from "@/lib/validation/application";
import { calculateApplicationCompletion } from "@/lib/validation/completion";
import { RUBRIC_DIMENSIONS, calculateOverallScore } from "@/lib/validation/review";

import { validHackerResponses, validJudgeResponses } from "../fixtures/applications";
import { queryRows, withDatabase } from "./helpers";

const FIXTURES: Record<ApplicationType, Record<string, unknown>> = {
  hacker: validHackerResponses,
  judge: validJudgeResponses,
};

/** A value of the same JSON shape that fails both the SQL guard and Zod. */
function invalidVariant(value: unknown): unknown {
  if (typeof value === "string") return "   ";
  if (typeof value === "number") return -1;
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return [];
  return null;
}

describe("SQL and TypeScript contracts stay in sync", () => {
  it.each(APPLICATION_TYPES)("required %s response keys match the Zod submission schema", async (type) => {
    const rows = await queryRows<{ field_key: string }>(
      "select field_key from private.application_response_requirements($1::public.application_type)",
      [type],
    );
    expect(rows.map((row) => row.field_key).sort()).toEqual(getRequiredApplicationFieldKeys(type).sort());
  });

  it.each(APPLICATION_TYPES)("the database completeness guard agrees with Zod for %s applications", async (type) => {
    const fixture = FIXTURES[type];
    const cases: Array<{ label: string; responses: Record<string, unknown> }> = [{ label: "complete", responses: fixture }];

    for (const key of getRequiredApplicationFieldKeys(type)) {
      const missing = { ...fixture };
      delete missing[key];
      cases.push({ label: `missing ${key}`, responses: missing });
      cases.push({ label: `invalid ${key}`, responses: { ...fixture, [key]: invalidVariant(fixture[key]) } });
    }

    await withDatabase(async (db) => {
      for (const { label, responses } of cases) {
        const { rows } = await db.query<{ complete: boolean }>(
          "select private.application_responses_complete($1::public.application_type, $2::jsonb) as complete",
          [type, JSON.stringify(responses)],
        );
        const zodComplete = getApplicationSubmissionSchema(type).safeParse(responses).success;
        expect(rows[0].complete, label).toBe(zodComplete);
      }
    });
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
        "private.application_response_requirements",
        "private.application_responses_complete",
        "private.current_account_role",
        "private.is_organizer",
        "private.rubric_dimensions",
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
