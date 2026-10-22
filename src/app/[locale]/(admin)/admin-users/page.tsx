import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("admins");

export default function AdminUsersPage() {
  return <ModulePlaceholder module="admins" />;
}
