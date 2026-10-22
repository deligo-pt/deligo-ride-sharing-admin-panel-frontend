import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { DriverDetail } from "@/features/drivers/driver-detail";

export const generateMetadata = moduleMetadata("drivers");

export default async function DriverPage({ params }: PageProps<"/[locale]/drivers/[id]">) {
  const { id } = await params;
  return <DriverDetail id={id} />;
}
