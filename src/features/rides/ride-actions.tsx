"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { RideDetail } from "@/types/ride";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReassignCandidates } from "@/hooks/queries/rides";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { cancelRide, reassignRide } from "@/services/rides";

/** What an intervention changes: rides, drivers (busy/free), live map, dashboard counts, audit. */
const INVALIDATE = [
  qk.rides.all,
  qk.drivers.all,
  qk.live.all,
  qk.dashboard.all,
  qk.audit.all,
  qk.payments.all,
];

type Target = Pick<RideDetail, "id" | "status" | "driverId" | "cancelFeeCents">;

/**
 * The two interventions on a ride that hasn't started (§9): cancel (with the
 * choice to charge or waive the cancellation fee) and reassign to another
 * driver. Same pattern as every sensitive action: ReasonDialog → mutation →
 * invalidate → toast; the service writes the audit entry. Completed rides are
 * never offered these.
 */
export function useRideActions() {
  const t = useTranslations("rides.actions");
  const tError = useTranslations("feedback.errors");
  const [cancel, setCancel] = useState<Target | null>(null);
  const [reassign, setReassign] = useState<Target | null>(null);

  const fail = (error: unknown) => {
    if (isServiceError(error) && (error.field === "reason" || error.field === "driverId")) return;
    toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN"));
  };
  const cancelMutation = useServiceMutation({
    mutationFn: (v: { id: string; reason: string; chargeFee: boolean }) =>
      cancelRide(v.id, v.reason, v.chargeFee),
    invalidate: INVALIDATE,
    onSuccess: (ride) => toast.success(t("cancelled", { id: ride.id })),
    onError: fail,
  });
  const reassignMutation = useServiceMutation({
    mutationFn: (v: { id: string; driverId: string; reason: string }) =>
      reassignRide(v.id, v.driverId, v.reason),
    invalidate: INVALIDATE,
    onSuccess: (ride) =>
      toast.success(t("reassigned", { id: ride.id, driver: ride.driverName ?? "" })),
    onError: fail,
  });

  const dialogs = (
    <>
      {cancel && (
        <CancelDialog
          key={`cancel-${cancel.id}`}
          ride={cancel}
          onClose={() => setCancel(null)}
          onConfirm={(reason, chargeFee) =>
            cancelMutation.mutateAsync({ id: cancel.id, reason, chargeFee })
          }
        />
      )}
      {reassign && (
        <ReassignDialog
          key={`reassign-${reassign.id}`}
          ride={reassign}
          onClose={() => setReassign(null)}
          onConfirm={(driverId, reason) =>
            reassignMutation.mutateAsync({ id: reassign.id, driverId, reason })
          }
        />
      )}
    </>
  );
  return { dialogs, open: { cancel: setCancel, reassign: setReassign } };
}

/** Cancel with a reason and the fee choice: waive (default) or charge the tariff's cancellation fee. */
function CancelDialog({
  ride,
  onClose,
  onConfirm,
}: {
  ride: Target;
  onClose: () => void;
  onConfirm: (reason: string, chargeFee: boolean) => Promise<unknown>;
}) {
  const t = useTranslations("rides.actions");
  const f = useFormat();
  const [fee, setFee] = useState<"waive" | "charge">("waive");
  const canCharge = ride.cancelFeeCents > 0;
  return (
    <ReasonDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("cancelTitle", { id: ride.id })}
      description={t("cancelBody")}
      confirmLabel={t("cancel")}
      destructive
      extra={
        <fieldset className="flex flex-col gap-2">
          <legend className="text-dense mb-1 font-medium">{t("feeLabel")}</legend>
          <RadioGroup
            value={canCharge ? fee : "waive"}
            onValueChange={(v) => setFee(v as "waive" | "charge")}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="waive" id="fee-waive" />
              <Label htmlFor="fee-waive" className="text-dense font-normal">
                {t("feeWaive")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="charge" id="fee-charge" disabled={!canCharge} />
              <Label htmlFor="fee-charge" className="text-dense font-normal">
                {canCharge ? t("feeCharge", { amount: f.eur(ride.cancelFeeCents) }) : t("feeNone")}
              </Label>
            </div>
          </RadioGroup>
        </fieldset>
      }
      onConfirm={(reason) => onConfirm(reason, canCharge && fee === "charge")}
    />
  );
}

/** Pick an available driver (approved, online, free, same category, nearest first) and say why. */
function ReassignDialog({
  ride,
  onClose,
  onConfirm,
}: {
  ride: Target;
  onClose: () => void;
  onConfirm: (driverId: string, reason: string) => Promise<unknown>;
}) {
  const t = useTranslations("rides.actions");
  const f = useFormat();
  const [driverId, setDriverId] = useState("");
  const candidates = useReassignCandidates(ride.id, true);
  const none = candidates.data?.length === 0;
  return (
    <ReasonDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("reassignTitle", { id: ride.id })}
      description={t("reassignBody")}
      confirmLabel={t("reassign")}
      blocked={none ? t("noCandidates") : undefined}
      checking={candidates.isPending}
      extra={
        <div className="flex flex-col gap-2">
          <Label htmlFor="ride-driver-select">{t("driverLabel")}</Label>
          <Select value={driverId} onValueChange={setDriverId} disabled={none}>
            <SelectTrigger id="ride-driver-select" className="w-full">
              <SelectValue placeholder={t("driverPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {candidates.data?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · ★ {f.number(c.rating, { decimals: 1 })}
                  {c.distanceKm !== null && ` · ${f.km(c.distanceKm)}`}
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
