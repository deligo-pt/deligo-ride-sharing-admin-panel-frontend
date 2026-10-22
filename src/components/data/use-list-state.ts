"use client";

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
  type ParserMap,
} from "nuqs";
import { DATE_PRESETS } from "@/lib/date-range";

/**
 * List-page state in the URL (§F: shareable, survives reload): page, page
 * size, search, sort and the page's own filters. Defaults are left out of the
 * URL. Any filter change goes back to page 1.
 *
 *   const list = useListState({ status: enumList(CUSTOMER_STATUSES), ...dateRangeParsers });
 *   list.state.status   // CustomerStatus[]
 *   list.setFilters({ status: ["ACTIVE"] })
 */
export const PAGE_SIZES = [25, 50, 100] as const;

export const listParsers = {
  page: parseAsInteger.withDefault(1),
  size: parseAsInteger.withDefault(25),
  q: parseAsString.withDefault(""),
  sort: parseAsString.withDefault(""),
};

export const dateRangeParsers = {
  range: parseAsStringLiteral(DATE_PRESETS),
  from: parseAsString,
  to: parseAsString,
};

/** Multi-select filter: `?status=ACTIVE,SUSPENDED`. */
export const enumList = <const T extends string>(values: readonly T[]) =>
  parseAsArrayOf(parseAsStringLiteral(values)).withDefault([]);

export function useListState<P extends ParserMap>(filters: P) {
  const [state, set] = useQueryStates(
    { ...listParsers, ...filters },
    { history: "replace", clearOnDefault: true, scroll: false },
  );
  type Patch = Exclude<Parameters<typeof set>[0], ((...args: never[]) => unknown) | null>;
  const filterKeys = ["q", ...Object.keys(filters)];
  return {
    state,
    set,
    /** Change filters (or search) and go back to page 1. */
    setFilters: (patch: Patch) => set({ ...patch, page: null } as Patch),
    /** Clear search and every filter; page size and sort stay. */
    clearFilters: () => set(Object.fromEntries([...filterKeys, "page"].map((k) => [k, null])) as Patch),
    /** True when search or any filter is set (to offer "Clear filters"). */
    hasFilters: filterKeys.some((k) => {
      const v = (state as Record<string, unknown>)[k];
      return Array.isArray(v) ? v.length > 0 : v !== null && v !== "";
    }),
  };
}
