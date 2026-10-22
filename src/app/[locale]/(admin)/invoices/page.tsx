import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("invoices");

export default function InvoicesPage() {
  return <ModulePlaceholder module="invoices" />;
}
