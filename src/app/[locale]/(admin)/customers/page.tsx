import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { CustomersList } from "@/features/customers/customers-list";

export const generateMetadata = moduleMetadata("customers");

export default function CustomersPage() {
  return <CustomersList />;
}
