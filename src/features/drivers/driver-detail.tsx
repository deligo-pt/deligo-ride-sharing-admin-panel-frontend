"use client";

import { Ban, Check, ChevronDown, FileX, Pencil, RotateCcw, RotateCw, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { DriverListItem } from "@/types/driver";
import { StatusBadge } from "@/components/badges/status-badge";
import { DetailHeader } from "@/components/detail/detail-parts";
import {
  useRequirementLabel,
  useRequirementStateLabel,
} from "@/components/detail/requirements-card";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { usePermission } from "@/components/session/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDriver, useDriverEligibility } from "@/hooks/queries/drivers";
import { useRouter } from "@/i18n/navigation";
import { isServiceError } from "@/lib/service-error";
import { initials } from "@/lib/utils";
import { useDriverActions } from "./driver-actions";
import { DriverDocumentsTab } from "./driver-documents-tab";
import { DriverEarningsTab } from "./driver-earnings-tab";
import { DriverFleetTab } from "./driver-fleet-tab";
import { DriverHistoryTab } from "./driver-history-tab";
import { DriverProfileTab } from "./driver-profile-tab";
import { DriverRidesTab } from "./driver-rides-tab";
import { DriverSupportTab } from "./driver-support-tab";

/**
 * Driver detail (§6): Profile · Documents · Rides & performance · Earnings &
 * payouts · Fleet & vehicle · Complaints & incidents · History. A tab shows
 * only when the role may open the module it reads (rides, documents,
 * payouts, support); `?tab=` of a hidden tab falls back to Profile.
 */
const TABS = ["profile", "documents", "rides", "earnings", "fleet", "support", "history"] as const;
type Tab = (typeof TABS)[number];
const TAB_MODULE = {
  documents: "documents",
  rides: "rides",
  earnings: "payouts",
  support: "support",
} as const;

/** Verification states the "Mark eligible" / "Reject" actions apply to. */
const REVIEWABLE = ["UNDER_REVIEW", "PENDING_DOCS", "REJECTED"];

export function DriverDetail({ id }: { id: string }) {
  const t = useTranslations("drivers");
  const router = useRouter();
  const allowed = usePermission();
  const query = useDriver(id);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("profile").withOptions({ history: "replace" }),
  );
  const actions = useDriverActions();

  const tabs = TABS.filter((key) => {
    const tabModule = key in TAB_MODULE ? TAB_MODULE[key as keyof typeof TAB_MODULE] : undefined;
    return !tabModule || allowed(tabModule, "view");
  });
  const currentTab: Tab = tabs.includes(tab) ? tab : "profile";

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    if (isServiceError(query.error) && query.error.code === "NOT_FOUND") {
      return (
        <EmptyState
          icon={UserX}
          title={t("notFound")}
          action={
            <Button variant="outline" size="sm" onClick={() => router.push("/drivers")}>
              {t("backToList")}
            </Button>
          }
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const d = query.data;
  const canApprove = allowed("drivers", "approve");
  const canSuspend = allowed("drivers", "suspend");
  const canEdit = allowed("drivers", "edit");
  const reviewable = REVIEWABLE.includes(d.verification);
  const suspended = d.accountStatus !== "ACTIVE";

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        backHref="/drivers"
        backLabel={t("backToList")}
        title={
          <span className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarImage src={d.photoUrl} alt="" />
              <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
                {initials(d.name)}
              </AvatarFallback>
            </Avatar>
            {d.name}
          </span>
        }
        subtitle={d.id}
        badges={
          <>
            <StatusBadge kind="driverVerification" value={d.verification} />
            <StatusBadge kind="account" value={d.accountStatus} />
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && reviewable && (
              <MarkEligibleButton driver={d} onClick={() => actions.open.approve(d)} />
            )}
            {(canApprove || canEdit || canSuspend) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {t("actions.more")}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {canApprove && (
                    <DropdownMenuItem
                      disabled={d.documents.length === 0}
                      onSelect={() => actions.open.resubmit(d)}
                    >
                      <RotateCw />
                      {t("actions.resubmit")}
                    </DropdownMenuItem>
                  )}
                  {canApprove &&
                    (d.verification === "UNDER_REVIEW" || d.verification === "PENDING_DOCS") && (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => actions.open.reject(d)}
                      >
                        <FileX />
                        {t("actions.reject")}
                      </DropdownMenuItem>
                    )}
                  {canEdit && (
                    <DropdownMenuItem onSelect={() => actions.open.fleet(d)}>
                      <Pencil />
                      {t("actions.changeFleet")}
                    </DropdownMenuItem>
                  )}
                  {canSuspend && (canApprove || canEdit) && <DropdownMenuSeparator />}
                  {canSuspend &&
                    (suspended ? (
                      <DropdownMenuItem onSelect={() => actions.open.status(d)}>
                        <RotateCcw />
                        {t("actions.reactivate")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => actions.open.status(d)}
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

      {canApprove && reviewable && <UnmetRequirements driverId={d.id} />}

      <Tabs value={currentTab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="max-w-full overflow-x-auto">
          {tabs.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <DriverProfileTab driver={d} />
        </TabsContent>
        {tabs.includes("documents") && (
          <TabsContent value="documents" className="mt-4">
            <DriverDocumentsTab driver={d} onResubmit={() => actions.open.resubmit(d)} />
          </TabsContent>
        )}
        {tabs.includes("rides") && (
          <TabsContent value="rides" className="mt-4">
            <DriverRidesTab driver={d} />
          </TabsContent>
        )}
        {tabs.includes("earnings") && (
          <TabsContent value="earnings" className="mt-4">
            <DriverEarningsTab driverId={d.id} />
          </TabsContent>
        )}
        <TabsContent value="fleet" className="mt-4">
          <DriverFleetTab driver={d} onChangeFleet={() => actions.open.fleet(d)} />
        </TabsContent>
        {tabs.includes("support") && (
          <TabsContent value="support" className="mt-4">
            <DriverSupportTab driverId={d.id} />
          </TabsContent>
        )}
        <TabsContent value="history" className="mt-4">
          <DriverHistoryTab driver={d} />
        </TabsContent>
      </Tabs>
      {actions.dialogs}
    </div>
  );
}

/** "Mark eligible", disabled — with the reason next to it — while a mandatory document isn't valid (§6). */
function MarkEligibleButton({ driver, onClick }: { driver: DriverListItem; onClick: () => void }) {
  const t = useTranslations("drivers.actions");
  const eligibility = useDriverEligibility(driver.id);
  const blocked = !eligibility.data?.eligible;
  return (
    <Button
      onClick={onClick}
      disabled={blocked}
      aria-describedby={blocked && eligibility.data ? "unmet-requirements" : undefined}
    >
      <Check />
      {t("approve")}
    </Button>
  );
}

function UnmetRequirements({ driverId }: { driverId: string }) {
  const t = useTranslations("drivers.eligibility");
  const label = useRequirementLabel();
  const stateLabel = useRequirementStateLabel();
  const eligibility = useDriverEligibility(driverId);
  const unmet = eligibility.data?.requirements.filter((r) => r.state !== "OK") ?? [];
  if (!eligibility.data || unmet.length === 0) return null;
  return (
    <InlineAlert tone="warning">
      <div id="unmet-requirements" className="flex flex-col gap-1.5">
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
