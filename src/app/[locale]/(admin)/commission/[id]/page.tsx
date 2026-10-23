import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { SettlementDetailView } from "@/features/commission/settlement-detail";

export const generateMetadata = moduleMetadata("commission");

export default async function SettlementPage({ params }: PageProps<"/[locale]/commission/[id]">) {
  const { id } = await params;
  return <SettlementDetailView id={id} />;
}
