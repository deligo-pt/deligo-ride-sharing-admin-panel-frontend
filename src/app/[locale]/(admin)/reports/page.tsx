import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("reports");

export default function ReportsPage() {
  return <ModulePlaceholder module="reports" />;
}
