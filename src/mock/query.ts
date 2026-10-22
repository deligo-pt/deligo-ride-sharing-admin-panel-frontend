import type { Page } from "@/types/common";

/**
 * Server-side list helpers — what the backend's SQL would do. Services filter,
 * sort and paginate with these so screens already behave like server
 * pagination (ride_plan.md §D.3). No faker here: this file is in the main
 * bundle, the data itself loads lazily.
 */

export const MAX_PAGE_SIZE = 500;

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.min(Math.max(1, Math.floor(pageSize) || 25), MAX_PAGE_SIZE);
  const lastPage = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), lastPage);
  const start = (current - 1) * size;
  // structuredClone: callers (and the React Query cache) never share objects with the store.
  return { items: structuredClone(rows.slice(start, start + size)), page: current, pageSize: size, total: rows.length };
}

/** Lowercase without accents: "João" matches "joao". */
export const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** True when every word of `q` appears in one of the fields. Phones match without spaces. */
export function matchesQuery(q: string | undefined, ...fields: (string | undefined | null)[]) {
  if (!q?.trim()) return true;
  const haystack = normalize(fields.filter(Boolean).join(" ")) + " " + fields.join(" ").replace(/\s/g, "");
  return normalize(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word.replace(/\s/g, "")));
}

/** `undefined`/empty filter = everything passes. */
export const inSet = <T>(value: T, allowed?: readonly T[]) => !allowed?.length || allowed.includes(value);

/** ISO date within [from, to] (either bound optional). */
export function inRange(value: string | undefined, from?: string, to?: string) {
  if (!from && !to) return true;
  if (!value) return false;
  return (!from || value >= from) && (!to || value <= to);
}

type SortValue = string | number | boolean | undefined | null;
export type SortAccessors<T> = Record<string, (row: T) => SortValue>;

/**
 * Sort by `"<field>:asc|desc"`. Unknown fields fall back to `fallback`.
 * Missing values sort last either way.
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: string | undefined,
  accessors: SortAccessors<T>,
  fallback: string,
): T[] {
  const [field, dir] = (sort && accessors[sort.split(":")[0] ?? ""] ? sort : fallback).split(":");
  const get = accessors[field ?? ""];
  if (!get) return [...rows];
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "pt") * sign;
    return (Number(va) - Number(vb)) * sign;
  });
}

export const sum = <T>(rows: readonly T[], value: (row: T) => number) =>
  rows.reduce((total, row) => total + value(row), 0);
