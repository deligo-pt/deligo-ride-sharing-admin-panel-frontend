"use client";

import type { LucideIcon } from "lucide-react";
import { Banknote, CreditCard, Nfc, Smartphone, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { GATEWAY_METHODS, type GatewayMethod, type PaymentMethod, type PaymentMethodStat } from "@/types/payment";
import { ErrorState } from "@/components/feedback/states";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { usePermission } from "@/components/session/permissions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { usePaymentMethodStats } from "@/hooks/queries/payments";
import { resolveDateRange } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { useDemoSettings } from "@/stores/demo-settings";

/**
 * Payment methods (§12): "must not display a payment method as operational
 * unless the required gateway integration is configured and enabled". Each
 * gateway method reads that from the demo setting `gateways` (the stand-in
 * for the real integration status); cash needs no gateway. Super Admin can
 * switch a gateway on or off here to show the rule at work — Settings → Demo
 * (P28) will hold the same switches. Numbers are the last 30 days.
 */
const ICON: Record<PaymentMethod, LucideIcon> = {
  CARD: CreditCard,
  MB_WAY: Smartphone,
  APPLE_PAY: Nfc,
  GOOGLE_PAY: Nfc,
  WALLET: Wallet,
  CASH: Banknote,
};

const isGateway = (m: PaymentMethod): m is GatewayMethod => (GATEWAY_METHODS as readonly string[]).includes(m);

export function MethodsTab() {
  const t = useTranslations("payments.methods");
  const tAll = useTranslations();
  const f = useFormat();
  const allowed = usePermission();
  const stats = usePaymentMethodStats(resolveDateRange("30d", null, null));
  const gateways = useDemoSettings((s) => s.gateways);
  const setGateway = useDemoSettings((s) => s.setGateway);
  const canSwitch = allowed("settings", "edit");

  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => stats.refetch()} />;

  const methods: PaymentMethod[] = [...GATEWAY_METHODS, "CASH"];
  const stat = (m: PaymentMethod): PaymentMethodStat =>
    stats.data?.find((s) => s.method === m) ?? { method: m, count: 0, successful: 0, failed: 0, capturedCents: 0 };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-dense max-w-3xl text-muted-foreground">{t("intro")}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.isPending
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)
          : methods.map((m) => {
              const Icon = ICON[m];
              const s = stat(m);
              const gateway = isGateway(m);
              const enabled = gateway ? gateways[m] : true;
              const settled = s.successful + s.failed;
              return (
                <Card key={m} className="gap-4 px-4" data-method={m} data-enabled={enabled}>
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-lg",
                        enabled ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="text-card-title">{tAll(`enums.paymentMethod.${m}`)}</h3>
                      <p className="text-caption">{t(`description.${m}`)}</p>
                    </div>
                    <Badge variant={!gateway ? "neutral" : enabled ? "success" : "warning"} className="text-micro h-5 shrink-0">
                      {!gateway ? t("noGateway") : enabled ? t("operational") : t("notEnabled")}
                    </Badge>
                  </div>

                  {!gateway && <p className="text-dense text-muted-foreground">{t("noGatewayText")}</p>}
                  {gateway && !enabled && <InlineAlert tone="warning">{t("notEnabledText")}</InlineAlert>}

                  {s.count === 0 ? (
                    <p className="text-caption">{t("noData")}</p>
                  ) : (
                    <dl className="grid grid-cols-3 gap-2">
                      <div className="flex min-w-0 flex-col">
                        <dt className="text-caption">{t("transactions")}</dt>
                        <dd className="tabular text-dense font-semibold">{f.number(s.count)}</dd>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <dt className="text-caption">{t("successRate")}</dt>
                        <dd className="tabular text-dense font-semibold">
                          {settled > 0 ? f.percent(s.successful / settled, 1) : "—"}
                        </dd>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <dt className="text-caption">{t("volume")}</dt>
                        <dd className="tabular text-dense font-semibold">{f.eur(s.capturedCents, { compact: true })}</dd>
                      </div>
                    </dl>
                  )}

                  {gateway && canSwitch && (
                    <div className="mt-auto flex items-start justify-between gap-3 border-t pt-3">
                      <div className="flex min-w-0 flex-col">
                        <Label htmlFor={`gateway-${m}`}>{t("demoSwitch")}</Label>
                        <p className="text-caption">{t("demoHint")}</p>
                      </div>
                      <Switch id={`gateway-${m}`} checked={enabled} onCheckedChange={(on) => setGateway(m, on)} />
                    </div>
                  )}
                </Card>
              );
            })}
      </div>
    </div>
  );
}
