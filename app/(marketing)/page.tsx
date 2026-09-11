import { LandingView } from "@/components/marketing/LandingView";

/** Public landing page. It never reads the session, so it is statically rendered. */
export default function LandingPage() {
  return <LandingView />;
}
