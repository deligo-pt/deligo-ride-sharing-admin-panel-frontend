import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * A number card in the look of the dashboard's KPI cards. With `onClick` the
 * whole card is a button (the number opens the matching list or view).
 */
type Tone = "default" | "warning" | "danger" | "success";

const TONE_ICON: Record<Tone, string> = {
  default: "bg-accent text-accent-foreground",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
  success: "bg-success-soft text-success",
};

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  onClick,
  pressed,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
  onClick?: () => void;
  /** For a card that picks a state: the one picked. */
  pressed?: boolean;
}) {
  const body = (
    <Card
      size="sm"
      className={cn(
        "h-full gap-3 px-4 transition-shadow",
        onClick && "group-hover/kpi:shadow-md group-hover/kpi:ring-primary/40 group-focus-visible/kpi:ring-2 group-focus-visible/kpi:ring-ring",
        pressed && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-dense font-medium text-muted-foreground">{label}</p>
        <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE_ICON[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="tabular text-2xl font-bold tracking-tight">{value}</p>
      <div className="text-caption flex min-h-4 items-center gap-2">
        {sub && <span>{sub}</span>}
        {onClick && (
          <ArrowRight
            aria-hidden
            className="ml-auto size-3.5 -translate-x-1 opacity-0 transition-[opacity,translate] group-hover/kpi:translate-x-0 group-hover/kpi:opacity-100 group-focus-visible/kpi:translate-x-0 group-focus-visible/kpi:opacity-100 motion-reduce:transition-none"
          />
        )}
      </div>
    </Card>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={`${label}: ${value}`}
      className="group/kpi block h-full w-full rounded-xl text-left outline-none"
    >
      {body}
    </button>
  ) : (
    <div className="group/kpi h-full">{body}</div>
  );
}

export function MetricCardSkeleton() {
  return <Skeleton className="h-[7.25rem] rounded-xl" />;
}
