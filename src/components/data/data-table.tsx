"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Page } from "@/types/common";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Pagination } from "./pagination";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Name in the "Columns" menu (defaults to the header text). */
    label?: string;
    /** Classes for the header and cells (width, alignment). */
    className?: string;
    /** Cannot be hidden from the "Columns" menu. */
    alwaysVisible?: boolean;
    /** Hidden until the admin turns it on in the "Columns" menu (wide tables). */
    defaultHidden?: boolean;
  }
}

/**
 * The list table (§P5). Data arrives already filtered, sorted and paginated
 * by the service — this component only renders and reports changes. Column
 * `id` = the service's sort field; set `enableSorting: true` on sortable ones.
 *
 * Below `md` the rows render as `mobileCard`. Rows are keyboard-navigable:
 * Tab into the table, ↑/↓ to move, Enter to open. Hidden columns are
 * remembered per browser (`tableId`).
 */
export function DataTable<T>({
  tableId,
  columns,
  data,
  isPending,
  isFetching,
  error,
  onRetry,
  sort,
  onSortChange,
  pageSize,
  onPageChange,
  onPageSizeChange,
  getRowId,
  onOpenRow,
  rowActions,
  mobileCard,
  selection,
  onSelectionChange,
  filtered = false,
  onClearFilters,
  emptyTitle,
  caption,
}: {
  tableId: string;
  columns: ColumnDef<T, unknown>[];
  data: Page<T> | undefined;
  isPending: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** "<field>:asc|desc" or "" (service default). */
  sort: string;
  onSortChange: (sort: string) => void;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  getRowId: (row: T) => string;
  onOpenRow?: (row: T) => void;
  /** Items for the row's "⋯" menu (DropdownMenuItem elements). */
  rowActions?: (row: T) => React.ReactNode;
  mobileCard: (row: T) => React.ReactNode;
  /** Enables checkboxes; selection is by row id and resets on page change by the caller. */
  selection?: RowSelectionState;
  onSelectionChange?: (selection: RowSelectionState) => void;
  filtered?: boolean;
  onClearFilters?: () => void;
  emptyTitle?: string;
  /** Accessible name of the table. */
  caption: string;
}) {
  const t = useTranslations("data");
  const [visibility, setVisibility] = useState<VisibilityState>(
    () =>
      readVisibility(tableId) ??
      Object.fromEntries(
        columns.filter((c) => c.meta?.defaultHidden && c.id).map((c) => [c.id as string, false]),
      ),
  );
  const [sortField, sortDir] = sort ? sort.split(":") : ["", ""];

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    const list = [...columns];
    if (selection && onSelectionChange) {
      list.unshift({
        id: "_select",
        meta: { alwaysVisible: true, className: "w-10" },
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
            aria-label={t("selectAll")}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
            aria-label={t("selectRow")}
          />
        ),
      });
    }
    if (rowActions) {
      list.push({
        id: "_actions",
        meta: { alwaysVisible: true, className: "w-12 text-right" },
        header: () => <span className="sr-only">{t("rowActions")}</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={t("rowActions")}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{rowActions(row.original)}</DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    }
    return list;
  }, [columns, selection, onSelectionChange, rowActions, t]);

  // TanStack Table returns new functions every render; the React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data?.items ?? [],
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: Boolean(selection),
    state: { columnVisibility: visibility, rowSelection: selection ?? {} },
    onColumnVisibilityChange: (updater) => {
      setVisibility((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        writeVisibility(tableId, next);
        return next;
      });
    },
    onRowSelectionChange: (updater) => {
      if (!onSelectionChange) return;
      onSelectionChange(typeof updater === "function" ? updater(selection ?? {}) : updater);
    },
  });

  const cycleSort = (id: string) => {
    if (sortField !== id) onSortChange(`${id}:asc`);
    else if (sortDir === "asc") onSortChange(`${id}:desc`);
    else onSortChange("");
  };

  const rows = table.getRowModel().rows;
  const hideable = table.getAllLeafColumns().filter((c) => !c.columnDef.meta?.alwaysVisible);

  const onRowKey = (event: React.KeyboardEvent<HTMLTableRowElement>, row: T) => {
    const el = event.currentTarget;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      (el.nextElementSibling as HTMLElement | null)?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      (el.previousElementSibling as HTMLElement | null)?.focus();
    } else if (event.key === "Enter" && event.target === el) {
      onOpenRow?.(row);
    }
  };

  const onRowClick = (event: React.MouseEvent, row: T) => {
    // Clicks on buttons, links, checkboxes and menus inside the row are theirs.
    if (
      (event.target as HTMLElement).closest(
        "button, a, input, [role='checkbox'], [role='menuitem']",
      )
    )
      return;
    onOpenRow?.(row);
  };

  const body = (() => {
    if (error && !data) return <ErrorState error={error} onRetry={onRetry} />;
    if (isPending && !data) return <TableSkeleton columns={Math.min(6, allColumns.length)} />;
    if (data && data.items.length === 0)
      return (
        <EmptyState
          filtered={filtered}
          onClearFilters={onClearFilters}
          title={filtered ? undefined : emptyTitle}
        />
      );
    return null;
  })();

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
      {hideable.length > 0 && (
        <div className="hidden items-center justify-end gap-2 border-b px-3 py-2 md:flex">
          {isFetching && data && (
            <span className="text-caption mr-auto" aria-live="polite">
              {t("updating")}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Columns3 />
                {t("columns")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("columns")}</DropdownMenuLabel>
              {hideable.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(Boolean(v))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {column.columnDef.meta?.label ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {body ?? (
        <>
          {/* Desktop table */}
          <div
            className={cn(
              "hidden max-h-[70svh] overflow-auto md:block",
              isFetching && "opacity-70 transition-opacity",
            )}
          >
            <table className="text-dense w-full caption-bottom border-separate border-spacing-0">
              <caption className="sr-only">{caption}</caption>
              <thead className="sticky top-0 z-10 bg-card">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const id = header.column.id;
                      const sortable = header.column.columnDef.enableSorting === true;
                      const active = sortField === id;
                      const label = header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext());
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            active ? (sortDir === "asc" ? "ascending" : "descending") : undefined
                          }
                          className={cn(
                            "text-caption h-10 border-b px-3 text-left font-medium whitespace-nowrap",
                            header.column.columnDef.meta?.className,
                          )}
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => cycleSort(id)}
                              className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={t("sortBy", {
                                column: header.column.columnDef.meta?.label ?? id,
                              })}
                            >
                              {label}
                              {active ? (
                                sortDir === "asc" ? (
                                  <ArrowUp aria-hidden className="size-3.5" />
                                ) : (
                                  <ArrowDown aria-hidden className="size-3.5" />
                                )
                              ) : (
                                <ChevronsUpDown aria-hidden className="size-3.5 opacity-50" />
                              )}
                            </button>
                          ) : (
                            label
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    onKeyDown={(e) => onRowKey(e, row.original)}
                    onClick={(e) => onRowClick(e, row.original)}
                    className={cn(
                      "outline-none hover:bg-muted/50 focus-visible:bg-accent/60 data-[state=selected]:bg-accent/40",
                      onOpenRow && "cursor-pointer",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "h-10 border-b px-3 py-1.5 align-middle",
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="flex flex-col divide-y md:hidden" aria-label={caption}>
            {rows.map((row) => (
              <li key={row.id} className="relative flex items-start gap-2 p-3">
                <div
                  role={onOpenRow ? "button" : undefined}
                  tabIndex={onOpenRow ? 0 : undefined}
                  onClick={(e) => onRowClick(e, row.original)}
                  onKeyDown={(e) => e.key === "Enter" && onOpenRow?.(row.original)}
                  className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {mobileCard(row.original)}
                </div>
                {rowActions && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={t("rowActions")}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {rowActions(row.original)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

const storageKey = (tableId: string) => `deligo-ride-admin:columns:${tableId}`;

/** The admin's saved choice, or null when they never changed it (columns then use their defaults). */
function readVisibility(tableId: string): VisibilityState | null {
  try {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem(storageKey(tableId));
    return saved ? (JSON.parse(saved) as VisibilityState) : null;
  } catch {
    return null;
  }
}

function writeVisibility(tableId: string, value: VisibilityState) {
  try {
    window.localStorage.setItem(storageKey(tableId), JSON.stringify(value));
  } catch {
    // Private window or blocked storage: the choice just isn't remembered.
  }
}
