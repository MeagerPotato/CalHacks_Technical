import { PageNotFound } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";
import { ROUTES } from "@/lib/routes";

/** Root 404 page, also used when a page calls notFound(). */
export default function NotFound() {
  return (
    <PageNotFound
      title={COPY.pages.notFound.title}
      message={COPY.pages.notFound.body}
      homeHref={ROUTES.home}
      homeLabel={COPY.pages.notFound.home}
    />
  );
}
