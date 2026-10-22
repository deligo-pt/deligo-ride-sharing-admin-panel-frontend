"use client";

import { Ban, Building2, Check, ChevronDown, FileX, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { FleetManager } from "@/types/fleet";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleetManager, useFleetOnboardingCheck } from "@/hooks/queries/fleet";
import { useRouter } from "@/i18n/navigation";
import { isServiceError } from "@/lib/service-error";
import { useFleetActions } from "./fleet-actions";
import { FleetActivityTab } from "./fleet-activity-tab";
import { FleetCompanyTab } from "./fleet-company-tab";
import { FleetDocumentsTab } from "./fleet-documents-tab";
import { FleetDriversTab } from "./fleet-drivers-tab";
import { FleetPerformanceTab } from "./fleet-performance-tab";
import { FleetSettlementsTab } from "./fleet-settlements-tab";
import { FleetVehiclesTab } from "./fleet-vehicles-tab";

/**
 * Fleet manager detail (§7): Company & contact · Documents · Drivers ·
 * Vehicles · Performance · Statements & settlements · Activity. A tab shows
 * only when the role may open what it reads (documents, drivers, vehicles,
 * commission or payouts); `?tab=` of a hidden tab falls back to the first.
 */
const TABS = [
  "company",
  "documents",
  "drivers",
  "vehicles",
  "performance",
  "settlements",
  "activity",
] as const;
type Tab = (typeof TABS)[number];
const TAB_MODULES = {
  documents: ["documents"],
  drivers: ["drivers"],
  vehicles: ["vehicles"],
  settlements: ["commission", "payouts"],
} as const;

export function FleetDetail({ id }: { id: string }) {
  const t = useTranslations("fleet");
  const router = useRouter();
  const allowed = usePermission();
  const query = useFleetManager(id);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("company").withOptions({ history: "replace" }),
  );
  const actions = useFleetActions();

  const tabs = TABS.filter((key) => {
    const modules = key in TAB_MODULES ? TAB_MODULES[key as keyof typeof TAB_MODULES] : undefined;
    return !modules || modules.some((m) => allowed(m, "view"));
  });
  const currentTab: Tab = tabs.includes(tab) ? tab : "company";

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    if (isServiceError(query.error) && query.error.code === "NOT_FOUND") {
      return (
        <EmptyState
          icon={Building2}
          title={t("notFound")}
          action={
            <Button variant="outline" size="sm" onClick={() => router.push("/fleet-managers")}>
              {t("backToList")}
            </Button>
          }
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const fl = query.data;
  const canApprove = allowed("fleet", "approve");
  const canSuspend = allowed("fleet", "suspend");
  const awaitingOnboarding = fl.verification === "PENDING" || fl.verification === "REJECTED";
  const suspended = fl.accountStatus !== "ACTIVE";

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        backHref="/fleet-managers"
        backLabel={t("backToList")}
        title={fl.companyName}
        subtitle={`${fl.contactName} · ${fl.id}`}
        badges={
          <>
            <StatusBadge kind="fleetVerification" value={fl.verification} />
            <StatusBadge kind="account" value={fl.accountStatus} />
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && awaitingOnboarding && (
              <ApproveButton fleet={fl} onClick={() => actions.open.approve(fl)} />
            )}
            {(canApprove || canSuspend) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {t("actions.more")}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {canApprove && fl.verification === "PENDING" && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => actions.open.reject(fl)}
                    >
                      <FileX />
                      {t("actions.reject")}
                    </DropdownMenuItem>
                  )}
                  {canSuspend &&
                    (suspended ? (
                      <DropdownMenuItem onSelect={() => actions.open.status(fl)}>
                        <RotateCcw />
                        {t("actions.reactivate")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => actions.open.status(fl)}
                      >
                        <Ban />
                        {t("actions.suspend")}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
      />

      {canApprove && awaitingOnboarding && <UnmetDocuments fleetId={fl.id} />}

      <Tabs value={currentTab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="max-w-full overflow-x-auto">
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="company" className="mt-4">
          <FleetCompanyTab fleet={fl} />
        </TabsContent>
        {tabs.includes("documents") && (
          <TabsContent value="documents" className="mt-4">
            <FleetDocumentsTab fleetId={fl.id} />
          </TabsContent>
        )}
        {tabs.includes("drivers") && (
          <TabsContent value="drivers" className="mt-4">
            <FleetDriversTab fleetId={fl.id} />
          </TabsContent>
        )}
        {tabs.includes("vehicles") && (
          <TabsContent value="vehicles" className="mt-4">
            <FleetVehiclesTab fleetId={fl.id} />
          </TabsContent>
        )}
        <TabsContent value="performance" className="mt-4">
          <FleetPerformanceTab fleetId={fl.id} />
        </TabsContent>
        {tabs.includes("settlements") && (
          <TabsContent value="settlements" className="mt-4">
            <FleetSettlementsTab fleetId={fl.id} />
          </TabsContent>
        )}
        <TabsContent value="activity" className="mt-4">
          <FleetActivityTab fleet={fl} />
        </TabsContent>
      </Tabs>
      {actions.dialogs}
    </div>
  );
}

/** "Approve onboarding", disabled — with the reason shown next to it — while a company document isn't valid. */
function ApproveButton({ fleet, onClick }: { fleet: FleetManager; onClick: () => void }) {
  const t = useTranslations("fleet.actions");
  const check = useFleetOnboardingCheck(fleet.id);
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

function UnmetDocuments({ fleetId }: { fleetId: string }) {
  const t = useTranslations("fleet.onboarding");
  const label = useRequirementLabel();
  const stateLabel = useRequirementStateLabel();
  const check = useFleetOnboardingCheck(fleetId);
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
