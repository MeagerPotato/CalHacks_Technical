import { PageNotFound } from "@/components/ui/PageState";
import { ORGANIZER_COPY } from "@/content/copy";
import { ROUTES } from "@/lib/routes";

/** An unknown or malformed application id. Rendered inside OrganizerShell, which already provides main#main. */
export default function ReviewWorkspaceNotFound() {
  return (
    <PageNotFound
      title={ORGANIZER_COPY.workspace.notFound.title}
      message={ORGANIZER_COPY.workspace.notFound.body}
      homeHref={ROUTES.organizerApplications}
      homeLabel={ORGANIZER_COPY.workspace.backToList}
      standalone={false}
    />
  );
}
