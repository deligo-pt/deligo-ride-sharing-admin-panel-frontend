import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { RideDetailView } from "@/features/rides/ride-detail";

export const generateMetadata = moduleMetadata("rides");

export default async function RidePage({ params }: PageProps<"/[locale]/rides/[id]">) {
  const { id } = await params;
  return <RideDetailView id={id} />;
}
