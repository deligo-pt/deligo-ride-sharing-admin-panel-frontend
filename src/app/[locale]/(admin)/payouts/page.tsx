import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("payouts");

export default function PayoutsPage() {
  return <ModulePlaceholder module="payouts" />;
}
