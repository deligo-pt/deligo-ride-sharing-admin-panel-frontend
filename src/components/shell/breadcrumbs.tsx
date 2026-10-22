"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { findNavItem } from "@/config/nav";
import { Link, usePathname } from "@/i18n/navigation";

/** Group › Module › (record id). Hidden on phones, where the page title says it. */
export function Breadcrumbs() {
  const t = useTranslations();
  const pathname = usePathname();
  const found = findNavItem(pathname);
  if (!found) return null;
  const rest = pathname.slice(found.item.href.length).split("/").filter(Boolean);

  return (
    <nav
      aria-label={t("shell.breadcrumb")}
      className="hidden min-w-0 items-center gap-1.5 text-dense text-muted-foreground md:flex"
    >
      <span className="truncate">{t(`nav.groups.${found.group.key}`)}</span>
      <ChevronRight aria-hidden className="size-3.5 shrink-0" />
      {rest.length ? (
        <Link href={found.item.href} className="truncate hover:text-foreground">
          {t(`nav.items.${found.item.key}`)}
        </Link>
      ) : (
        <span className="truncate font-medium text-foreground" aria-current="page">
          {t(`nav.items.${found.item.key}`)}
        </span>
      )}
      {rest.map((segment, index) => (
        <span key={segment} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight aria-hidden className="size-3.5 shrink-0" />
          <span
            className={
              index === rest.length - 1 ? "truncate font-medium text-foreground" : "truncate"
            }
          >
            {decodeURIComponent(segment)}
          </span>
        </span>
      ))}
    </nav>
  );
}
