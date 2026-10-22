import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignGallery } from "@/components/design/design-gallery";

export const metadata: Metadata = { title: "Design system" };

// Dev-only reference for whoever builds the modules. Never shipped to the demo.
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
