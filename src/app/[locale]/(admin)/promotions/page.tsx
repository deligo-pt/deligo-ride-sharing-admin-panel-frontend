import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("promotions");

export default function PromotionsPage() {
  return <ModulePlaceholder module="promotions" />;
}
