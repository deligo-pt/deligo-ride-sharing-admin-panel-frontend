"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { DocumentType } from "@/types/document";
import type { DriverListItem } from "@/types/driver";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFleetManagers } from "@/hooks/queries/fleet";
import { useDriverSuspensionCheck } from "@/hooks/queries/drivers";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import {
  assignDriverFleet,
  approveDriver,
  reactivateDriver,
  rejectDriver,
  requestDocumentResubmission,
  suspendDriver,
} from "@/services/drivers";

/** Every query a driver action can change: the driver, the documents queue, the dashboard counts, the audit trail. */
const INVALIDATE = [
  qk.drivers.all,
  qk.documents.all,
  qk.dashboard.all,
  qk.audit.all,
  qk.fleet.all,
  qk.vehicles.all,
];

type Target = Pick<
  DriverListItem,
  "id" | "name" | "verification" | "accountStatus" | "fleetManagerId" | "documents"
>;

const NO_FLEET = "none";

/**
 * The sensitive driver actions, shared by the list's row menu and the detail
 * page (§G pattern: ReasonDialog → mutation → invalidate → toast; the service
 * writes the audit entry). `dialogs` goes once in the page; call
 * `open.<action>(driver)` from a button or menu item.
 *
 * - suspend / reactivate: reason; suspend is blocked on an active ride and the
 *   dialog says so before the admin types (like customers, §5).
 * - approve ("Mark eligible"): confirm only; the service refuses while a
 *   mandatory document isn't valid (the page disables the button first).
 * - reject, request resubmission, change fleet: reason.
 */
export function useDriverActions() {
  const t = useTranslations("drivers");
  const tError = useTranslations("feedback.errors");
  const [status, setStatus] = useState<Target | null>(null);
  const [approve, setApprove] = useState<Target | null>(null);
  const [reject, setReject] = useState<Target | null>(null);
  const [resubmit, setResubmit] = useState<Target | null>(null);
  const [fleet, setFleet] = useState<Target | null>(null);

  const suspending = status ? status.accountStatus === "ACTIVE" : true;
  const check = useDriverSuspensionCheck(status?.id, status !== null && suspending);

  const fail = (error: unknown) => {
    // Reason errors show inside the dialog; the rest as a toast.
    if (isServiceError(error) && error.field === "reason") return;
    if (isServiceError(error) && error.field === "activeRide") {
      void check.refetch();
      return;
    }
    if (isServiceError(error) && error.field === "eligibility")
      return void toast.error(t("eligibility.refused"));
    toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN"));
  };

  const statusMutation = useServiceMutation({
    mutationFn: (v: { id: string; suspend: boolean; reason: string }) =>
      v.suspend ? suspendDriver(v.id, v.reason) : reactivateDriver(v.id, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (driver, v) =>
      toast.success(
        t(v.suspend ? "actions.suspended" : "actions.reactivated", { name: driver.name }),
      ),
    onError: fail,
  });
  const approveMutation = useServiceMutation({
    mutationFn: (id: string) => approveDriver(id),
    invalidate: INVALIDATE,
    onSuccess: (driver) => toast.success(t("actions.approved", { name: driver.name })),
    onError: fail,
  });
  const rejectMutation = useServiceMutation({
    mutationFn: (v: { id: string; reason: string }) => rejectDriver(v.id, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (driver) => toast.success(t("actions.rejected", { name: driver.name })),
    onError: fail,
  });
  const resubmitMutation = useServiceMutation({
    mutationFn: (v: { id: string; types: DocumentType[]; reason: string }) =>
      requestDocumentResubmission(v.id, v.types, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (driver) => toast.success(t("actions.resubmissionRequested", { name: driver.name })),
    onError: fail,
  });
  const fleetMutation = useServiceMutation({
    mutationFn: (v: { id: string; fleetManagerId: string | null; reason: string }) =>
      assignDriverFleet(v.id, v.fleetManagerId, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (driver) => toast.success(t("actions.fleetChanged", { name: driver.name })),
    onError: fail,
  });

  const dialogs = (
    <>
      <ReasonDialog
        key={`status-${status?.id ?? ""}`}
        open={status !== null}
        onOpenChange={(open) => !open && setStatus(null)}
        title={t(suspending ? "actions.suspendTitle" : "actions.reactivateTitle", {
          name: status?.name ?? "",
        })}
        description={t(suspending ? "actions.suspendBody" : "actions.reactivateBody")}
        confirmLabel={t(suspending ? "actions.suspend" : "actions.reactivate")}
        destructive={suspending}
        blocked={
          suspending && check.data?.activeRideId
            ? t("actions.blockedActiveRide", { ride: check.data.activeRideId })
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
        title={t("actions.approveTitle", { name: approve?.name ?? "" })}
        description={t("actions.approveBody")}
        confirmLabel={t("actions.approve")}
        onConfirm={() => approveMutation.mutateAsync(approve!.id)}
      />
      <ReasonDialog
        key={`reject-${reject?.id ?? ""}`}
        open={reject !== null}
        onOpenChange={(open) => !open && setReject(null)}
        title={t("actions.rejectTitle", { name: reject?.name ?? "" })}
        description={t("actions.rejectBody")}
        confirmLabel={t("actions.reject")}
        destructive
        onConfirm={(reason) => rejectMutation.mutateAsync({ id: reject!.id, reason })}
      />
      {resubmit && (
        <ResubmitDialog
          key={`resubmit-${resubmit.id}`}
          target={resubmit}
          onClose={() => setResubmit(null)}
          onConfirm={(types, reason) =>
            resubmitMutation.mutateAsync({ id: resubmit.id, types, reason })
          }
        />
      )}
      {fleet && (
        <FleetDialog
          key={`fleet-${fleet.id}`}
          target={fleet}
          onClose={() => setFleet(null)}
          onConfirm={(fleetManagerId, reason) =>
            fleetMutation.mutateAsync({ id: fleet.id, fleetManagerId, reason })
          }
        />
      )}
    </>
  );

  return {
    dialogs,
    open: {
      status: setStatus,
      approve: setApprove,
      reject: setReject,
      resubmit: setResubmit,
      fleet: setFleet,
    },
  };
}

/** Which documents the driver must send again, and why. */
function ResubmitDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: Target;
  onClose: () => void;
  onConfirm: (types: DocumentType[], reason: string) => Promise<unknown>;
}) {
  const t = useTranslations();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const docs = target.documents;
  return (
    <ReasonDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("drivers.actions.resubmitTitle", { name: target.name })}
      description={t("drivers.actions.resubmitBody")}
      confirmLabel={t("drivers.actions.resubmit")}
      checking={false}
      blocked={docs.length === 0 ? t("drivers.actions.noDocuments") : undefined}
      extra={
        <fieldset className="flex flex-col gap-2">
          <legend className="text-dense mb-1 font-medium">
            {t("drivers.actions.resubmitWhich")}
          </legend>
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2">
              <Checkbox
                id={`resubmit-${doc.id}`}
                checked={types.includes(doc.type)}
                onCheckedChange={(on) =>
                  setTypes((current) =>
                    on ? [...current, doc.type] : current.filter((x) => x !== doc.type),
                  )
                }
              />
              <Label htmlFor={`resubmit-${doc.id}`} className="text-dense font-normal">
                {t(`enums.documentType.${doc.type}`)}
              </Label>
            </div>
          ))}
          {types.length === 0 && (
            <p className="text-caption">{t("drivers.actions.resubmitPick")}</p>
          )}
        </fieldset>
      }
      onConfirm={async (reason) => {
        if (types.length === 0) {
          toast.error(t("drivers.actions.resubmitPick"));
          throw new Error("no documents picked");
        }
        await onConfirm(types, reason);
      }}
    />
  );
}

/** Pick the new fleet (or independent) and say why. Only approved, active fleets are offered. */
function FleetDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: Target;
  onClose: () => void;
  onConfirm: (fleetManagerId: string | null, reason: string) => Promise<unknown>;
}) {
  const t = useTranslations("drivers");
  const [value, setValue] = useState(target.fleetManagerId ?? NO_FLEET);
  const fleets = useFleetManagers({
    page: 1,
    pageSize: 100,
    verification: ["APPROVED"],
    accountStatus: ["ACTIVE"],
    sort: "companyName:asc",
  });
  const unchanged = value === (target.fleetManagerId ?? NO_FLEET);
  return (
    <ReasonDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("actions.fleetTitle", { name: target.name })}
      description={t("actions.fleetBody")}
      confirmLabel={t("actions.fleetSave")}
      blocked={unchanged ? t("actions.fleetUnchanged") : undefined}
      checking={fleets.isPending}
      extra={
        <div className="flex flex-col gap-2">
          <Label htmlFor="driver-fleet-select">{t("actions.fleetLabel")}</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id="driver-fleet-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FLEET}>{t("actions.independent")}</SelectItem>
              {fleets.data?.items.map((fleet) => (
                <SelectItem key={fleet.id} value={fleet.id}>
                  {fleet.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      onConfirm={(reason) => onConfirm(value === NO_FLEET ? null : value, reason)}
    />
  );
}
