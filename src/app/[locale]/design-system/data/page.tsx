import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataInspector } from "@/components/design/data-inspector";

export const metadata: Metadata = { title: "Data inspector" };

// Dev-only, like the design gallery: sample data through services and hooks.
export default function DataInspectorPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DataInspector />;
}
