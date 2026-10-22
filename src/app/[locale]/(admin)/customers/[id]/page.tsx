import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { CustomerDetail } from "@/features/customers/customer-detail";

export const generateMetadata = moduleMetadata("customers");

export default async function CustomerPage({ params }: PageProps<"/[locale]/customers/[id]">) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}
