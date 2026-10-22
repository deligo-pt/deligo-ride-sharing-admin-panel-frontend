import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { VehiclesList } from "@/features/vehicles/vehicles-list";

export const generateMetadata = moduleMetadata("vehicles");

export default function VehiclesPage() {
  return <VehiclesList />;
}
