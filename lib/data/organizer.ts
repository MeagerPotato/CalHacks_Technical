import "server-only";

import { cache } from "react";

import { requireOrganizer } from "@/lib/auth/dal";
import type { Viewer } from "@/lib/auth/types";
import { DataAccessError, toDataAccessError } from "@/lib/data/errors";
import {
  APPLICATION_SELECT,
  REVIEW_SELECT,
  toApplicantIdentity,
  toApplicationListItem,
  toOrganizerOverview,
  toQueueProgress,
  toReviewApplication,
  toReviewRecord,
  type ApplicationListRow,
} from "@/lib/data/mappers";
import type {
  ApplicantIdentity,
  ApplicationListPage,
  ExpertiseCoverageEntry,
  OrganizerDashboard,
  ReviewAccess,
  ReviewQueueProgress,
  ReviewWorkspace,
  StatusBreakdownEntry,
} from "@/lib/data/types";
import { APPLICATION_STATUSES, APPLICATION_TYPES, type ApplicationStatus } from "@/lib/domain/enums";
import { createClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/supabase/types";
import { JUDGE_EXPERTISE_AREAS } from "@/lib/validation/application";
import {
  applicationIdSchema,
  parseApplicationListFilters,
  type ApplicationListFilters,
  type ApplicationListFiltersInput,
} from "@/lib/validation/organizer";

// =============================================================================
// Organizer data access. Every database function called here also refuses
// non-organizers itself, and RLS limits the underlying tables.
// =============================================================================

// ---------------------------------------------------------------------------
// Query helpers (take an explicit client)
// ---------------------------------------------------------------------------

export async function fetchQueueProgress(supabase: TypedSupabaseClient): Promise<ReviewQueueProgress> {
  const { data, error } = await supabase.rpc("get_organizer_overview");
  if (error) throw toDataAccessError("fetchQueueProgress", error);
  return toQueueProgress(toOrganizerOverview(data?.[0]));
}

export async function fetchNextUnreviewedApplicationId(
  supabase: TypedSupabaseClient,
  afterApplicationId?: string | null,
): Promise<string | null> {
  const args =
    afterApplicationId && applicationIdSchema.safeParse(afterApplicationId).success
      ? { p_after_id: afterApplicationId }
      : {};
  const { data, error } = await supabase.rpc("get_next_unreviewed_application_id", args);
  if (error) throw toDataAccessError("fetchNextUnreviewedApplicationId", error);
  return (data as string | null) ?? null;
}

export async function fetchApplicationList(
  supabase: TypedSupabaseClient,
  input: ApplicationListFilters | ApplicationListFiltersInput = {},
): Promise<ApplicationListPage> {
  const filters = parseApplicationListFilters(input);
  const filterArgs = {
    p_search: filters.search,
    p_application_type: filters.type,
    p_status: filters.status,
    p_review_state: filters.reviewState,
    p_sort: filters.sort,
  };

  const { data, error } = await supabase.rpc("list_review_applications", {
    ...filterArgs,
    p_limit: filters.pageSize,
    p_offset: (filters.page - 1) * filters.pageSize,
  });
  if (error) throw toDataAccessError("fetchApplicationList", error);

  const rows = (data ?? []) as ApplicationListRow[];
  let total = rows[0]?.total_count ?? 0;

  // total_count is carried on each returned row, so a page past the end needs its own count.
  if (rows.length === 0 && filters.page > 1) {
    const count = await supabase.rpc("list_review_applications", { ...filterArgs, p_limit: 1, p_offset: 0 });
    if (count.error) throw toDataAccessError("fetchApplicationList:count", count.error);
    total = count.data?.[0]?.total_count ?? 0;
  }

  return {
    items: rows.map(toApplicationListItem),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
    filters,
  };
}

export async function fetchOrganizerDashboard(supabase: TypedSupabaseClient): Promise<OrganizerDashboard> {
  const [overviewResult, breakdownResult, expertiseResult, recentResult, nextResult] = await Promise.all([
    supabase.rpc("get_organizer_overview"),
    supabase.rpc("get_application_status_breakdown"),
    supabase.rpc("get_judge_expertise_counts"),
    supabase.rpc("list_review_applications", { p_sort: "submitted_desc", p_limit: 5 }),
    supabase.rpc("get_next_unreviewed_application_id", {}),
  ]);

  for (const [context, result] of [
    ["get_organizer_overview", overviewResult],
    ["get_application_status_breakdown", breakdownResult],
    ["get_judge_expertise_counts", expertiseResult],
    ["list_review_applications", recentResult],
    ["get_next_unreviewed_application_id", nextResult],
  ] as const) {
    if (result.error) throw toDataAccessError(`fetchOrganizerDashboard:${context}`, result.error);
  }

  const overview = toOrganizerOverview(overviewResult.data?.[0]);

  const statusBreakdown: StatusBreakdownEntry[] = APPLICATION_TYPES.map((type) => {
    const counts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as Record<
      ApplicationStatus,
      number
    >;
    for (const row of breakdownResult.data ?? []) {
      if (row.application_type === type) {
        counts[row.status] = row.application_count;
      }
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    return { type, total, counts };
  });

  const expertiseCounts = new Map((expertiseResult.data ?? []).map((row) => [row.expertise, row.judge_count]));
  const expertiseCoverage: ExpertiseCoverageEntry[] = JUDGE_EXPERTISE_AREAS.map((expertise) => ({
    expertise,
    judgeCount: expertiseCounts.get(expertise) ?? 0,
  })).sort((a, b) => b.judgeCount - a.judgeCount);

  const judges = statusBreakdown.find((entry) => entry.type === "judge");

  return {
    overview,
    queueProgress: toQueueProgress(overview),
    statusBreakdown,
    expertiseCoverage,
    expertiseGaps: expertiseCoverage.filter((entry) => entry.judgeCount === 0).map((entry) => entry.expertise),
    submittedJudgeCount: judges ? judges.total - judges.counts.draft : 0,
    recentSubmissions: ((recentResult.data ?? []) as ApplicationListRow[]).map(toApplicationListItem),
    nextUnreviewedApplicationId: (nextResult.data as string | null) ?? null,
  };
}

export async function fetchApplicantIdentity(
  supabase: TypedSupabaseClient,
  applicationId: string,
): Promise<ApplicantIdentity | null> {
  if (!applicationIdSchema.safeParse(applicationId).success) {
    return null;
  }

  const { data, error } = await supabase
    .from("applications")
    .select("id, application_type, responses, profile:profiles!applications_user_id_fkey(display_name, email)")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) throw toDataAccessError("fetchApplicantIdentity", error);
  return data ? toApplicantIdentity(data, data.profile) : null;
}

export interface ReviewWorkspaceOptions {
  /** Include identifying details. Defaults to false (blind review). */
  revealIdentity?: boolean;
}

export async function fetchReviewWorkspace(
  supabase: TypedSupabaseClient,
  viewer: Viewer,
  applicationId: string,
  options: ReviewWorkspaceOptions = {},
): Promise<ReviewWorkspace | null> {
  if (!applicationIdSchema.safeParse(applicationId).success) {
    return null;
  }

  const { data: row, error } = await supabase
    .from("applications")
    .select(APPLICATION_SELECT)
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw toDataAccessError("fetchReviewWorkspace:application", error);
  if (!row) return null;

  const [reviewResult, identity, nextUnreviewedApplicationId, queueProgress] = await Promise.all([
    supabase.from("reviews").select(REVIEW_SELECT).eq("application_id", applicationId).maybeSingle(),
    options.revealIdentity ? fetchApplicantIdentity(supabase, applicationId) : Promise.resolve(null),
    fetchNextUnreviewedApplicationId(supabase, applicationId),
    fetchQueueProgress(supabase),
  ]);
  if (reviewResult.error) throw toDataAccessError("fetchReviewWorkspace:review", reviewResult.error);

  const review = reviewResult.data ? toReviewRecord(reviewResult.data, viewer.userId) : null;
  const isReviewable = row.status === "submitted" || row.status === "in_review";

  let reviewAccess: ReviewAccess = "editable";
  if (!isReviewable) {
    reviewAccess = "locked";
  } else if (review && !review.isMine) {
    reviewAccess = "owned_by_another_organizer";
  }

  return {
    application: toReviewApplication(row),
    identity,
    isBlind: !options.revealIdentity,
    review,
    reviewAccess,
    canReleaseDecision: isReviewable && Boolean(review?.isCompleted),
    nextUnreviewedApplicationId,
    queueProgress,
  };
}

// ---------------------------------------------------------------------------
// Server Component reads (authorize, then query). Redirect non-organizers.
// ---------------------------------------------------------------------------

export const getOrganizerDashboard = cache(async (): Promise<OrganizerDashboard> => {
  await requireOrganizer();
  return fetchOrganizerDashboard(await createClient());
});

export async function listApplications(
  input: ApplicationListFilters | ApplicationListFiltersInput = {},
): Promise<ApplicationListPage> {
  await requireOrganizer();
  return fetchApplicationList(await createClient(), input);
}

export async function getNextUnreviewedApplicationId(afterApplicationId?: string | null): Promise<string | null> {
  await requireOrganizer();
  return fetchNextUnreviewedApplicationId(await createClient(), afterApplicationId);
}

export async function getReviewWorkspace(
  applicationId: string,
  options: ReviewWorkspaceOptions = {},
): Promise<ReviewWorkspace | null> {
  const viewer = await requireOrganizer();
  return fetchReviewWorkspace(await createClient(), viewer, applicationId, options);
}

export { DataAccessError };
