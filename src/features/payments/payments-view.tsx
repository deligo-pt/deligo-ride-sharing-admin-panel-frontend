"use client";

import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { Can } from "@/components/session/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MethodsTab } from "./methods-tab";
import { PaymentDrawer } from "./payment-drawer";
import { useReconcileAction, useRefundAction } from "./payment-actions";
import { ReconciliationTab } from "./reconciliation-tab";
import { TransactionsTab } from "./transactions-tab";

const TABS = ["transactions", "methods", "reconciliation"] as const;

/**
 * Payments & refunds (§12): transactions, the payment methods and their
 * gateway status, and reconciliation against the gateway's file. Tabs and the
 * open payment are in the URL (`?tab=…`, `?payment=PAY-…`, so a ride can link
 * straight to its payment). Refunds and reconciliation need `payments.refund`
 * (Finance, Super Admin); everyone else with `payments.view` reads.
 */
export function PaymentsView() {
  const t = useTranslations("payments");
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("transactions").withOptions({ history: "replace", clearOnDefault: true }),
  );
  // "push": the browser's Back button closes the drawer.
  const [paymentId, setPaymentId] = useQueryState("payment", parseAsString.withOptions({ history: "push", scroll: false }));
  const refund = useRefundAction();
  const reconcile = useReconcileAction();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="text-dense text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Can module="payments" action="refund" fallback={<p className="text-caption">{t("readOnly")}</p>}>
        {null}
      </Can>
      <Tabs value={tab} onValueChange={(next) => setTab(next as (typeof TABS)[number])}>
        <TabsList className="max-w-full overflow-x-auto">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab
            onOpen={setPaymentId}
            onRefund={refund.open}
            onGoReconciliation={() => setTab("reconciliation")}
          />
        </TabsContent>
        <TabsContent value="methods" className="mt-4">
          <MethodsTab />
        </TabsContent>
        <TabsContent value="reconciliation" className="mt-4">
          <ReconciliationTab onOpen={setPaymentId} onReconcile={reconcile.open} />
        </TabsContent>
      </Tabs>
      <PaymentDrawer
        id={paymentId}
        onClose={() => setPaymentId(null)}
        onRefund={refund.open}
        onReconcile={reconcile.open}
      />
      {refund.dialog}
      {reconcile.dialog}
    </div>
  );
}
