"use client";

import { Car } from "lucide-react";
import { useTranslations } from "next-intl";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { useVehicle } from "@/hooks/queries/vehicles";
import { useRouter } from "@/i18n/navigation";
import { isServiceError } from "@/lib/service-error";
import { VehicleForm } from "./vehicle-form";

/** Loads the vehicle, then shows the form with its values (the route needs `vehicles.edit`). */
export function EditVehicle({ id }: { id: string }) {
  const t = useTranslations("vehicles");
  const router = useRouter();
  const query = useVehicle(id);
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
  return <VehicleForm vehicle={query.data} />;
}
