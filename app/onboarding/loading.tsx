import { PageLoading } from "@/components/ui/PageState";
import { COPY } from "@/content/copy";

export default function OnboardingLoading() {
  return <PageLoading label={COPY.common.loading} />;
}
