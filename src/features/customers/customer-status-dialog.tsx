"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Customer } from "@/types/customer";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { useSuspensionCheck } from "@/hooks/queries/customers";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { useFormat } from "@/lib/use-format";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { reactivateCustomer, suspendCustomer } from "@/services/customers";

/**
 * Suspend / reactivate with a reason — shared by the list's row menu and the
 * detail page. Pattern for every sensitive action (§G):
 * ReasonDialog → useServiceMutation → invalidate → toast (audit is written by
 * the service).
 */
export function useCustomerStatusAction() {
  const t = useTranslations();
  const f = useFormat();
  const [target, setTarget] = useState<Pick<Customer, "id" | "name" | "status"> | null>(null);
  const suspending = target ? target.status !== "SUSPENDED" : true;
  // Ask first whether a ride or an unpaid balance blocks the suspension (§5).
  const check = useSuspensionCheck(target?.id, target !== null && suspending);
  const blocker = check.data?.activeRideId
    ? t("customers.blocked.activeRide", { ride: check.data.activeRideId })
    : check.data && check.data.unpaidCents > 0
      ? t("customers.blocked.unpaidBalance", {
          amount: f.eur(check.data.unpaidCents),
          count: check.data.unpaidCount,
        })
      : undefined;

  const mutation = useServiceMutation({
    mutationFn: (v: { id: string; suspend: boolean; reason: string }) =>
      v.suspend ? suspendCustomer(v.id, v.reason) : reactivateCustomer(v.id, v.reason),
    invalidate: [qk.customers.all, qk.audit.all, qk.dashboard.all],
    onSuccess: (customer, v) =>
      toast.success(
        t(v.suspend ? "customers.suspended" : "customers.reactivated", { name: customer.name }),
      ),
    onError: (error) => {
      // Reason errors show in the dialog; the rest as a toast.
      if (isServiceError(error) && error.field === "reason") return;
      // The rules changed since the dialog opened (a ride started, a charge failed).
      if (
        isServiceError(error) &&
        (error.field === "activeRide" || error.field === "unpaidBalance")
      ) {
        void check.refetch();
        return;
      }
      toast.error(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`));
    },
  });

  const dialog = (
    <ReasonDialog
      open={target !== null}
      onOpenChange={(open) => !open && setTarget(null)}
      title={t(suspending ? "customers.suspendTitle" : "customers.reactivateTitle", {
        name: target?.name ?? "",
      })}
      description={t(suspending ? "customers.suspendBody" : "customers.reactivateBody")}
      confirmLabel={t(suspending ? "customers.actions.suspend" : "customers.actions.reactivate")}
      destructive={suspending}
      blocked={suspending ? blocker : undefined}
      checking={suspending && check.isFetching}
      onConfirm={(reason) => mutation.mutateAsync({ id: target!.id, suspend: suspending, reason })}
    />
  );

  return { open: setTarget, dialog };
}
