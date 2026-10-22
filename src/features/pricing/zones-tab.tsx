"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Zone } from "@/types/pricing";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { FormField } from "@/components/forms/form-field";
import { MoneyInput } from "@/components/forms/money-input";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/feedback/states";
import { Can } from "@/components/session/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useZones } from "@/hooks/queries/pricing";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { updateZone } from "@/services/pricing";

const TYPE_TONE = { STANDARD: "neutral", SURCHARGE: "warning", RESTRICTED: "danger" } as const;

/**
 * Zone-based pricing (§11): the airport surcharge is a flat amount added to
 * rides that start or end in a SURCHARGE zone; a RESTRICTED zone is an area
 * with access rules (information for dispatch, no fare effect); STANDARD is the
 * city. Editing needs `pricing.modify_pricing` and a reason (audited).
 */
export function ZonesTab() {
  const t = useTranslations("pricing.zones");
  const tError = useTranslations("feedback.errors");
  const locale = useLocale() as "en" | "pt";
  const f = useFormat();
  const query = useZones();
  const [editing, setEditing] = useState<Zone | null>(null);
  const [surcharge, setSurcharge] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const mutation = useServiceMutation({
    mutationFn: (v: { zone: Zone; reason: string }) =>
      updateZone(
        v.zone.id,
        {
          active,
          ...(v.zone.type === "SURCHARGE" ? { surchargeCents: surcharge ?? 0 } : {}),
        },
        v.reason,
      ),
    invalidate: [qk.pricing.zones(), qk.audit.all],
    onSuccess: (zone) => toast.success(t("saved", { name: zone.name[locale] })),
    onError: (error) => {
      if (isServiceError(error) && error.field === "surchargeCents") return setFieldError(error.message);
      if (isServiceError(error) && error.field === "reason") return;
      toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN"));
    },
  });

  const open = (zone: Zone) => {
    setEditing(zone);
    setSurcharge(zone.surchargeCents ?? 0);
    setActive(zone.active);
    setFieldError(null);
  };

  if (query.isPending) return <TableSkeleton rows={8} columns={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data.length === 0) return <EmptyState title={t("empty")} />;

  return (
    <>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead className="text-right">{t("surcharge")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">{t("edit")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((zone) => (
              <TableRow key={zone.id} data-testid={`zone-${zone.id}`}>
                <TableCell className="font-medium">{zone.name[locale]}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_TONE[zone.type]}>{t(`types.${zone.type}`)}</Badge>
                </TableCell>
                <TableCell className="tabular text-right">
                  {zone.type === "SURCHARGE" ? f.eur(zone.surchargeCents ?? 0) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={zone.active ? "success" : "neutral"}>
                    {zone.active ? t("active") : t("inactive")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Can module="pricing" action="modify_pricing">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => open(zone)}
                      aria-label={t("editNamed", { name: zone.name[locale] })}
                    >
                      <Pencil />
                    </Button>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {editing && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={t("editTitle", { name: editing.name[locale] })}
          description={t(`explain.${editing.type}`)}
          confirmLabel={t("save")}
          extra={
            <div className="flex flex-col gap-4">
              {editing.type === "SURCHARGE" && (
                <FormField label={t("surcharge")} hint={t("surchargeHint")} error={fieldError ?? undefined}>
                  {(p) => <MoneyInput {...p} value={surcharge} onChange={setSurcharge} invalid={Boolean(fieldError)} />}
                </FormField>
              )}
              <label className="text-dense flex items-center gap-3">
                <Switch checked={active} onCheckedChange={setActive} />
                {t("activeSwitch")}
              </label>
            </div>
          }
          onConfirm={(reason) => mutation.mutateAsync({ zone: editing, reason }).then(() => setEditing(null))}
        />
      )}
    </>
  );
}
