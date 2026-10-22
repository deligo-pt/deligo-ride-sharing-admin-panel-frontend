import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { RidesList } from "@/features/rides/rides-list";

export const generateMetadata = moduleMetadata("rides");

export default function RidesPage() {
  return <RidesList />;
}
