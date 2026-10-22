"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAdmins } from "@/hooks/queries/admins";
import { useAuditLogs } from "@/hooks/queries/audit";
import { useSettlements } from "@/hooks/queries/commission";
import { useCustomers } from "@/hooks/queries/customers";
import { useDashboardAlerts, useDashboardStats } from "@/hooks/queries/dashboard";
import { useDocuments } from "@/hooks/queries/documents";
import { useDrivers } from "@/hooks/queries/drivers";
import { useFleetManagers } from "@/hooks/queries/fleet";
import { useInvoices } from "@/hooks/queries/invoices";
import { useLiveSnapshot } from "@/hooks/queries/live";
import { useNotifications } from "@/hooks/queries/notifications";
import { usePayments } from "@/hooks/queries/payments";
import { usePayouts } from "@/hooks/queries/payouts";
import { usePricingRules } from "@/hooks/queries/pricing";
import { usePromotions } from "@/hooks/queries/promotions";
import { useRides } from "@/hooks/queries/rides";
import { useIncidents, useTickets } from "@/hooks/queries/support";
import { useVehicles } from "@/hooks/queries/vehicles";
import { useGdprRequests } from "@/hooks/queries/settings";
import { useFormat } from "@/lib/use-format";
import { isServiceError } from "@/lib/service-error";
import { suspendCustomer, reactivateCustomer } from "@/services/customers";
import { resetDemoData } from "@/services/demo";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { useDemoSettings } from "@/stores/demo-settings";
import { cn } from "@/lib/utils";

/**
 * Dev-only data inspector (/design-system/data): every service through its
 * hook, with the demo controls. Lets whoever builds a module see the sample
 * data, the loading/error states and a mutation round trip. Not shipped.
 */
const ONE = { page: 1, pageSize: 1 };

function useTables() {
  return [
    ["customers", useCustomers(ONE)],
    ["drivers", useDrivers(ONE)],
    ["fleet managers", useFleetManagers(ONE)],
    ["vehicles", useVehicles(ONE)],
    ["rides", useRides(ONE)],
    ["payments", usePayments(ONE)],
    ["settlements", useSettlements(ONE)],
    ["payouts", usePayouts(ONE)],
    ["pricing rules", usePricingRules(ONE)],
    ["promotions", usePromotions(ONE)],
    ["tickets", useTickets(ONE)],
    ["incidents", useIncidents(ONE)],
    ["notifications", useNotifications(ONE)],
    ["documents", useDocuments(ONE)],
    ["invoices", useInvoices(ONE)],
    ["admins", useAdmins(ONE)],
    ["audit log", useAuditLogs(ONE)],
    ["GDPR requests", useGdprRequests(ONE)],
  ] as const;
}

export function DataInspector() {
  const f = useFormat();
  const queryClient = useQueryClient();
  const settings = useDemoSettings();
  const tables = useTables();
  const stats = useDashboardStats({});
  const alerts = useDashboardAlerts();
  const liveSnap = useLiveSnapshot();
  const latestAudit = useAuditLogs({ page: 1, pageSize: 5 });
  const customer = useCustomers({ page: 1, pageSize: 1, status: ["ACTIVE", "SUSPENDED"], sort: "name:asc" }).data?.items[0];
  const [message, setMessage] = useState("");

  const toggle = useServiceMutation({
    mutationFn: (c: { id: string; suspended: boolean }) =>
      c.suspended
        ? reactivateCustomer(c.id, "Teste do inspetor de dados (reativar).")
        : suspendCustomer(c.id, "Teste do inspetor de dados (suspender)."),
    invalidate: [qk.customers.all, qk.audit.all, qk.dashboard.all],
    onSuccess: (c) => setMessage(`${c.id} is now ${c.status}`),
    onError: (e) => setMessage(isServiceError(e) ? `${e.code}: ${e.message}` : String(e)),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-page-title">Data inspector</h1>
        <p className="text-caption">Sample data through services → hooks (P4). Dev only.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">Demo controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6 text-dense">
          <label className="flex items-center gap-2">
            <Switch checked={settings.latency} onCheckedChange={settings.setLatency} /> Latency 150–600 ms
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={settings.simulateErrors} onCheckedChange={settings.setSimulateErrors} /> Simulate errors (
            {Math.round(settings.errorRate * 100)}%)
          </label>
          <Button
            variant="outline"
            onClick={async () => {
              await resetDemoData();
              await queryClient.resetQueries();
              setMessage("Demo data reset");
            }}
          >
            Reset demo data
          </Button>
          <Button
            variant="outline"
            disabled={!customer || toggle.isPending}
            onClick={() => customer && toggle.mutate({ id: customer.id, suspended: customer.status === "SUSPENDED" })}
          >
            {customer?.status === "SUSPENDED" ? "Reactivate" : "Suspend"} {customer?.name ?? "…"}
          </Button>
          {message && <span className="text-caption" data-testid="inspector-message">{message}</span>}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tables.map(([label, q]) => (
          <Card key={label} data-testid={`count-${label}`}>
            <CardContent className="flex flex-col gap-1 py-4">
              <span className="text-caption">{label}</span>
              <span className={cn("text-card-title tabular-nums", q.isError && "text-destructive")}>
                {q.isPending ? "…" : q.isError ? (isServiceError(q.error) ? q.error.code : "error") : f.number(q.data.total)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">Dashboard (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="text-dense" data-testid="stats">
            {stats.data ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt>Rides</dt>
                <dd className="tabular-nums">{f.number(stats.data.rides.total)}</dd>
                <dt>Completed</dt>
                <dd className="tabular-nums">{f.number(stats.data.rides.completed)}</dd>
                <dt>Ongoing now</dt>
                <dd className="tabular-nums">{stats.data.rides.ongoing}</dd>
                <dt>Revenue</dt>
                <dd className="tabular-nums">{f.eur(stats.data.revenueCents)}</dd>
                <dt>Commission</dt>
                <dd className="tabular-nums">{f.eur(stats.data.commissionCents)}</dd>
                <dt>Drivers online</dt>
                <dd className="tabular-nums">{stats.data.drivers.online}</dd>
              </dl>
            ) : stats.isError ? (
              "Error"
            ) : (
              "Loading…"
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">Alerts · live</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-dense">
            {alerts.data?.map((a) => (
              <span key={a.kind}>
                {a.kind} — {a.count}
              </span>
            ))}
            <span className="text-caption" data-testid="live">
              Live: {liveSnap.data ? `${liveSnap.data.rides.length} rides, ${liveSnap.data.availableDrivers.length} idle drivers` : "…"}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">Latest audit entries</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-dense" data-testid="audit">
            {latestAudit.data?.items.map((a) => (
              <span key={a.id} className="truncate">
                {f.time(a.at)} · {a.adminName} · {a.action} · {a.resourceId}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
