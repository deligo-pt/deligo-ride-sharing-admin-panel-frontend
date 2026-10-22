"use client";

import { useTranslations } from "next-intl";
import type { RideDetail } from "@/types/ride";
import { StatusBadge } from "@/components/badges/status-badge";
import { KeyValueGrid } from "@/components/detail/detail-parts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormat } from "@/lib/use-format";

/**
 * Fare (§9 "estimated and final fare calculations"): the quote, the charged
 * amount and the line-by-line breakdown behind it (base, distance, time,
 * waiting, booking fee, airport/zone surcharge, surge, discount, VAT, total).
 * For a completed ride the breakdown is the final one; before that it is the
 * estimate. A cancelled ride shows its cancellation fee, if any. Read-only:
 * the panel never edits fares (§9).
 */
export function RideFareCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail.fare");
  const f = useFormat();
  const b = ride.fareBreakdown;
  const final = ride.finalFareCents;
  const difference =
    final === undefined || ride.status !== "COMPLETED" ? null : final - ride.estimatedFareCents;
  const lines: { key: string; cents: number; show: boolean }[] = [
    { key: "base", cents: b.base, show: true },
    { key: "distance", cents: b.distance, show: true },
    { key: "time", cents: b.time, show: true },
    { key: "waiting", cents: b.waiting, show: b.waiting > 0 },
    { key: "booking", cents: b.booking, show: b.booking > 0 },
    { key: "zone", cents: b.zone, show: b.zone > 0 },
    { key: "surge", cents: b.surge, show: b.surge > 0 },
    { key: "discount", cents: -b.discount, show: b.discount > 0 },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("title")}</CardTitle>
        <CardDescription>
          {ride.status === "COMPLETED" ? t("descriptionFinal") : t("descriptionEstimate")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-caption">{t("estimated")}</dt>
            <dd className="tabular text-xl font-bold">{f.eur(ride.estimatedFareCents)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption">{t("final")}</dt>
            <dd className="tabular text-xl font-bold">
              {final === undefined ? "—" : f.eur(final)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-caption">{t("difference")}</dt>
            <dd className="tabular text-xl font-bold">
              {difference === null
                ? "—"
                : `${difference > 0 ? "+" : difference < 0 ? "−" : ""}${f.eur(Math.abs(difference))}`}
            </dd>
          </div>
        </dl>
        <table className="w-full text-dense">
          <caption className="sr-only">{t("breakdown")}</caption>
          <tbody className="divide-y">
            {lines
              .filter((line) => line.show)
              .map((line) => (
                <tr key={line.key}>
                  <th scope="row" className="py-2 text-left font-normal text-muted-foreground">
                    {t(`lines.${line.key}` as "lines.base")}
                  </th>
                  <td className="tabular py-2 text-right">{f.eur(line.cents)}</td>
                </tr>
              ))}
            <tr>
              <th scope="row" className="py-2 text-left font-normal text-muted-foreground">
                {t("lines.vat", { rate: f.percent(b.vatRate, 0) })}
              </th>
              <td className="tabular py-2 text-right">{f.eur(b.vat)}</td>
            </tr>
            <tr>
              <th scope="row" className="py-2.5 text-left font-semibold">
                {t("lines.total")}
              </th>
              <td className="tabular py-2.5 text-right font-semibold">{f.eur(b.total)}</td>
            </tr>
          </tbody>
        </table>
        {ride.status === "CANCELLED" && ride.cancellation && ride.cancellation.feeCents > 0 && (
          <p className="text-caption">
            {t("cancellationFee", { amount: f.eur(ride.cancellation.feeCents) })}
          </p>
        )}
        {ride.commission && (
          <div className="rounded-lg bg-muted/60 p-3">
            <h3 className="text-dense mb-2 font-semibold">{t("commission.title")}</h3>
            <dl className="grid gap-3 sm:grid-cols-4">
              {[
                [t("commission.net"), f.eur(ride.commission.fareNetCents)],
                [t("commission.rate"), f.percent(ride.commission.rate, 0)],
                [t("commission.platform"), f.eur(ride.commission.commissionCents)],
                [t("commission.driver"), f.eur(ride.commission.driverEarningsCents)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-caption">{label}</dt>
                  <dd className="tabular font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Payment, refunds and invoice (§9 "payment and refund information"). Needs `payments.view`. */
export function RidePaymentCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail.payment");
  const tAll = useTranslations();
  const f = useFormat();
  const p = ride.paymentRecord;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <KeyValueGrid
          columns={1}
          items={[
            {
              label: t("status"),
              value: <StatusBadge kind="payment" value={ride.payment.status} />,
            },
            {
              label: t("method"),
              value: p?.methodDetail ?? tAll(`enums.paymentMethod.${ride.payment.method}`),
            },
            ...(p
              ? [
                  { label: t("amount"), value: f.eur(p.amountCents) },
                  {
                    label: t("reference"),
                    value: p.gatewayRef ? <span className="tabular">{p.gatewayRef}</span> : null,
                  },
                  {
                    label: t("reconciled"),
                    value: p.reconciled ? tAll("common.yes") : tAll("common.no"),
                  },
                  ...(p.failureReason
                    ? [
                        {
                          label: t("failure"),
                          value: <span className="text-destructive">{p.failureReason}</span>,
                        },
                      ]
                    : []),
                ]
              : []),
          ]}
        />
        {!p && (
          <p className="text-caption">
            {ride.payment.status === "NOT_CHARGED" ? t("notCharged") : t("noRecord")}
          </p>
        )}
        {p && p.refunds.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-dense font-semibold">{t("refunds")}</h3>
            <ul className="flex flex-col divide-y rounded-lg border">
              {p.refunds.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="flex items-center justify-between gap-2">
                    <span className="tabular text-dense font-medium">{f.eur(r.amountCents)}</span>
                    <Badge
                      variant={r.status === "SUCCESSFUL" ? "success" : "danger"}
                      className="text-micro h-5"
                    >
                      {t(`refundStatus.${r.status}`)}
                    </Badge>
                  </span>
                  <span className="text-caption">
                    {f.dateTime(r.createdAt)} · {r.reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {ride.invoice && (
          <div className="flex flex-col gap-2">
            <h3 className="text-dense font-semibold">{t("invoice")}</h3>
            <KeyValueGrid
              columns={1}
              items={[
                {
                  label: t("invoiceNumber"),
                  value: <span className="tabular">{ride.invoice.number}</span>,
                },
                {
                  label: t("invoiceStatus"),
                  value: <StatusBadge kind="invoice" value={ride.invoice.status} />,
                },
                { label: t("invoiceTotal"), value: f.eur(ride.invoice.totalCents) },
              ]}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
