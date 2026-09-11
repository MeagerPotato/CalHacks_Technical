"use client";

import { DecisionRelease } from "@/components/organizer/DecisionRelease";
import { IdentityPanel } from "@/components/organizer/IdentityPanel";
import { NarrativePanel } from "@/components/organizer/NarrativePanel";
import { ReviewWorkspaceLayout } from "@/components/organizer/ReviewWorkspaceLayout";
import { Scorecard } from "@/components/organizer/Scorecard";
import { WorkspaceHeader } from "@/components/organizer/WorkspaceHeader";
import { LiveStatus, NoticeFromView } from "@/components/ui/Notice";
import type { ReviewWorkspaceView } from "@/lib/view-models/organizer-types";

import { useReviewWorkspace } from "./use-review-workspace";

export interface ReviewWorkspaceClientProps {
  view: ReviewWorkspaceView;
}

/**
 * The review workspace container: composes the presentational workspace views with the scorecard, blind-mode, and
 * decision state from `useReviewWorkspace`. Failure notices are alerts; success is announced through the live status.
 */
export function ReviewWorkspaceClient({ view }: ReviewWorkspaceClientProps) {
  const workspace = useReviewWorkspace(view);
  const { notice } = workspace;
  const hasNotices = notice !== null || view.notices.length > 0;

  return (
    <ReviewWorkspaceLayout
      isBlind={view.blind.isBlind}
      access={view.scorecard.access}
      header={
        <WorkspaceHeader
          header={view.header}
          blind={view.blind}
          onToggleIdentity={workspace.toggleIdentity}
          identityPending={workspace.identityPending}
          headingRef={workspace.headingRef}
        />
      }
      notices={
        hasNotices ? (
          <>
            {notice ? (
              <NoticeFromView
                view={notice}
                onAction={workspace.handleNoticeAction}
                live={notice.tone === "success" ? "off" : "assertive"}
              />
            ) : null}
            {view.notices.map((item) => (
              <NoticeFromView key={item.id} view={item} />
            ))}
          </>
        ) : undefined
      }
      identity={view.identity ? <IdentityPanel identity={view.identity} /> : undefined}
      narrative={<NarrativePanel title={view.narrative.title} sections={view.narrative.sections} />}
      scorecard={<Scorecard view={view.scorecard} summaryRef={workspace.summaryRef} {...workspace.scorecard} />}
      decision={
        view.decision ? (
          <DecisionRelease
            view={view.decision}
            headingRef={workspace.decisionHeadingRef}
            confirmRef={workspace.confirmRef}
            releaseRef={workspace.releaseRef}
            {...workspace.decision}
          />
        ) : undefined
      }
      status={<LiveStatus message={workspace.announcement} />}
    />
  );
}
