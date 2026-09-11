import { PageLoading } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";

/** Rendered inside PortalShell, which already provides main#main. */
export default function PortalLoading() {
  return <PageLoading label={COPY.common.loading} standalone={false} />;
}
