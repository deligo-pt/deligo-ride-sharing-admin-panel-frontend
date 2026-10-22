import { ModulePlaceholder, moduleMetadata } from "@/components/feedback/module-placeholder";

export const generateMetadata = moduleMetadata("settings");

export default function SettingsPage() {
  return <ModulePlaceholder module="settings" />;
}
