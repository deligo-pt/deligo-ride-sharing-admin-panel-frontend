"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { VehicleListItem, VehicleOperational } from "@/types/vehicle";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignableDrivers, useVehicleStatusCheck } from "@/hooks/queries/vehicles";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import {
  assignVehicleDriver,
  approveVehicle,
  rejectVehicle,
  setVehicleOperational,
} from "@/services/vehicles";

/** What a vehicle action can change: vehicles, drivers (assignment), fleet counts, documents, dashboard, audit. */
const INVALIDATE = [
  qk.vehicles.all,
  qk.drivers.all,
  qk.fleet.all,
  qk.documents.all,
  qk.dashboard.all,
  qk.audit.all,
];

type Target = Pick<
  VehicleListItem,
  "id" | "plate" | "approval" | "operational" | "insurance" | "driverId" | "driverName"
>;

/**
 * Approve / reject, set active · inactive · suspended, assign or free the
 * driver (§8), shared by the list's row menu and the detail page. Same
 * pattern as drivers and fleets: ReasonDialog → mutation → invalidate →
 * toast, audit written by the service. Each dialog says up front what blocks
 * the action (not approved, insurance expired, ride in progress, no driver
 * available) so the admin never writes a reason for nothing.
 */
export function useVehicleActions() {
  const t = useTranslations("vehicles.actions");
  const tError = useTranslations("feedback.errors");
  const [status, setStatus] = useState<{ vehicle: Target; to: VehicleOperational } | null>(null);
  const [approve, setApprove] = useState<Target | null>(null);
  const [reject, setReject] = useState<Target | null>(null);
  const [assign, setAssign] = useState<Target | null>(null);
  const [free, setFree] = useState<Target | null>(null);

  const leaving = status !== null && status.to !== "ACTIVE";
  const check = useVehicleStatusCheck(status?.vehicle.id, leaving);

  const fail = (error: unknown) => {
    if (isServiceError(error) && error.field === "reason") return;
    if (isServiceError(error) && error.field === "activeRide") return void check.refetch();
    if (isServiceError(error) && error.field === "eligibility")
      return void toast.error(t("approvalRefused"));
    toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN"));
  };

  const statusMutation = useServiceMutation({
    mutationFn: (v: { id: string; to: VehicleOperational; reason: string }) =>
      setVehicleOperational(v.id, v.to, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (vehicle, v) => toast.success(t(`status.${v.to}.done`, { plate: vehicle.plate })),
    onError: fail,
  });
  const approveMutation = useServiceMutation({
    mutationFn: (id: string) => approveVehicle(id),
    invalidate: INVALIDATE,
    onSuccess: (vehicle) => toast.success(t("approved", { plate: vehicle.plate })),
    onError: fail,
  });
  const rejectMutation = useServiceMutation({
    mutationFn: (v: { id: string; reason: string }) => rejectVehicle(v.id, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (vehicle) => toast.success(t("rejected", { plate: vehicle.plate })),
    onError: fail,
  });
  const assignMutation = useServiceMutation({
    mutationFn: (v: { id: string; driverId: string | null; reason: string }) =>
      assignVehicleDriver(v.id, v.driverId, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (vehicle, v) =>
      toast.success(t(v.driverId ? "assigned" : "freed", { plate: vehicle.plate })),
    onError: fail,
  });

  // Why moving to the chosen status is not possible right now, if it isn't.
  const statusBlocked = (() => {
    if (!status) return undefined;
    const { vehicle, to } = status;
    if (to === "ACTIVE") {
      if (vehicle.approval !== "APPROVED") return t("blockedNotApproved");
      if (vehicle.insurance.status === "EXPIRED") return t("blockedInsurance");
      return undefined;
    }
    return check.data?.activeRideId
      ? t("blockedActiveRide", { ride: check.data.activeRideId })
      : undefined;
  })();

  const dialogs = (
    <>
      <ReasonDialog
        key={`status-${status?.vehicle.id ?? ""}-${status?.to ?? ""}`}
        open={status !== null}
        onOpenChange={(open) => !open && setStatus(null)}
        title={status ? t(`status.${status.to}.title`, { plate: status.vehicle.plate }) : ""}
        description={status ? t(`status.${status.to}.body`) : undefined}
        confirmLabel={status ? t(`status.${status.to}.action`) : undefined}
        destructive={status?.to === "SUSPENDED"}
        blocked={statusBlocked}
        checking={leaving && check.isFetching}
        onConfirm={(reason) =>
          statusMutation.mutateAsync({ id: status!.vehicle.id, to: status!.to, reason })
        }
      />
      <ConfirmDialog
        open={approve !== null}
        onOpenChange={(open) => !open && setApprove(null)}
        title={t("approveTitle", { plate: approve?.plate ?? "" })}
        description={t("approveBody")}
        confirmLabel={t("approve")}
        onConfirm={() => approveMutation.mutateAsync(approve!.id)}
      />
      <ReasonDialog
        key={`reject-${reject?.id ?? ""}`}
        open={reject !== null}
        onOpenChange={(open) => !open && setReject(null)}
        title={t("rejectTitle", { plate: reject?.plate ?? "" })}
        description={t("rejectBody")}
        confirmLabel={t("reject")}
        destructive
        onConfirm={(reason) => rejectMutation.mutateAsync({ id: reject!.id, reason })}
      />
      {assign && (
        <AssignDialog
          key={`assign-${assign.id}`}
          vehicle={assign}
          onClose={() => setAssign(null)}
          onConfirm={(driverId, reason) =>
            assignMutation.mutateAsync({ id: assign.id, driverId, reason })
          }
        />
      )}
      <ReasonDialog
        key={`free-${free?.id ?? ""}`}
        open={free !== null}
        onOpenChange={(open) => !open && setFree(null)}
        title={t("freeTitle", { plate: free?.plate ?? "" })}
        description={t("freeBody", { name: free?.driverName ?? "" })}
        confirmLabel={t("free")}
        onConfirm={(reason) => assignMutation.mutateAsync({ id: free!.id, driverId: null, reason })}
      />
    </>
  );

  return {
    dialogs,
    open: {
      status: (vehicle: Target, to: VehicleOperational) => setStatus({ vehicle, to }),
      approve: setApprove,
      reject: setReject,
      assign: setAssign,
      free: setFree,
    },
  };
}

/** Pick an available driver of the vehicle's fleet and say why. Only approved, active vehicles can be assigned. */
function AssignDialog({
  vehicle,
  onClose,
  onConfirm,
}: {
  vehicle: Target;
  onClose: () => void;
  onConfirm: (driverId: string, reason: string) => Promise<unknown>;
}) {
  const t = useTranslations("vehicles.actions");
  const [driverId, setDriverId] = useState("");
  const drivers = useAssignableDrivers(vehicle.id, true);
  const notReady = vehicle.approval !== "APPROVED" || vehicle.operational !== "ACTIVE";
  const none = drivers.data?.length === 0;
  return (
    <ReasonDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("assignTitle", { plate: vehicle.plate })}
      description={t("assignBody")}
      confirmLabel={t("assign")}
      blocked={notReady ? t("blockedNotReady") : none ? t("blockedNoDrivers") : undefined}
      checking={drivers.isPending}
      extra={
        <div className="flex flex-col gap-2">
          <Label htmlFor="vehicle-driver-select">{t("driverLabel")}</Label>
          <Select value={driverId} onValueChange={setDriverId} disabled={notReady || none}>
            <SelectTrigger id="vehicle-driver-select" className="w-full">
              <SelectValue placeholder={t("driverPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {drivers.data?.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name} · {driver.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      onConfirm={async (reason) => {
        if (!driverId) {
          toast.error(t("pickDriver"));
          throw new Error("no driver picked");
        }
        await onConfirm(driverId, reason);
      }}
    />
  );
}
