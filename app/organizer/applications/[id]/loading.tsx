import { PageLoading } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";

/** Shown while another application's workspace loads, for example after Save review and continue. */
export default function ReviewWorkspaceLoading() {
  return <PageLoading label={COPY.common.loading} standalone={false} />;
}
