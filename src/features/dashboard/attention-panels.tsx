"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Megaphone,
  MapPinned,
  ShieldAlert,
  TicketPercent,
  UserCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { PermissionAction, PermissionModule } from "@/config/roles";
import type { DashboardAlert, DashboardAlertKind } from "@/types/analytics";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { usePermission } from "@/components/session/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

type Query<T> = { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };

/** Alerts that are a queue to work through (approvals), not an incident. */
const APPROVAL_KINDS: DashboardAlertKind[] = [
  "DOCUMENTS_PENDING",
  "FLEET_PENDING",
  "VEHICLES_PENDING",
];

const SEVERITY = {
  critical: { icon: ShieldAlert, className: "bg-danger-soft text-destructive" },
  warning: { icon: AlertTriangle, className: "bg-warning-soft text-warning" },
  info: { icon: Info, className: "bg-info-soft text-info" },
} as const;

function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

function ItemRow({
  href,
  icon: Icon,
  iconClassName,
  count,
  children,
}: {
  href: string;
  icon: LucideIcon;
  iconClassName: string;
  count?: number;
  children: React.ReactNode;
}) {
  const f = useFormat();
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className={cn("grid size-8 shrink-0 place-items-center rounded-lg", iconClassName)}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-dense min-w-0 flex-1">{children}</span>
        {count !== undefined && (
          <Badge variant="neutral" className="tabular shrink-0">
            {f.number(count)}
          </Badge>
        )}
        <ArrowRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        />
      </Link>
    </li>
  );
}

/** Work waiting for someone to approve: drivers, documents, fleets, vehicles (§4 "pending approvals"). */
export function PendingApprovalsCard({
  alerts,
  pendingDrivers,
  statsReady,
}: {
  alerts: Query<DashboardAlert[]>;
  /** Drivers waiting for verification (from the stats), shown when the role may open Drivers. */
  pendingDrivers: number | undefined;
  statsReady: boolean;
}) {
  const t = useTranslations("dashboard");
  const allowed = usePermission();
  const approvals = alerts.data?.filter((a) => APPROVAL_KINDS.includes(a.kind)) ?? [];
  const showDrivers = allowed("drivers", "view") && (pendingDrivers ?? 0) > 0;
  const empty = !showDrivers && approvals.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("approvals.title")}</CardTitle>
        <CardDescription>{t("approvals.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.isPending || !statsReady ? (
          <RowSkeleton />
        ) : alerts.data === undefined ? (
          <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} className="py-6" />
        ) : empty ? (
          <EmptyState
            icon={CheckCircle2}
            title={t("approvals.emptyTitle")}
            description={t("approvals.emptyBody")}
            className="py-6"
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {showDrivers && (
              <ItemRow
                href="/drivers?verification=PENDING_DOCS,UNDER_REVIEW"
                icon={UserCheck}
                iconClassName="bg-info-soft text-info"
                count={pendingDrivers}
              >
                {t("approvals.drivers", { count: pendingDrivers ?? 0 })}
              </ItemRow>
            )}
            {approvals.map((a) => (
              <ItemRow
                key={a.kind}
                href={a.href}
                icon={ClipboardCheck}
                iconClassName="bg-info-soft text-info"
                count={a.count}
              >
                {t(`alerts.${a.kind}`, { count: a.count, ref: a.ref ?? "" })}
              </ItemRow>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Incidents and things going wrong: SOS, failed payouts, expiring documents… most urgent first. */
export function OperationalAlertsCard({ alerts }: { alerts: Query<DashboardAlert[]> }) {
  const t = useTranslations("dashboard");
  const operational = alerts.data?.filter((a) => !APPROVAL_KINDS.includes(a.kind)) ?? [];
  const critical = operational.filter((a) => a.severity === "critical").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title flex items-center gap-2">
          {t("alerts.title")}
          {critical > 0 && (
            <Badge variant="danger" className="text-micro h-5">
              {t("alerts.critical", { count: critical })}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{t("alerts.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.isPending ? (
          <RowSkeleton />
        ) : alerts.data === undefined ? (
          <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} className="py-6" />
        ) : operational.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t("alerts.emptyTitle")}
            description={t("alerts.emptyBody")}
            className="py-6"
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {operational.map((a) => (
              <ItemRow
                key={a.kind}
                href={a.href}
                icon={SEVERITY[a.severity].icon}
                iconClassName={SEVERITY[a.severity].className}
                count={a.count}
              >
                {t(`alerts.${a.kind}`, { count: a.count, ref: a.ref ?? "" })}
              </ItemRow>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

type Shortcut = {
  id: "approveDrivers" | "liveMap" | "createPromotion" | "broadcast";
  icon: LucideIcon;
  href: string;
  module: PermissionModule;
  action: PermissionAction;
};

const SHORTCUTS: Shortcut[] = [
  {
    id: "approveDrivers",
    icon: UserCheck,
    href: "/drivers?verification=PENDING_DOCS,UNDER_REVIEW",
    module: "drivers",
    action: "approve",
  },
  { id: "liveMap", icon: MapPinned, href: "/live", module: "live", action: "view" },
  {
    id: "createPromotion",
    icon: TicketPercent,
    href: "/promotions",
    module: "promotions",
    action: "create",
  },
  {
    id: "broadcast",
    icon: Megaphone,
    href: "/notifications",
    module: "notifications",
    action: "create",
  },
];

/** Frequent actions (§4), each only for roles that may do it. Hidden when the role has none. */
export function ShortcutsCard() {
  const t = useTranslations("dashboard.shortcuts");
  const allowed = usePermission();
  const visible = SHORTCUTS.filter((s) => allowed(s.module, s.action));
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {visible.map(({ id, icon: Icon, href }) => (
          <Button
            key={id}
            variant="outline"
            className="h-auto justify-start gap-3 px-3 py-2.5 text-left whitespace-normal"
            asChild
          >
            <Link href={href}>
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"
              >
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-dense font-medium">{t(`${id}.label`)}</span>
                <span className="text-caption font-normal">{t(`${id}.hint`)}</span>
              </span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
