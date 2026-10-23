import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { PaymentsView } from "@/features/payments/payments-view";

export const generateMetadata = moduleMetadata("payments");

export default function PaymentsPage() {
  return <PaymentsView />;
}
