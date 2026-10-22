import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { DriversList } from "@/features/drivers/drivers-list";

export const generateMetadata = moduleMetadata("drivers");

export default function DriversPage() {
  return <DriversList />;
}
