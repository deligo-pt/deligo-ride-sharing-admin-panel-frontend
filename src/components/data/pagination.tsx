"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormat } from "@/lib/use-format";
import { PAGE_SIZES } from "./use-list-state";

/** "1–25 of 2,500" · rows per page · first/previous/next/last. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const t = useTranslations("data");
  const f = useFormat();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="text-dense flex flex-col gap-2 border-t px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground tabular-nums" aria-live="polite">
        {t("range", { from: f.number(from), to: f.number(to), total: f.number(total) })}
      </p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center gap-2">
          <span className="hidden text-muted-foreground sm:inline">{t("rowsPerPage")}</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger size="sm" className="w-[72px]" aria-label={t("rowsPerPage")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-muted-foreground tabular-nums">
            {t("page", { page: f.number(page), pages: f.number(pages) })}
          </span>
          <Button variant="outline" size="icon" className="hidden size-8 sm:inline-flex" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label={t("firstPage")}>
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t("previousPage")}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" className="size-8" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label={t("nextPage")}>
            <ChevronRight />
          </Button>
          <Button variant="outline" size="icon" className="hidden size-8 sm:inline-flex" disabled={page >= pages} onClick={() => onPageChange(pages)} aria-label={t("lastPage")}>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
