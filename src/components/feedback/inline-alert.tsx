import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  danger: {
    icon: AlertTriangle,
    className: "border-destructive/30 bg-danger-soft text-destructive",
  },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning-soft text-warning" },
  success: { icon: CheckCircle2, className: "border-success/30 bg-success-soft text-success" },
  info: { icon: Info, className: "border-info/30 bg-info-soft text-info" },
} satisfies Record<string, { icon: LucideIcon; className: string }>;

/**
 * A message inside a form or card (wrong password, link expired, "password
 * changed"). Errors are announced (`role="alert"`), the others politely.
 */
export function InlineAlert({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "text-dense flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
        toneClass,
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 text-foreground">{children}</div>
    </div>
  );
}
