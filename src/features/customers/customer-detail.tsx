"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, RotateCcw, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";
import type { AdminNote } from "@/types/common";
import type { RideListItem } from "@/types/ride";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { DetailHeader, KeyValueGrid, Timeline } from "@/components/detail/detail-parts";
import { NotesCard } from "@/components/detail/notes-card";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { Can, usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditLogs } from "@/hooks/queries/audit";
import { useCustomer } from "@/hooks/queries/customers";
import { useRides } from "@/hooks/queries/rides";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { useRouter } from "@/i18n/navigation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { addCustomerNote } from "@/services/customers";
import { CustomerPaymentsTab } from "./customer-payments-tab";
import { useCustomerStatusAction } from "./customer-status-dialog";
import { CustomerSupportTab } from "./customer-support-tab";

/**
 * DETAIL PAGE TEMPLATE (§P5) — copy for a module's `[id]` page:
 * header (back, title, badges, actions) → tabs in the URL (`?tab=`) →
 * overview cards with KeyValueGrid → related lists as small DataTables →
 * notes (add form) → activity from the audit log. Loading = DetailSkeleton,
 * NOT_FOUND = EmptyState with a way back, other errors = ErrorState.
 * Permissions (P7): actions in `<Can>`, tabs of other modules only with
 * their `view` permission (the URL `?tab=` falls back to overview).
 */
const TABS = ["overview", "rides", "payments", "support", "notes", "activity"] as const;
type Tab = (typeof TABS)[number];
/** Modules whose `view` opens a tab — any one of them is enough. */
const TAB_MODULES: Partial<
  Record<Tab, readonly ("rides" | "payments" | "invoices" | "support" | "audit")[]>
> = {
  rides: ["rides"],
  payments: ["payments", "invoices"],
  support: ["support"],
  activity: ["audit"],
};

export function CustomerDetail({ id }: { id: string }) {
  const t = useTranslations();
  const f = useFormat();
  const query = useCustomer(id);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("overview").withOptions({ history: "replace" }),
  );
  const statusAction = useCustomerStatusAction();
  const allowed = usePermission();
  const tabs = TABS.filter((key) => {
    const modules = TAB_MODULES[key];
    return !modules || modules.some((m) => allowed(m, "view"));
  });
  const currentTab = tabs.includes(tab) ? tab : "overview";

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    if (isServiceError(query.error) && query.error.code === "NOT_FOUND") {
      return (
        <EmptyState
          icon={UserX}
          title={t("customers.notFound")}
          action={<BackButton label={t("customers.backToList")} />}
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const c = query.data;
  const suspended = c.status === "SUSPENDED" || c.status === "DEACTIVATED";

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        backHref="/customers"
        backLabel={t("customers.backToList")}
        title={c.name}
        subtitle={c.id}
        badges={
          <>
            <StatusBadge kind="customer" value={c.status} />
            <StatusBadge kind="verification" value={c.verification} />
          </>
        }
        actions={
          <Can module="customers" action="suspend">
            {suspended ? (
              <Button variant="outline" onClick={() => statusAction.open(c)}>
                <RotateCcw />
                {t("customers.actions.reactivate")}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => statusAction.open(c)}
              >
                <Ban />
                {t("customers.actions.suspend")}
              </Button>
            )}
          </Can>
        }
      />

      {c.unpaidCents > 0 && (
        <InlineAlert tone="warning">
          {t("customers.unpaidNotice", { amount: f.eur(c.unpaidCents) })}
        </InlineAlert>
      )}

      <Tabs value={currentTab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="max-w-full overflow-x-auto">
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`customers.tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-card-title">{t("customers.sections.contact")}</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValueGrid
                columns={1}
                items={[
                  { label: t("customers.columns.email"), value: c.email },
                  { label: t("customers.columns.phone"), value: f.phone(c.phone) },
                  { label: t("customers.fields.nif"), value: c.nif },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-card-title">{t("customers.sections.account")}</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValueGrid
                columns={1}
                items={[
                  { label: t("customers.fields.registered"), value: f.dateTime(c.registeredAt) },
                  {
                    label: t("customers.fields.language"),
                    value: t(`enums.language.${c.language}`),
                  },
                  {
                    label: t("customers.fields.verification"),
                    value: <StatusBadge kind="verification" value={c.verification} />,
                  },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-card-title">{t("customers.sections.usage")}</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValueGrid
                columns={1}
                items={[
                  { label: t("customers.fields.rides"), value: f.number(c.totalRides) },
                  { label: t("customers.fields.spent"), value: f.eur(c.totalSpentCents) },
                  {
                    label: t("customers.fields.lastRide"),
                    value: c.lastRideAt ? f.relative(c.lastRideAt) : null,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {tabs.includes("rides") && (
          <TabsContent value="rides" className="mt-4">
            <CustomerRides customerId={c.id} />
          </TabsContent>
        )}
        {tabs.includes("payments") && (
          <TabsContent value="payments" className="mt-4">
            <CustomerPaymentsTab customerId={c.id} />
          </TabsContent>
        )}
        {tabs.includes("support") && (
          <TabsContent value="support" className="mt-4">
            <CustomerSupportTab customerId={c.id} />
          </TabsContent>
        )}
        <TabsContent value="notes" className="mt-4">
          <CustomerNotes customerId={c.id} notes={c.notes} />
        </TabsContent>
        {tabs.includes("activity") && (
          <TabsContent value="activity" className="mt-4">
            <CustomerActivity customerId={c.id} />
          </TabsContent>
        )}
      </Tabs>
      {statusAction.dialog}
    </div>
  );
}

function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.push("/customers")}>
      {label}
    </Button>
  );
}

/** Related list: local page/sort state (not in the URL — the tab is). */
function CustomerRides({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useRides({ customerId, page, pageSize: size, sort: sort || undefined });
  const columns = useMemo<ColumnDef<RideListItem, unknown>[]>(
    () => [
      {
        id: "id",
        meta: {
          label: t("customers.rideColumns.ride"),
          className: "tabular-nums whitespace-nowrap",
        },
        header: t("customers.rideColumns.ride"),
        cell: ({ row }) => row.original.id,
      },
      {
        id: "bookedAt",
        enableSorting: true,
        meta: { label: t("customers.rideColumns.date"), className: "whitespace-nowrap" },
        header: t("customers.rideColumns.date"),
        cell: ({ row }) => f.dateTime(row.original.bookedAt),
      },
      {
        id: "route",
        meta: { label: t("customers.rideColumns.route"), className: "max-w-80" },
        header: t("customers.rideColumns.route"),
        cell: ({ row }) => (
          <span className="block truncate">
            {row.original.pickup.address.split(",")[0]} →{" "}
            {row.original.dropoff.address.split(",")[0]}
          </span>
        ),
      },
      {
        id: "finalFareCents",
        enableSorting: true,
        meta: { label: t("customers.rideColumns.fare"), className: "text-right tabular-nums" },
        header: t("customers.rideColumns.fare"),
        cell: ({ row }) => f.eur(row.original.finalFareCents ?? row.original.estimatedFareCents),
      },
      {
        id: "status",
        meta: { label: t("customers.rideColumns.status") },
        header: t("customers.rideColumns.status"),
        cell: ({ row }) => <StatusBadge kind="ride" value={row.original.status} />,
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      tableId="customer-rides"
      caption={t("customers.tabs.rides")}
      columns={columns}
      data={query.data}
      isPending={query.isPending}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => query.refetch()}
      sort={sort}
      onSortChange={(v) => (setSort(v), setPage(1))}
      pageSize={size}
      onPageChange={setPage}
      onPageSizeChange={(s) => (setSize(s), setPage(1))}
      getRowId={(r) => r.id}
      onOpenRow={(r) => router.push(`/rides/${r.id}`)}
      emptyTitle={t("customers.noRides")}
      mobileCard={(r) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium tabular-nums">{r.id}</span>
            <StatusBadge kind="ride" value={r.status} />
          </div>
          <span className="text-caption">
            {f.dateTime(r.bookedAt)} · {f.eur(r.finalFareCents ?? r.estimatedFareCents)}
          </span>
        </div>
      )}
    />
  );
}

function CustomerNotes({ customerId, notes }: { customerId: string; notes: AdminNote[] }) {
  const t = useTranslations();
  const mutation = useServiceMutation({
    mutationFn: (value: string) => addCustomerNote(customerId, value),
    invalidate: [qk.customers.detail(customerId), qk.audit.all],
    onSuccess: () => toast.success(t("customers.noteAdded")),
    onError: (error) =>
      toast.error(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`)),
  });
  return (
    <NotesCard
      module="customers"
      notes={notes}
      placeholder={t("customers.notePlaceholder")}
      addLabel={t("customers.actions.addNote")}
      emptyLabel={t("customers.noNotes")}
      onAdd={(text) => mutation.mutateAsync(text)}
    />
  );
}

function CustomerActivity({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const query = useAuditLogs({
    page: 1,
    pageSize: 50,
    resourceId: customerId,
    resourceType: ["customer"],
  });
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return (
    <Card>
      <CardContent>
        {query.isPending ? (
          <p className="text-dense text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <Timeline
            items={query.data.items.map((a) => {
              // Message keys cannot contain "." — "customer.suspend" → "customer_suspend".
              const key = `customers.activityActions.${a.action.replace(".", "_")}`;
              return {
                id: a.id,
                title: t.has(key as Parameters<typeof t>[0])
                  ? t(key as Parameters<typeof t>[0])
                  : a.action,
                at: a.at,
                by: a.adminName,
                description: a.reason,
                tone: a.action.endsWith("suspend")
                  ? "danger"
                  : a.action.endsWith("reactivate")
                    ? "success"
                    : "default",
              };
            })}
          />
        )}
      </CardContent>
    </Card>
  );
}
