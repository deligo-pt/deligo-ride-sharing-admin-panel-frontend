"use client";

import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PricingRule } from "@/types/pricing";
import { StatusBadge } from "@/components/badges/status-badge";
import { Can } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { useBandLabel } from "./band-label";
import { MONEY_FIELDS } from "./pricing-utils";

/** One category's fare in force: the figures, surge, time bands, VAT, and who changed it when. */
export function FareSummary({
  rule,
  next,
}: {
  rule: PricingRule;
  /** A version waiting to start for the same category, if any. */
  next?: PricingRule;
}) {
  const t = useTranslations("pricing");
  const tc = useTranslations("enums.rideCategory");
  const f = useFormat();
  const bandLabel = useBandLabel();

  return (
    <Card data-testid={`fare-${rule.category}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-card-title">{tc(rule.category)}</CardTitle>
          <p className="text-caption">
            {t("active.version", { n: rule.version })} · {t("active.since", { date: f.date(rule.effectiveFrom) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge kind="pricing" value={rule.status} />
          <Can module="pricing" action="modify_pricing">
            <Button asChild size="sm" variant="outline">
              <Link href={`/pricing/new?category=${rule.category}`}>
                <Pencil />
                {t("active.newVersion")}
              </Link>
            </Button>
          </Can>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {MONEY_FIELDS.map((key) => (
            <div key={key}>
              <dt className="text-caption">{t(`fields.${key}`)}</dt>
              <dd className="tabular text-dense font-medium">{f.eur(rule[key])}</dd>
            </div>
          ))}
          <div>
            <dt className="text-caption">{t("fields.vatRate")}</dt>
            <dd className="tabular text-dense font-medium">{f.percent(rule.vatRate, 0)}</dd>
          </div>
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-caption">{t("fields.surge")}</p>
            <p className="text-dense">
              {rule.surge.enabled
                ? t("active.surgeOn", { max: rule.surge.maxMultiplier })
                : t("active.surgeOff")}
            </p>
          </div>
          <div>
            <p className="text-caption">{t("fields.timeBands")}</p>
            {rule.timeBands.length === 0 ? (
              <p className="text-dense">{t("active.noBands")}</p>
            ) : (
              <ul className="text-dense flex flex-col gap-0.5">
                {rule.timeBands.map((band, i) => (
                  <li key={i}>{bandLabel(band)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <p className="text-caption">
          {t("active.changedBy", {
            name: rule.changedByName ?? rule.changedBy,
            date: f.dateTime(rule.changedAt),
          })}
          {rule.changeReason && <> · “{rule.changeReason}”</>}
        </p>
        {next && (
          <p className="text-dense rounded-lg bg-info-soft px-3 py-2 text-info">
            {t("active.nextScheduled", { n: next.version, date: f.date(next.effectiveFrom) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
