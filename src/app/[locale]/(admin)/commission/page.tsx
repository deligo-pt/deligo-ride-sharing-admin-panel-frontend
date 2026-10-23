import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { CommissionView } from "@/features/commission/commission-view";

export const generateMetadata = moduleMetadata("commission");

export default function CommissionPage() {
  return <CommissionView />;
}
