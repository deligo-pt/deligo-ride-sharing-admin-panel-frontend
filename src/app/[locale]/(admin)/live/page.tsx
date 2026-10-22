import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { LiveView } from "@/features/live/live-view";

export const generateMetadata = moduleMetadata("live");

export default function LivePage() {
  return <LiveView />;
}
