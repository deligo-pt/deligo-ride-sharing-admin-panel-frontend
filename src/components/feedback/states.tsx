"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Lock, RotateCw, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isServiceError } from "@/lib/service-error";
import { cn } from "@/lib/utils";

/**
 * Loading, empty, error and no-access states (§H: every page shows all of
 * them). Use these, never ad-hoc spinners or "No data" text.
 */

function StateFrame({
  icon: Icon,
  tone = "muted",
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  tone?: "muted" | "danger";
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-14 text-center", className)}>
      <span
        className={cn(
          "grid size-11 place-items-center rounded-full",
          tone === "danger" ? "bg-danger-soft text-destructive" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="text-card-title">{title}</p>
      {children}
    </div>
  );
}

/** Nothing to show. `filtered` = the filters caused it (offers "Clear filters"). */
export function EmptyState({
  title,
  description,
  filtered = false,
  onClearFilters,
  action,
  icon,
  className,
}: {
  title?: string;
  description?: string;
  filtered?: boolean;
  onClearFilters?: () => void;
  action?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <StateFrame
      icon={icon ?? (filtered ? SearchX : Inbox)}
      title={title ?? (filtered ? t("feedback.emptyFiltered") : t("feedback.emptyTitle"))}
      className={className}
    >
      {(description || filtered) && (
        <p className="text-dense max-w-sm text-muted-foreground">{description ?? t("feedback.emptyFilteredHint")}</p>
      )}
      {filtered && onClearFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          {t("common.clearFilters")}
        </Button>
      )}
      {action}
    </StateFrame>
  );
}

/** A failed request. The message comes from the ServiceError code; Retry refetches. */
export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const t = useTranslations();
  const code = isServiceError(error) ? error.code : "UNKNOWN";
  return (
    <StateFrame icon={AlertTriangle} tone="danger" title={title ?? t("feedback.errorTitle")} className={className}>
      <p className="text-dense max-w-sm text-muted-foreground" role="alert">
        {t(`feedback.errors.${code}`)}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          {t("common.retry")}
        </Button>
      )}
    </StateFrame>
  );
}

/** Shown when the role may not open a page or section (P7: RouteGuard, `<Can fallback>`). */
export function NoAccess({ action, className }: { action?: React.ReactNode; className?: string }) {
  const t = useTranslations("feedback");
  return (
    <StateFrame icon={Lock} title={t("noAccessTitle")} className={className}>
      <p className="text-dense max-w-sm text-muted-foreground">{t("noAccessBody")}</p>
      {action}
    </StateFrame>
  );
}

/** Skeleton shaped like a table: header bar + rows. */
export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-10 items-center gap-4 border-b px-3 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-40" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton shaped like a detail page: header + key/value cards. */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
