import { authNoticeFor, noticeForError } from "@/lib/editor/feedback";
import type { NoticeView } from "@/lib/view-models/types";

import { classifyThrownAction } from "./action-errors";

/**
 * The notice for an auth, onboarding, or sign-out action call that threw instead of returning a result. A network
 * failure uses the auth copy (the editor's network copy promises that edits stay on the page); a new deployment asks
 * for a reload.
 */
export function thrownActionNotice(error: unknown): NoticeView {
  if (classifyThrownAction(error) === "network") {
    return authNoticeFor("network");
  }
  return noticeForError("stale_deployment") ?? authNoticeFor("unexpected_error");
}
