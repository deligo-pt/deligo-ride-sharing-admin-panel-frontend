import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { EditVehicle } from "@/features/vehicles/edit-vehicle";

export const generateMetadata = moduleMetadata("vehicles");

export default async function EditVehiclePage({
  params,
}: PageProps<"/[locale]/vehicles/[id]/edit">) {
  const { id } = await params;
  return <EditVehicle id={id} />;
}
