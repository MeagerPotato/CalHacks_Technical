import { PageLoading } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";

/** Organizer page loading state, inside OrganizerShell's main. */
export default function OrganizerLoading() {
  return <PageLoading label={COPY.common.loading} standalone={false} />;
}
