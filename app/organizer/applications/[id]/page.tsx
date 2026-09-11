import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ORGANIZER_COPY } from "@/content/copy";
import { requireOrganizer } from "@/lib/auth/dal";
import { getReviewWorkspace } from "@/lib/data/organizer";
import { toReviewWorkspaceView } from "@/lib/view-models/organizer-review";
import {
  IDENTITY_QUERY_PARAM,
  REVIEWED_QUERY_PARAM,
  isIdentityRevealed,
  parseReviewedReference,
} from "@/lib/view-models/organizer-routes";

import { ReviewWorkspaceClient } from "./_components/ReviewWorkspaceClient";

export const metadata: Metadata = { title: ORGANIZER_COPY.meta.titles.review };

/**
 * Review workspace for one application, blind by default. `?identity=revealed` loads identifying details through the
 * data layer; `?reviewed=<reference>` shows the arrival notice after Save review and continue. Unknown or malformed
 * ids render the segment's not-found state.
 */
export default async function ReviewWorkspacePage({ params, searchParams }: PageProps<"/organizer/applications/[id]">) {
  await requireOrganizer();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const workspace = await getReviewWorkspace(id, { revealIdentity: isIdentityRevealed(query[IDENTITY_QUERY_PARAM]) });
  if (!workspace) {
    notFound();
  }

  const view = toReviewWorkspaceView(workspace, {
    reviewedReference: parseReviewedReference(query[REVIEWED_QUERY_PARAM]),
  });
  return <ReviewWorkspaceClient view={view} />;
}
