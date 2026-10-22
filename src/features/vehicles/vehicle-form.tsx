"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
// zod/mini: same validation, ~100 kB gz less than "zod" (§G — always use zod/mini in forms).
import * as z from "zod/mini";
import type { RideCategory, VehicleColour, VehicleListItem, VehicleType } from "@/types/vehicle";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useFleetManagers } from "@/hooks/queries/fleet";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { Link, useRouter } from "@/i18n/navigation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { createVehicle, updateVehicle } from "@/services/vehicles";

/**
 * FORM PAGE TEMPLATE (§P5, §G) — copy for create/edit pages. This form does
 * both: pass `vehicle` to edit (plate, model, category, insurance… — the
 * driver is assigned from the vehicle page and the fleet follows the driver,
 * so neither is editable here):
 * zod schema with translated messages → react-hook-form (Controller for
 * Select/Switch) → `useServiceMutation` → server errors mapped onto fields
 * with `setError` (ServiceError.field / code) → toast + navigate. The submit
 * button is disabled while saving.
 */
const COLOURS: VehicleColour[] = [
  "BLACK",
  "WHITE",
  "GREY",
  "SILVER",
  "BLUE",
  "RED",
  "GREEN",
  "BEIGE",
];
const CATEGORIES: RideCategory[] = ["ECONOMY", "COMFORT", "PREMIUM"];
const TYPES: VehicleType[] = ["Sedan", "Hatchback", "SUV", "Micro"];
const PLATE =
  /^([A-Z]{2}-\d{2}-[A-Z]{2}|\d{2}-[A-Z]{2}-\d{2}|\d{2}-\d{2}-[A-Z]{2}|[A-Z]{2}-\d{2}-\d{2})$/;
const NO_FLEET = "none";

export function VehicleForm({ vehicle }: { vehicle?: VehicleListItem }) {
  const t = useTranslations();
  const router = useRouter();
  const fleets = useFleetManagers({
    page: 1,
    pageSize: 100,
    verification: ["APPROVED"],
    accountStatus: ["ACTIVE"],
    sort: "companyName:asc",
  });
  const thisYear = new Date().getFullYear();

  const schema = useMemo(() => {
    const required = t("vehicles.form.errors.required");
    const yearMsg = t("vehicles.form.errors.year", { min: thisYear - 7, max: thisYear + 1 });
    const seatsMsg = t("vehicles.form.errors.seats");
    const text = () => z.string().check(z.trim(), z.minLength(1, required));
    return z.object({
      plate: z
        .string()
        .check(z.trim(), z.toUpperCase(), z.regex(PLATE, t("vehicles.form.errors.plate"))),
      make: text(),
      model: text(),
      year: z
        .number(required)
        .check(z.int(yearMsg), z.minimum(thisYear - 7, yearMsg), z.maximum(thisYear + 1, yearMsg)),
      colour: z.enum(COLOURS),
      category: z.enum(CATEGORIES),
      type: z.enum(TYPES),
      seats: z
        .number(required)
        .check(z.int(seatsMsg), z.minimum(1, seatsMsg), z.maximum(8, seatsMsg)),
      electric: z.boolean(),
      fleetManagerId: z.string(),
      insurer: text(),
      policyNo: text(),
      insuranceExpires: z.string().check(z.minLength(1, required)),
      inspectionExpires: z.string().check(z.minLength(1, required)),
    });
  }, [t, thisYear]);
  type Values = z.infer<typeof schema>;

  const dateInput = (iso: string) => iso.slice(0, 10);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: vehicle
      ? {
          plate: vehicle.plate,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          colour: vehicle.colour,
          category: vehicle.category,
          type: vehicle.type,
          seats: vehicle.seats,
          electric: vehicle.electric,
          fleetManagerId: vehicle.fleetManagerId ?? NO_FLEET,
          insurer: vehicle.insurance.insurer,
          policyNo: vehicle.insurance.policyNo,
          insuranceExpires: dateInput(vehicle.insurance.expiresAt),
          inspectionExpires: dateInput(vehicle.inspection.expiresAt),
        }
      : {
          plate: "",
          make: "",
          model: "",
          year: thisYear,
          colour: "BLACK",
          category: "ECONOMY",
          type: "Sedan",
          seats: 4,
          electric: false,
          fleetManagerId: NO_FLEET,
          insurer: "",
          policyNo: "",
          insuranceExpires: "",
          inspectionExpires: "",
        },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const err = (name: keyof Values) => formState.errors[name]?.message;

  const mutation = useServiceMutation({
    mutationFn: (v: Values) => {
      const input = {
        plate: v.plate,
        make: v.make,
        model: v.model,
        year: v.year,
        colour: v.colour,
        category: v.category,
        type: v.type,
        seats: v.seats,
        electric: v.electric,
        fleetManagerId: v.fleetManagerId === NO_FLEET ? undefined : v.fleetManagerId,
        insurance: {
          insurer: v.insurer,
          policyNo: v.policyNo,
          expiresAt: new Date(`${v.insuranceExpires}T23:59:00`).toISOString(),
        },
        inspection: { expiresAt: new Date(`${v.inspectionExpires}T23:59:00`).toISOString() },
      };
      return vehicle ? updateVehicle(vehicle.id, input) : createVehicle(input);
    },
    invalidate: [qk.vehicles.all, qk.fleet.all, qk.audit.all],
    onSuccess: (saved) => {
      toast.success(
        t(vehicle ? "vehicles.form.updated" : "vehicles.form.created", { plate: saved.plate }),
      );
      router.push(vehicle ? `/vehicles/${saved.id}` : "/vehicles");
    },
    onError: (error, v) => {
      if (isServiceError(error)) {
        if (error.field === "plate" && error.code === "CONFLICT")
          return setError("plate", { message: t("vehicles.form.errors.plateTaken") });
        if (error.field && error.field in v)
          return setError(error.field as keyof Values, { message: error.message });
      }
      toast.error(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`));
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      className="flex max-w-4xl flex-col gap-6"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">
          {t(vehicle ? "vehicles.form.editTitle" : "vehicles.form.title", {
            plate: vehicle?.plate ?? "",
          })}
        </h1>
        <p className="text-dense text-muted-foreground">
          {t(vehicle ? "vehicles.form.editSubtitle" : "vehicles.form.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("vehicles.form.sections.vehicle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={t("vehicles.form.plate")} error={err("plate")}>
            {(p) => (
              <Input
                {...p}
                {...register("plate")}
                placeholder="AA-12-BB"
                autoCapitalize="characters"
                className="uppercase"
              />
            )}
          </FormField>
          <FormField label={t("vehicles.form.make")} error={err("make")}>
            {(p) => <Input {...p} {...register("make")} />}
          </FormField>
          <FormField label={t("vehicles.form.model")} error={err("model")}>
            {(p) => <Input {...p} {...register("model")} />}
          </FormField>
          <FormField label={t("vehicles.form.year")} error={err("year")}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                {...register("year", { valueAsNumber: true })}
              />
            )}
          </FormField>
          <FormField label={t("vehicles.form.colour")} error={err("colour")}>
            {(p) => (
              <Controller
                control={control}
                name="colour"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOURS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`enums.vehicleColour.${c}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label={t("vehicles.form.category")} error={err("category")}>
            {(p) => (
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`enums.rideCategory.${c}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label={t("vehicles.form.type")} error={err("type")}>
            {(p) => (
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`enums.vehicleType.${c}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
          <FormField label={t("vehicles.form.seats")} error={err("seats")}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                {...register("seats", { valueAsNumber: true })}
              />
            )}
          </FormField>
          <Controller
            control={control}
            name="electric"
            render={({ field }) => (
              <label className="text-dense flex items-center gap-3 self-end pb-2">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                {t("vehicles.form.electric")}
              </label>
            )}
          />
        </CardContent>
      </Card>

      {!vehicle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">
              {t("vehicles.form.sections.assignment")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("vehicles.form.fleet")} error={err("fleetManagerId")}>
              {(p) => (
                <Controller
                  control={control}
                  name="fleetManagerId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...p} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_FLEET}>{t("vehicles.form.independent")}</SelectItem>
                        {fleets.data?.items.map((fl) => (
                          <SelectItem key={fl.id} value={fl.id}>
                            {fl.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">
            {t("vehicles.form.sections.compliance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("vehicles.form.insurer")} error={err("insurer")}>
            {(p) => <Input {...p} {...register("insurer")} placeholder="Fidelidade" />}
          </FormField>
          <FormField label={t("vehicles.form.policyNo")} error={err("policyNo")}>
            {(p) => <Input {...p} {...register("policyNo")} />}
          </FormField>
          <FormField label={t("vehicles.form.insuranceExpires")} error={err("insuranceExpires")}>
            {(p) => <Input {...p} type="date" {...register("insuranceExpires")} />}
          </FormField>
          <FormField label={t("vehicles.form.inspectionExpires")} error={err("inspectionExpires")}>
            {(p) => <Input {...p} type="date" {...register("inspectionExpires")} />}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={vehicle ? `/vehicles/${vehicle.id}` : "/vehicles"}>{t("common.cancel")}</Link>
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? t("dialogs.working")
            : t(vehicle ? "vehicles.form.save" : "vehicles.form.submit")}
        </Button>
      </div>
    </form>
  );
}
