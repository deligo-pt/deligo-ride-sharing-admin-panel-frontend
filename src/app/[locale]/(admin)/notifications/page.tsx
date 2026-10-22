import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("notifications");

export default function NotificationsPage() {
  return <ModulePlaceholder module="notifications" />;
}
