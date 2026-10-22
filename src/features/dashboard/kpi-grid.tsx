"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Banknote,
  Building2,
  CalendarClock,
  Car,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  IdCard,
  LifeBuoy,
  Percent,
  Route,
  ShieldAlert,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { PermissionModule } from "@/config/roles";
import type { DashboardStats } from "@/types/analytics";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import { ErrorState } from "@/components/feedback/states";
import { usePermission } from "@/components/session/permissions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/**
 * The 15 KPI cards of requirements §4, in four groups. A card is a link to
 * the filtered list only when the role may open that module (P7); otherwise
 * it is just the number. "Live" cards (ongoing, scheduled, pending…) count
 * what is true now and ignore the period; the others follow it.
 */
type Tone = "default" | "warning" | "danger";

type KpiId =
  | "customers"
  | "drivers"
  | "pendingVerification"
  | "fleet"
  | "ridesTotal"
  | "ongoing"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "revenue"
  | "commission"
  | "settlements"
  | "payouts"
  | "complaints"
  | "incidents";

type Kpi = {
  id: KpiId;
  icon: LucideIcon;
  value: string;
  sub?: string;
  /** Change versus the previous period of the same length. */
  delta?: { current: number; previous: number };
  href?: string;
  module?: PermissionModule;
  tone?: Tone;
};

const TONE_ICON: Record<Tone, string> = {
  default: "bg-accent text-accent-foreground",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
};

/** `?range=7d` or `?range=custom&from=…&to=…`, so the list opens on the same period. */
export function periodQuery(range: string, from: string | null, to: string | null) {
  const query = new URLSearchParams({ range });
  if (range === "custom") {
    if (from) query.set("from", from);
    if (to) query.set("to", to);
  }
  return query;
}

function link(path: string, params: Record<string, string>, period?: URLSearchParams) {
  const query = new URLSearchParams(params);
  period?.forEach((value, key) => query.set(key, value));
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const t = useTranslations("dashboard.delta");
  const f = useFormat();
  if (previous <= 0) return null;
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) return <span className="text-caption">{t("same")}</span>;
  const up = change > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  const percent = f.percent(Math.abs(change), 0);
  return (
    <span
      className={cn(
        "text-caption inline-flex items-center gap-0.5 font-medium",
        up ? "text-success" : "text-destructive",
      )}
      aria-label={t(up ? "up" : "down", { percent })}
    >
      <Icon aria-hidden className="size-3" />
      {percent}
      <span className="font-normal text-muted-foreground">{t("vsPrevious")}</span>
    </span>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const t = useTranslations("dashboard.kpi");
  const allowed = usePermission();
  const clickable = Boolean(kpi.href && kpi.module && allowed(kpi.module, "view"));
  const tone = kpi.tone ?? "default";

  const body = (
    <Card
      size="sm"
      className={cn(
        "h-full gap-3 px-4 transition-shadow",
        clickable &&
          "group-hover/kpi:shadow-md group-hover/kpi:ring-primary/40 group-focus-visible/kpi:ring-2 group-focus-visible/kpi:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-dense font-medium text-muted-foreground">{t(`${kpi.id}.label`)}</p>
        <span
          aria-hidden
          className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE_ICON[tone])}
        >
          <kpi.icon className="size-4" />
        </span>
      </div>
      <p className="tabular text-3xl font-bold tracking-tight">{kpi.value}</p>
      <div className="text-caption flex min-h-4 flex-wrap items-center gap-x-2 gap-y-0.5">
        {kpi.delta && <Delta {...kpi.delta} />}
        {kpi.sub && <span>{kpi.sub}</span>}
        {clickable && (
          <ArrowRight
            aria-hidden
            className="ml-auto size-3.5 -translate-x-1 opacity-0 transition-[opacity,translate] group-hover/kpi:translate-x-0 group-hover/kpi:opacity-100 group-focus-visible/kpi:translate-x-0 group-focus-visible/kpi:opacity-100 motion-reduce:transition-none"
          />
        )}
      </div>
    </Card>
  );

  return clickable && kpi.href ? (
    <Link
      href={kpi.href}
      className="group/kpi block rounded-xl outline-none"
      aria-label={`${t(`${kpi.id}.label`)}: ${kpi.value}`}
    >
      {body}
    </Link>
  ) : (
    <div className="group/kpi">{body}</div>
  );
}

function Group({ title, kpis, wide = false }: { title: string; kpis: Kpi[]; wide?: boolean }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-dense font-semibold text-muted-foreground">{title}</h2>
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          wide ? "lg:grid-cols-3 xl:grid-cols-5" : "xl:grid-cols-4",
        )}
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>
    </section>
  );
}

export function KpiGrid({
  stats,
  period,
  fetching,
}: {
  stats: DashboardStats;
  period: URLSearchParams;
  fetching: boolean;
}) {
  const t = useTranslations("dashboard");
  const f = useFormat();
  const { customers, drivers, fleetManagers, rides, previous } = stats;
  const finished = rides.total;
  const rate = (part: number) => (finished ? f.percent(part / finished, 0) : "—");

  const people: Kpi[] = [
    {
      id: "customers",
      icon: Users,
      value: f.number(customers.total),
      sub: t("kpi.customers.sub", { count: f.number(customers.newInPeriod) }),
      delta: { current: customers.newInPeriod, previous: previous.newCustomers },
      href: "/customers",
      module: "customers",
    },
    {
      id: "drivers",
      icon: IdCard,
      value: f.number(drivers.total),
      sub: t("kpi.drivers.sub", {
        active: f.number(drivers.active),
        inactive: f.number(drivers.inactive),
      }),
      href: "/drivers",
      module: "drivers",
    },
    {
      id: "pendingVerification",
      icon: UserCheck,
      value: f.number(drivers.pendingVerification),
      sub: t("kpi.pendingVerification.sub"),
      tone: drivers.pendingVerification > 0 ? "warning" : "default",
      href: link("/drivers", { verification: "PENDING_DOCS,UNDER_REVIEW" }),
      module: "drivers",
    },
    {
      id: "fleet",
      icon: Building2,
      value: f.number(fleetManagers.total),
      sub: t("kpi.fleet.sub", { count: f.number(fleetManagers.pendingOnboarding) }),
      href: "/fleet-managers",
      module: "fleet",
    },
  ];

  const ridesGroup: Kpi[] = [
    {
      id: "ridesTotal",
      icon: Route,
      value: f.number(rides.total),
      sub: t("kpi.ridesTotal.sub"),
      delta: { current: rides.total, previous: previous.rides },
      href: link("/rides", {}, period),
      module: "rides",
    },
    {
      id: "ongoing",
      icon: Car,
      value: f.number(rides.ongoing),
      sub: t("kpi.ongoing.sub"),
      href: link("/rides", { status: ACTIVE_RIDE_STATUSES.join(",") }),
      module: "rides",
    },
    {
      id: "scheduled",
      icon: CalendarClock,
      value: f.number(rides.scheduled),
      sub: t("kpi.scheduled.sub"),
      href: link("/rides", { status: "SCHEDULED" }),
      module: "rides",
    },
    {
      id: "completed",
      icon: CheckCircle2,
      value: f.number(rides.completed),
      sub: t("kpi.completed.sub", { rate: rate(rides.completed) }),
      delta: { current: rides.completed, previous: previous.completed },
      href: link("/rides", { status: "COMPLETED" }, period),
      module: "rides",
    },
    {
      id: "cancelled",
      icon: XCircle,
      value: f.number(rides.cancelled),
      sub: t("kpi.cancelled.sub", {
        rate: rate(rides.cancelled),
        expired: f.number(rides.expired),
      }),
      href: link("/rides", { status: "CANCELLED,EXPIRED" }, period),
      module: "rides",
    },
  ];

  const money: Kpi[] = [
    {
      id: "revenue",
      icon: CircleDollarSign,
      value: f.eur(stats.revenueCents),
      sub: t("kpi.revenue.sub"),
      delta: { current: stats.revenueCents, previous: previous.revenueCents },
      href: link("/payments", {}, period),
      module: "payments",
    },
    {
      id: "commission",
      icon: Percent,
      value: f.eur(stats.commissionCents),
      sub: t("kpi.commission.sub", {
        rate: stats.revenueCents ? f.percent(stats.commissionCents / stats.revenueCents, 0) : "—",
      }),
      href: "/commission",
      module: "commission",
    },
    {
      id: "settlements",
      icon: HandCoins,
      value: f.number(stats.pendingSettlements.count),
      sub: t("kpi.settlements.sub", { amount: f.eur(stats.pendingSettlements.amountCents) }),
      href: link("/commission", { tab: "settlements", status: "PENDING" }),
      module: "commission",
    },
    {
      id: "payouts",
      icon: Banknote,
      value: f.number(stats.pendingPayouts.count),
      sub: t("kpi.payouts.sub", { amount: f.eur(stats.pendingPayouts.amountCents) }),
      href: link("/payouts", { status: "PENDING,PROCESSING" }),
      module: "payouts",
    },
  ];

  const attention: Kpi[] = [
    {
      id: "complaints",
      icon: LifeBuoy,
      value: f.number(stats.openComplaints),
      sub: t("kpi.complaints.sub"),
      tone: stats.openComplaints > 0 ? "warning" : "default",
      href: link("/support", { status: "OPEN,IN_PROGRESS,ESCALATED" }),
      module: "support",
    },
    {
      id: "incidents",
      icon: ShieldAlert,
      value: f.number(stats.activeIncidents),
      sub: t("kpi.incidents.sub"),
      tone: stats.activeIncidents > 0 ? "danger" : "default",
      href: link("/support", { tab: "incidents", status: "ACTIVE" }),
      module: "support",
    },
  ];

  return (
    <div
      className={cn("flex flex-col gap-6 transition-opacity", fetching && "opacity-60")}
      aria-busy={fetching}
    >
      <Group title={t("sections.people")} kpis={people} />
      <Group title={t("sections.rides")} kpis={ridesGroup} wide />
      <Group title={t("sections.money")} kpis={money} />
      <Group title={t("sections.attention")} kpis={attention} />
    </div>
  );
}

export function KpiGridSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {[4, 5, 4, 2].map((count, group) => (
        <div key={group} className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: count }, (_, i) => (
              <Skeleton key={i} className="h-[7.5rem] rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function KpiGridError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card>
      <ErrorState error={error} onRetry={onRetry} className="py-10" />
    </Card>
  );
}
