"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { FleetManager } from "@/types/fleet";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { useFleetSuspensionCheck } from "@/hooks/queries/fleet";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { approveFleetManager, rejectFleetManager, setFleetAccountStatus } from "@/services/fleet";

/** What a fleet action can change: the fleet, its drivers (suspension takes them offline), documents, dashboard counts, audit. */
const INVALIDATE = [
  qk.fleet.all,
  qk.drivers.all,
  qk.vehicles.all,
  qk.documents.all,
  qk.dashboard.all,
  qk.audit.all,
];

type Target = Pick<FleetManager, "id" | "companyName" | "accountStatus">;

/**
 * Approve / reject onboarding and suspend / reactivate (§7), shared by the
 * list's row menu and the detail page. Same pattern as customers and drivers:
 * ReasonDialog → mutation → invalidate → toast, audit written by the service.
 * Suspending is refused while one of the fleet's drivers is on a ride, and
 * the dialog says so before the admin writes a reason.
 */
export function useFleetActions() {
  const t = useTranslations("fleet.actions");
  const tError = useTranslations("feedback.errors");
  const [status, setStatus] = useState<Target | null>(null);
  const [approve, setApprove] = useState<Target | null>(null);
  const [reject, setReject] = useState<Target | null>(null);

  const suspending = status ? status.accountStatus === "ACTIVE" : true;
  const check = useFleetSuspensionCheck(status?.id, status !== null && suspending);

  const fail = (error: unknown) => {
    if (isServiceError(error) && error.field === "reason") return;
    if (isServiceError(error) && error.field === "activeRides") return void check.refetch();
    if (isServiceError(error) && error.field === "eligibility")
      return void toast.error(t("onboardingRefused"));
    toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN"));
  };

  const statusMutation = useServiceMutation({
    mutationFn: (v: { id: string; suspend: boolean; reason: string }) =>
      setFleetAccountStatus(v.id, v.suspend ? "SUSPENDED" : "ACTIVE", v.reason),
    invalidate: INVALIDATE,
    onSuccess: (fleet, v) =>
      toast.success(t(v.suspend ? "suspended" : "reactivated", { name: fleet.companyName })),
    onError: fail,
  });
  const approveMutation = useServiceMutation({
    mutationFn: (id: string) => approveFleetManager(id),
    invalidate: INVALIDATE,
    onSuccess: (fleet) => toast.success(t("approved", { name: fleet.companyName })),
    onError: fail,
  });
  const rejectMutation = useServiceMutation({
    mutationFn: (v: { id: string; reason: string }) => rejectFleetManager(v.id, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (fleet) => toast.success(t("rejected", { name: fleet.companyName })),
    onError: fail,
  });

  const activeRides = check.data?.activeRides ?? 0;
  const dialogs = (
    <>
      <ReasonDialog
        key={`status-${status?.id ?? ""}`}
        open={status !== null}
        onOpenChange={(open) => !open && setStatus(null)}
        title={t(suspending ? "suspendTitle" : "reactivateTitle", {
          name: status?.companyName ?? "",
        })}
        description={t(suspending ? "suspendBody" : "reactivateBody")}
        confirmLabel={t(suspending ? "suspend" : "reactivate")}
        destructive={suspending}
        blocked={
          suspending && activeRides > 0
            ? t("blockedActiveRides", { count: activeRides })
            : undefined
        }
        checking={suspending && check.isFetching}
        onConfirm={(reason) =>
          statusMutation.mutateAsync({ id: status!.id, suspend: suspending, reason })
        }
      />
      <ConfirmDialog
        open={approve !== null}
        onOpenChange={(open) => !open && setApprove(null)}
        title={t("approveTitle", { name: approve?.companyName ?? "" })}
        description={t("approveBody")}
        confirmLabel={t("approve")}
        onConfirm={() => approveMutation.mutateAsync(approve!.id)}
      />
      <ReasonDialog
        key={`reject-${reject?.id ?? ""}`}
        open={reject !== null}
        onOpenChange={(open) => !open && setReject(null)}
        title={t("rejectTitle", { name: reject?.companyName ?? "" })}
        description={t("rejectBody")}
        confirmLabel={t("reject")}
        destructive
        onConfirm={(reason) => rejectMutation.mutateAsync({ id: reject!.id, reason })}
      />
    </>
  );

  return { dialogs, open: { status: setStatus, approve: setApprove, reject: setReject } };
}
