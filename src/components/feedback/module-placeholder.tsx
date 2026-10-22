import type { Metadata } from "next";
import { Construction } from "lucide-react";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { NAV_ITEMS, type ModuleKey } from "@/config/nav";
import { routing } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** Stand-in for a module until its phase builds it (icon and phase from config/nav.ts). */
export function ModulePlaceholder({ module }: { module: ModuleKey }) {
  const t = useTranslations();
  const item = NAV_ITEMS.find((entry) => entry.key === module);
  if (!item) return null;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title">{t(`nav.items.${module}`)}</h1>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
            <item.icon aria-hidden className="size-6" />
          </span>
          <Badge variant="brand">
            <Construction aria-hidden />
            {t("placeholder.badge", { phase: item.phase })}
          </Badge>
          <p className="text-dense max-w-md text-muted-foreground">
            {t("placeholder.body", { phase: item.phase })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * `export const generateMetadata = moduleMetadata("rides")` — the tab title is
 * the module's translated menu label. Module phases keep using it.
 */
export function moduleMetadata(module: ModuleKey) {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({
      locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
      namespace: "nav.items",
    });
    return { title: t(module) };
  };
}
