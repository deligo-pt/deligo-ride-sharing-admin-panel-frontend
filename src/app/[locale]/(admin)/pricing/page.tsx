import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { PricingView } from "@/features/pricing/pricing-view";

export const generateMetadata = moduleMetadata("pricing");

export default function PricingPage() {
  return <PricingView />;
}
