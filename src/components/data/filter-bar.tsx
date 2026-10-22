"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, Check, ChevronDown, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_PRESETS, fromYmd, toYmd, type DatePreset } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

// react-day-picker (~20 kB gz) loads only when "Custom range" is opened.
const RangeCalendar = dynamic(() => import("./range-calendar"), { ssr: false });

/**
 * The filter row above a list (§P5): search (300 ms debounce), multi-select
 * filters, a date range with presets, and "Clear filters". State lives in the
 * URL through `useListState`; these components only show and report it.
 */
export function FilterBar({
  children,
  hasFilters,
  onClear,
  actions,
}: {
  children: React.ReactNode;
  hasFilters: boolean;
  onClear: () => void;
  /** Right side: export, primary action. */
  actions?: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
            <X />
            {t("clearFilters")}
          </Button>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Search box; reports the value 300 ms after typing stops. */
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const t = useTranslations("common");
  const [text, setText] = useState(value);
  // Follow outside changes (Clear filters, back button).
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <InputGroup className="w-full sm:w-72">
      <InputGroupAddon>
        <Search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={t("search")}
      />
    </InputGroup>
  );
}

/** Popover with checkboxes; the trigger shows how many are picked. */
export function MultiSelectFilter<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V[];
  onChange: (value: V[]) => void;
}) {
  const t = useTranslations("common");
  const toggle = (v: V) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("border-dashed", value.length && "border-solid")}
        >
          {label}
          {value.length > 0 && (
            <Badge variant="brand" className="h-5 px-1.5 tabular-nums">
              {value.length}
            </Badge>
          )}
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 gap-1 p-1.5">
        <ul role="listbox" aria-multiselectable aria-label={label} className="flex flex-col">
          {options.map((option) => {
            const selected = value.includes(option.value);
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => toggle(option.value)}
                  className="text-dense flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {selected && <Check className="size-3" />}
                  </span>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="justify-center" onClick={() => onChange([])}>
            {t("clearFilters")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Popover with one choice (radio list) — for filters with many options, like a fleet. Picking the chosen one again clears it. */
export function SingleSelectFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("border-dashed", value && "border-solid")}
        >
          {label}
          {chosen && (
            <Badge variant="brand" className="h-5 max-w-40 px-1.5">
              <span className="truncate">{chosen.label}</span>
            </Badge>
          )}
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1 p-1.5">
        <ul role="listbox" aria-label={label} className="flex max-h-72 flex-col overflow-y-auto">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(selected ? null : option.value);
                    setOpen(false);
                  }}
                  className="text-dense flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <Check
                    aria-hidden
                    className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** A filter that is simply on or off ("expiring soon"). */
export function ToggleFilter({
  label,
  pressed,
  onChange,
}: {
  label: string;
  pressed: boolean;
  onChange: (pressed: boolean) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
      className={cn(
        "border-dashed",
        pressed && "border-solid border-primary bg-accent text-accent-foreground",
      )}
    >
      {pressed && <Check aria-hidden />}
      {label}
    </Button>
  );
}

/** Date range with presets; "custom" opens a two-month calendar. Dates are Lisbon days ("yyyy-MM-dd"). */
export function DateRangeFilter({
  label,
  preset,
  from,
  to,
  onChange,
  allowAny = true,
}: {
  label: string;
  preset: DatePreset | null;
  from: string | null;
  to: string | null;
  onChange: (value: { range: DatePreset | null; from: string | null; to: string | null }) => void;
  /** Offer "Any date". Off where a period is always needed (the dashboard). */
  allowAny?: boolean;
}) {
  const t = useTranslations("dates");
  const f = useFormat();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(preset === "custom");

  const summary =
    preset === "custom" && from
      ? `${f.dateShort(fromYmd(from))} – ${to ? f.dateShort(fromYmd(to)) : "…"}`
      : preset
        ? t(preset)
        : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("border-dashed", preset && "border-solid")}
        >
          <CalendarDays className="opacity-70" />
          {label}
          {summary && (
            <Badge variant="brand" className="h-5 px-1.5">
              {summary}
            </Badge>
          )}
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-2 p-2">
        <div className="flex flex-wrap gap-1">
          {DATE_PRESETS.filter((p) => p !== "custom").map((p) => (
            <Button
              key={p}
              size="sm"
              variant={preset === p ? "default" : "ghost"}
              onClick={() => {
                onChange({ range: p, from: null, to: null });
                setShowCalendar(false);
                setOpen(false);
              }}
            >
              {t(p)}
            </Button>
          ))}
          <Button
            size="sm"
            variant={preset === "custom" ? "default" : "ghost"}
            onClick={() => setShowCalendar(true)}
          >
            {t("custom")}
          </Button>
          {preset && allowAny && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (onChange({ range: null, from: null, to: null }), setOpen(false))}
            >
              {t("any")}
            </Button>
          )}
        </div>
        {showCalendar && (
          <div className="flex flex-col gap-1">
            <p className="text-caption px-1">{t("pickRange")}</p>
            <RangeCalendar
              locale={locale}
              selected={
                from ? { from: fromYmd(from), to: to ? fromYmd(to) : undefined } : undefined
              }
              onSelect={(range) => {
                if (!range?.from) return;
                onChange({
                  range: "custom",
                  from: toYmd(range.from),
                  to: range.to ? toYmd(range.to) : null,
                });
                if (range.to && range.to.getTime() !== range.from.getTime()) setOpen(false);
              }}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
