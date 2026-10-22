"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type ExportCell = string | number | null;
export type ExportTable = { columns: { key: string; label: string }[]; rows: Record<string, ExportCell>[] };

/**
 * CSV / Excel export of the current filters (§17). `getData` asks the
 * service for every matching row (exports are audited there) and returns
 * already-translated headers. papaparse and exceljs load only on click.
 * Portuguese CSV uses ";" so Excel in pt-PT opens it in columns.
 */
export function ExportButton({ filename, getData }: { filename: string; getData: () => Promise<ExportTable> }) {
  const t = useTranslations("export");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const run = async (format: "csv" | "xlsx") => {
    setBusy(true);
    const id = toast.loading(t("preparing"));
    try {
      const data = await getData();
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = format === "csv" ? await toCsv(data, locale === "pt" ? ";" : ",") : await toXlsx(data, filename);
      download(blob, `${filename}-${stamp}.${format}`);
      toast.success(t("done", { count: data.rows.length }), { id });
    } catch {
      toast.error(t("failed"), { id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy}>
          <Download />
          {t("label")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run("csv")}>{t("csv")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("xlsx")}>{t("xlsx")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

async function toCsv({ columns, rows }: ExportTable, delimiter: string) {
  const { default: Papa } = await import("papaparse");
  const csv = Papa.unparse(
    { fields: columns.map((c) => c.label), data: rows.map((row) => columns.map((c) => row[c.key] ?? "")) },
    { delimiter },
  );
  // BOM so Excel reads UTF-8 (accents in names).
  return new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
}

async function toXlsx({ columns, rows }: ExportTable, sheetName: string) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }));
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
