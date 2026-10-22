import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("documents");

export default function DocumentsPage() {
  return <ModulePlaceholder module="documents" />;
}
