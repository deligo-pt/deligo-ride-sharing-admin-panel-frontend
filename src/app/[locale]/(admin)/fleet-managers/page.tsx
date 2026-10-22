import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { FleetList } from "@/features/fleet/fleet-list";

export const generateMetadata = moduleMetadata("fleet");

export default function FleetManagersPage() {
  return <FleetList />;
}
