"use client";

import { enGB } from "react-day-picker/locale/en-GB";
import { pt } from "react-day-picker/locale/pt";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";

/** Two-month range picker — loaded on demand by DateRangeFilter ("Custom range"). */
export default function RangeCalendar({
  locale,
  selected,
  onSelect,
}: {
  locale: string;
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
}) {
  return (
    <Calendar
      mode="range"
      numberOfMonths={2}
      locale={locale === "pt" ? pt : enGB}
      disabled={{ after: new Date() }}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
