import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("payments");

export default function PaymentsPage() {
  return <ModulePlaceholder module="payments" />;
}
