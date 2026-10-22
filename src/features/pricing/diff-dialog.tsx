"use client";

import { useTranslations } from "next-intl";
import type { PricingRule } from "@/types/pricing";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { useBandLabel } from "./band-label";
import { MONEY_FIELDS } from "./pricing-utils";

/**
 * "What changed" between a version and the one before it (§11 audit trail):
 * every setting side by side, the ones that differ highlighted.
 */
export function DiffDialog({
  rule,
  previous,
  onClose,
}: {
  rule: PricingRule;
  previous?: PricingRule;
  onClose: () => void;
}) {
  const t = useTranslations("pricing");
  const tc = useTranslations("enums.rideCategory");
  const f = useFormat();
  const bandLabel = useBandLabel();

  const surge = (r: PricingRule) =>
    r.surge.enabled ? t("active.surgeOn", { max: r.surge.maxMultiplier }) : t("active.surgeOff");
  const bands = (r: PricingRule) => (r.timeBands.length ? r.timeBands.map(bandLabel).join("\n") : t("active.noBands"));
  const rows: { key: string; label: string; before?: string; after: string }[] = [
    ...MONEY_FIELDS.map((key) => ({
      key,
      label: t(`fields.${key}`),
      before: previous ? f.eur(previous[key]) : undefined,
      after: f.eur(rule[key]),
    })),
    { key: "vatRate", label: t("fields.vatRate"), before: previous && f.percent(previous.vatRate, 0), after: f.percent(rule.vatRate, 0) },
    { key: "surge", label: t("fields.surge"), before: previous && surge(previous), after: surge(rule) },
    { key: "timeBands", label: t("fields.timeBands"), before: previous && bands(previous), after: bands(rule) },
  ];
  const changed = previous ? rows.filter((r) => r.before !== r.after).length : 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("diff.title", { category: tc(rule.category), n: rule.version })}
          </DialogTitle>
          <DialogDescription>
            {previous
              ? t("diff.compared", { previous: previous.version, changed })
              : t("diff.noPrevious")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("diff.setting")}</TableHead>
                {previous && <TableHead>{t("diff.before", { n: previous.version })}</TableHead>}
                <TableHead>{t("diff.after", { n: rule.version })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const differs = previous && row.before !== row.after;
                return (
                  <TableRow key={row.key} data-changed={differs ? "true" : undefined} className={cn(differs && "bg-warning-soft/60")}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    {previous && <TableCell className="tabular whitespace-pre-line">{row.before}</TableCell>}
                    <TableCell className={cn("tabular whitespace-pre-line", differs && "font-semibold")}>
                      {row.after}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {rule.changeReason && (
          <p className="text-dense text-muted-foreground">
            {t("diff.reason")}: {rule.changeReason}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
