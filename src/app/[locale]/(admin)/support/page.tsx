import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("support");

export default function SupportPage() {
  return <ModulePlaceholder module="support" />;
}
