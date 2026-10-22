"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/**
 * Building blocks for detail pages: header, key/value grid, timeline and
 * activity (notes) list. See features/customers/customer-detail.tsx.
 */

export function DetailHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  badges,
  actions,
}: {
  backHref: `/${string}`;
  backLabel: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="text-dense inline-flex w-fit items-center gap-1.5 rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-page-title truncate">{title}</h1>
          {(subtitle || badges) && (
            <div className="flex flex-wrap items-center gap-2">
              {subtitle && (
                <span className="text-dense text-muted-foreground tabular-nums">{subtitle}</span>
              )}
              {badges}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
      </div>
    </header>
  );
}

export type KeyValue = { label: string; value: React.ReactNode; wide?: boolean };

/** Label/value pairs; empty values show "—". */
export function KeyValueGrid({ items, columns = 2 }: { items: KeyValue[]; columns?: 1 | 2 | 3 }) {
  const t = useTranslations("common");
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns >= 2 && "sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn("flex min-w-0 flex-col gap-1", item.wide && "sm:col-span-full")}
        >
          <dt className="text-caption">{item.label}</dt>
          <dd className="text-dense min-w-0 break-words">
            {item.value === undefined || item.value === null || item.value === ""
              ? t("notAvailable")
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type TimelineItem = {
  id: string;
  title: React.ReactNode;
  at: string;
  by?: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
};

const DOT: Record<NonNullable<TimelineItem["tone"]>, string> = {
  default: "bg-muted-foreground/40",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

/** Vertical history (status changes, audit trail), newest first unless given otherwise. */
export function Timeline({ items, emptyLabel }: { items: TimelineItem[]; emptyLabel?: string }) {
  const f = useFormat();
  const t = useTranslations("activity");
  if (!items.length)
    return <p className="text-dense text-muted-foreground">{emptyLabel ?? t("empty")}</p>;
  return (
    <ol className="relative flex flex-col gap-5 border-l pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-background",
              DOT[item.tone ?? "default"],
            )}
          />
          <p className="text-dense font-medium">{item.title}</p>
          <p className="text-caption">
            <time dateTime={item.at}>{f.dateTime(item.at)}</time>
            {item.by && <> · {t("by", { name: item.by })}</>}
          </p>
          {item.description && (
            <div className="text-dense mt-1 text-muted-foreground">{item.description}</div>
          )}
        </li>
      ))}
    </ol>
  );
}

export type ActivityEntry = { id: string; text: string; authorName: string; createdAt: string };

/** Internal notes and comments, newest first. */
export function ActivityList({
  entries,
  emptyLabel,
}: {
  entries: ActivityEntry[];
  emptyLabel?: string;
}) {
  const f = useFormat();
  const t = useTranslations("activity");
  if (!entries.length)
    return <p className="text-dense text-muted-foreground">{emptyLabel ?? t("empty")}</p>;
  return (
    <ul className="flex flex-col divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <p className="text-dense whitespace-pre-wrap">{entry.text}</p>
          <p className="text-caption">
            {entry.authorName} ·{" "}
            <time dateTime={entry.createdAt}>{f.dateTime(entry.createdAt)}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}
