import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("audit");

export default function AuditLogsPage() {
  return <ModulePlaceholder module="audit" />;
}
