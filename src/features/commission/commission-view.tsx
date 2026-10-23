"use client";

import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Can } from "@/components/session/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatesTab } from "./rates-tab";
import { SettlementsTab } from "./settlements-tab";

const TABS = ["settlements", "rates"] as const;

/**
 * Commission & settlements (§12): the weekly settlements (the working list) and
 * the commission rates with their history. A settlement opens on its own page
 * (`/commission/SET-…`). Reading needs `commission.view`; changing rates and
 * adjusting settlements `commission.edit`; approving settlements (which creates
 * payouts) `payouts.approve`.
 */
export function CommissionView() {
  const t = useTranslations("commission");
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("settlements").withOptions({ history: "replace", clearOnDefault: true }),
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="text-dense text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Can module="commission" action="edit" fallback={<p className="text-caption">{t("readOnly")}</p>}>
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
        <TabsContent value="settlements" className="mt-4">
          <SettlementsTab />
        </TabsContent>
        <TabsContent value="rates" className="mt-4">
          <RatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
