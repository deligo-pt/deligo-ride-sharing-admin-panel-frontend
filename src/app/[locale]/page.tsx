import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// `/` → `/pt` (proxy) → `/pt/dashboard` (here).
export default async function LocaleHome({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  redirect({
    href: "/dashboard",
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  });
}
