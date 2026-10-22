import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { VehicleDetail } from "@/features/vehicles/vehicle-detail";

export const generateMetadata = moduleMetadata("vehicles");

export default async function VehiclePage({ params }: PageProps<"/[locale]/vehicles/[id]">) {
  const { id } = await params;
  return <VehicleDetail id={id} />;
}
