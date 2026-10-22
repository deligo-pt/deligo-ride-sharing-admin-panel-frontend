import { moduleMetadata } from "@/components/feedback/module-placeholder";
import { FareEditor } from "@/features/pricing/fare-editor";

export const generateMetadata = moduleMetadata("pricing");

export default function NewFarePage() {
  return <FareEditor />;
}
