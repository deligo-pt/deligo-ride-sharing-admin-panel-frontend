"use client";

import { useState } from "react";
import { Ban, GitCompare, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { toast } from "sonner";
import type { PricingRule, PricingStatus } from "@/types/pricing";
import { StatusBadge } from "@/components/badges/status-badge";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/feedback/states";
import { SingleSelectFilter, MultiSelectFilter } from "@/components/data/filter-bar";
import { Can } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePricingRules } from "@/hooks/queries/pricing";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { Link } from "@/i18n/navigation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { archivePricingRule } from "@/services/pricing";
import { DiffDialog } from "./diff-dialog";
import { CATEGORIES } from "./pricing-utils";

const STATUSES: PricingStatus[] = ["DRAFT", "SCHEDULED", "ACTIVE", "ARCHIVED"];

/**
 * Every version of every fare, newest first, with who changed it and when
 * (§11 "audit trail of previous configurations"). Filter by category and
 * status; open "What changed" for the difference from the version before;
 * edit a draft or withdraw a draft / scheduled version.
 */
export function HistoryTab() {
  const t = useTranslations("pricing.history");
  const tc = useTranslations("enums.rideCategory");
  const ts = useTranslations("status.pricing");
  const tError = useTranslations("feedback.errors");
  const f = useFormat();
  const [filters, setFilters] = useQueryStates(
    {
      category: parseAsStringLiteral(CATEGORIES).withOptions({ history: "replace" }),
      status: parseAsString.withOptions({ history: "replace" }),
    },
    { clearOnDefault: true, scroll: false },
  );
  const statusList = (filters.status?.split(",").filter((s): s is PricingStatus => STATUSES.includes(s as PricingStatus)) ?? []) as PricingStatus[];
  const query = usePricingRules({
    page: 1,
    pageSize: 100,
    category: filters.category ? [filters.category] : undefined,
    status: statusList.length ? statusList : undefined,
  });
  // The whole history, to find "the version before" whatever the filters hide.
  const everything = usePricingRules({ page: 1, pageSize: 100 });
  const [diff, setDiff] = useState<PricingRule | null>(null);
  const [withdraw, setWithdraw] = useState<PricingRule | null>(null);

  const mutation = useServiceMutation({
    mutationFn: (v: { id: string; reason: string }) => archivePricingRule(v.id, v.reason),
    invalidate: [qk.pricing.all, qk.audit.all],
    onSuccess: (rule) => toast.success(t("withdrawn", { category: tc(rule.category), n: rule.version })),
    onError: (error) => {
      if (isServiceError(error) && error.field === "reason") return;
      toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN"));
    },
  });

  const previousOf = (rule: PricingRule) =>
    everything.data?.items
      .filter((r) => r.category === rule.category && r.zoneId === rule.zoneId && r.version < rule.version && r.status !== "DRAFT")
      .sort((a, b) => b.version - a.version)[0];

  const hasFilters = Boolean(filters.category) || statusList.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SingleSelectFilter
          label={t("category")}
          options={CATEGORIES.map((c) => ({ value: c, label: tc(c) }))}
          value={filters.category}
          onChange={(v) => setFilters({ category: (v as (typeof CATEGORIES)[number] | null) })}
        />
        <MultiSelectFilter
          label={t("status")}
          options={STATUSES.map((s) => ({ value: s, label: ts(s) }))}
          value={statusList}
          onChange={(v) => setFilters({ status: v.length ? v.join(",") : null })}
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setFilters({ category: null, status: null })}>
            {t("clear")}
          </Button>
        )}
      </div>
      {query.isPending ? (
        <TableSkeleton rows={6} columns={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState filtered={hasFilters} onClearFilters={() => setFilters({ category: null, status: null })} />
      ) : (
        <Card className="gap-0 overflow-x-auto py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("category")}</TableHead>
                <TableHead>{t("version")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("effective")}</TableHead>
                <TableHead>{t("changedBy")}</TableHead>
                <TableHead>{t("changedAt")}</TableHead>
                <TableHead className="w-40 text-right">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((rule) => (
                <TableRow key={rule.id} data-testid={`version-${rule.id}`}>
                  <TableCell className="font-medium">{tc(rule.category)}</TableCell>
                  <TableCell className="tabular">v{rule.version}</TableCell>
                  <TableCell>
                    <StatusBadge kind="pricing" value={rule.status} />
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">{f.date(rule.effectiveFrom)}</TableCell>
                  <TableCell>{rule.changedByName ?? rule.changedBy}</TableCell>
                  <TableCell className="tabular whitespace-nowrap">{f.dateTime(rule.changedAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setDiff(rule)} aria-label={t("whatChanged")} title={t("whatChanged")}>
                        <GitCompare />
                      </Button>
                      <Can module="pricing" action="modify_pricing">
                        {rule.status === "DRAFT" && (
                          <Button asChild variant="ghost" size="icon-sm" aria-label={t("editDraft")} title={t("editDraft")}>
                            <Link href={`/pricing/new?category=${rule.category}&draft=${rule.id}`}>
                              <Pencil />
                            </Link>
                          </Button>
                        )}
                        {(rule.status === "DRAFT" || rule.status === "SCHEDULED") && (
                          <Button variant="ghost" size="icon-sm" onClick={() => setWithdraw(rule)} aria-label={t("withdraw")} title={t("withdraw")}>
                            <Ban />
                          </Button>
                        )}
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {diff && <DiffDialog rule={diff} previous={previousOf(diff)} onClose={() => setDiff(null)} />}
      {withdraw && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setWithdraw(null)}
          title={t("withdrawTitle", { category: tc(withdraw.category), n: withdraw.version })}
          description={t("withdrawBody")}
          confirmLabel={t("withdraw")}
          destructive
          onConfirm={(reason) => mutation.mutateAsync({ id: withdraw.id, reason }).then(() => setWithdraw(null))}
        />
      )}
    </div>
  );
}
