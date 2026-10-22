"use client";

import {
  Ban,
  Car,
  Check,
  ChevronDown,
  CircleCheck,
  CirclePause,
  FileX,
  Pencil,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { VehicleListItem } from "@/types/vehicle";
import { StatusBadge } from "@/components/badges/status-badge";
import { DetailHeader } from "@/components/detail/detail-parts";
import {
  useRequirementLabel,
  useRequirementStateLabel,
} from "@/components/detail/requirements-card";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVehicle, useVehicleApprovalCheck } from "@/hooks/queries/vehicles";
import { Link, useRouter } from "@/i18n/navigation";
import { isServiceError } from "@/lib/service-error";
import { useVehicleActions } from "./vehicle-actions";
import { VehicleAssignmentsTab } from "./vehicle-assignments-tab";
import { VehicleDocumentsTab } from "./vehicle-documents-tab";
import { VehicleInfoTab } from "./vehicle-info-tab";

/**
 * Vehicle detail (§8): Info · Documents · Assignment history. Documents show
 * only to roles that may open that module; `?tab=` of a hidden tab falls back
 * to Info.
 */
const TABS = ["info", "documents", "assignments"] as const;
type Tab = (typeof TABS)[number];

export function VehicleDetail({ id }: { id: string }) {
  const t = useTranslations("vehicles");
  const router = useRouter();
  const allowed = usePermission();
  const query = useVehicle(id);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("info").withOptions({ history: "replace" }),
  );
  const actions = useVehicleActions();

  const tabs = TABS.filter((key) => key !== "documents" || allowed("documents", "view"));
  const currentTab: Tab = tabs.includes(tab) ? tab : "info";

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    if (isServiceError(query.error) && query.error.code === "NOT_FOUND") {
      return (
        <EmptyState
          icon={Car}
          title={t("notFound")}
          action={
            <Button variant="outline" size="sm" onClick={() => router.push("/vehicles")}>
              {t("backToList")}
            </Button>
          }
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const v = query.data;
  const canApprove = allowed("vehicles", "approve");
  const canSuspend = allowed("vehicles", "suspend");
  const canEdit = allowed("vehicles", "edit");
  const awaitingApproval = v.approval === "PENDING_REVIEW" || v.approval === "REJECTED";

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        backHref="/vehicles"
        backLabel={t("backToList")}
        title={<span className="tabular">{v.plate}</span>}
        subtitle={`${v.id} · ${v.make} ${v.model} (${v.year})`}
        badges={
          <>
            <StatusBadge kind="vehicleApproval" value={v.approval} />
            <StatusBadge kind="vehicleOperational" value={v.operational} />
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && awaitingApproval && (
              <ApproveButton vehicle={v} onClick={() => actions.open.approve(v)} />
            )}
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/vehicles/${v.id}/edit`}>
                  <Pencil />
                  {t("actions.edit")}
                </Link>
              </Button>
            )}
            {(canApprove || canSuspend || canEdit) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {t("actions.more")}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  {canApprove && v.approval === "PENDING_REVIEW" && (
                    <DropdownMenuItem variant="destructive" onSelect={() => actions.open.reject(v)}>
                      <FileX />
                      {t("actions.reject")}
                    </DropdownMenuItem>
                  )}
                  {canEdit &&
                    (v.driverId ? (
                      <DropdownMenuItem onSelect={() => actions.open.free(v)}>
                        <UserMinus />
                        {t("actions.free")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => actions.open.assign(v)}>
                        <UserPlus />
                        {t("actions.assign")}
                      </DropdownMenuItem>
                    ))}
                  {canSuspend && (canApprove || canEdit) && <DropdownMenuSeparator />}
                  {canSuspend && v.operational !== "ACTIVE" && (
                    <DropdownMenuItem onSelect={() => actions.open.status(v, "ACTIVE")}>
                      <CircleCheck />
                      {t("actions.status.ACTIVE.action")}
                    </DropdownMenuItem>
                  )}
                  {canSuspend && v.operational === "ACTIVE" && (
                    <DropdownMenuItem onSelect={() => actions.open.status(v, "INACTIVE")}>
                      <CirclePause />
                      {t("actions.status.INACTIVE.action")}
                    </DropdownMenuItem>
                  )}
                  {canSuspend && v.operational !== "SUSPENDED" && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => actions.open.status(v, "SUSPENDED")}
                    >
                      <Ban />
                      {t("actions.status.SUSPENDED.action")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {canApprove && awaitingApproval && <UnmetDocuments vehicleId={v.id} />}

      <Tabs value={currentTab} onValueChange={(next) => setTab(next as Tab)}>
        <TabsList className="max-w-full overflow-x-auto">
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <VehicleInfoTab vehicle={v} />
        </TabsContent>
        {tabs.includes("documents") && (
          <TabsContent value="documents" className="mt-4">
            <VehicleDocumentsTab vehicleId={v.id} />
          </TabsContent>
        )}
        <TabsContent value="assignments" className="mt-4">
          <VehicleAssignmentsTab vehicle={v} />
        </TabsContent>
      </Tabs>
      {actions.dialogs}
    </div>
  );
}

/** "Approve", disabled — with the reason shown next to it — while a vehicle document isn't valid (§8). */
function ApproveButton({ vehicle, onClick }: { vehicle: VehicleListItem; onClick: () => void }) {
  const t = useTranslations("vehicles.actions");
  const check = useVehicleApprovalCheck(vehicle.id);
  const blocked = !check.data?.eligible;
  return (
    <Button
      onClick={onClick}
      disabled={blocked}
      aria-describedby={blocked && check.data ? "unmet-documents" : undefined}
    >
      <Check />
      {t("approve")}
    </Button>
  );
}

function UnmetDocuments({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations("vehicles.approvalDocs");
  const label = useRequirementLabel();
  const stateLabel = useRequirementStateLabel();
  const check = useVehicleApprovalCheck(vehicleId);
  const unmet = check.data?.requirements.filter((r) => r.state !== "OK") ?? [];
  if (!check.data || unmet.length === 0) return null;
  return (
    <InlineAlert tone="warning">
      <div id="unmet-documents" className="flex flex-col gap-1.5">
        <p className="font-medium">{t("blockedTitle")}</p>
        <ul className="list-disc pl-5">
          {unmet.map((r) => (
            <li key={r.options.join("|")}>
              {label(r)} — <span className="text-muted-foreground">{stateLabel(r.state)}</span>
            </li>
          ))}
        </ul>
      </div>
    </InlineAlert>
  );
}
