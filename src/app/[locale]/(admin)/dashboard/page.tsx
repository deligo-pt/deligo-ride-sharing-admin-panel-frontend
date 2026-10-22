import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { Dashboard } from "@/features/dashboard/dashboard";

export const generateMetadata = moduleMetadata("dashboard");

export default function DashboardPage() {
  return <Dashboard />;
}
