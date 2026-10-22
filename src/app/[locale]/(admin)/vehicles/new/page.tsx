import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { VehicleForm } from "@/features/vehicles/vehicle-form";

export const generateMetadata = moduleMetadata("vehicles");

export default function NewVehiclePage() {
  return <VehicleForm />;
}
