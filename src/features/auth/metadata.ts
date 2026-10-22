import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

/** `export const generateMetadata = authMetadata("auth.login")` — tab title from `<namespace>.metaTitle`. */
export function authMetadata(namespace: "auth.login" | "auth.forgot" | "auth.reset") {
  return async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({
      locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
      namespace,
    });
    return { title: t("metaTitle") };
  };
}
