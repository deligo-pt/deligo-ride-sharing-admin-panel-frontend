"use client";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Can } from "@/components/session/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveTab } from "./active-tab";
import { HistoryTab } from "./history-tab";
import { ZonesTab } from "./zones-tab";

const TABS = ["active", "zones", "history"] as const;

/**
 * Pricing & fares (§11): the fares in force per category, zone surcharges, and
 * the version history. Changing a fare happens on its own page (`/pricing/new`:
 * values → preview → publish). Without `modify_pricing` the module is read-only.
 */
export function PricingView() {
  const t = useTranslations("pricing");
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("active").withOptions({ history: "replace" }),
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="text-dense text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Can
        module="pricing"
        action="modify_pricing"
        fallback={<p className="text-caption">{t("readOnly")}</p>}
      >
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
        <TabsContent value="active" className="mt-4">
          <ActiveTab />
        </TabsContent>
        <TabsContent value="zones" className="mt-4">
          <ZonesTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
