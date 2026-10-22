import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { FleetDetail } from "@/features/fleet/fleet-detail";

export const generateMetadata = moduleMetadata("fleet");

export default async function FleetManagerPage({
  params,
}: PageProps<"/[locale]/fleet-managers/[id]">) {
  const { id } = await params;
  return <FleetDetail id={id} />;
}
