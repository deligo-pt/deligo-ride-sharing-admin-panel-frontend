"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PersonOption = { id: string; name: string; caption?: string };

/**
 * Filter by one customer or driver (§9): a popover with a search box (300 ms
 * after typing stops it asks `useResults`), a list of matches, and the picked
 * person shown on the button. Only the ID goes in the URL (`?driver=DRV-20001`),
 * so after a reload the button shows the ID. `useResults` is a hook called
 * every time (not conditionally) — pass the module's own query hook.
 */
export function PersonFilter({
  label,
  placeholder,
  value,
  onChange,
  useResults,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
  useResults: (q: string) => { data: PersonOption[] | undefined; isFetching: boolean };
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [pickedName, setPickedName] = useState<string | null>(null);
  const results = useResults(q);

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const shown = value ? (pickedName ?? value) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("border-dashed", value && "border-solid")}
        >
          {label}
          {shown && (
            <Badge variant="brand" className="h-5 max-w-40 px-1.5">
              <span className="truncate">{shown}</span>
            </Badge>
          )}
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-2 p-2">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            className="pl-8"
            autoFocus
          />
        </div>
        <ul role="listbox" aria-label={label} className="flex max-h-64 flex-col overflow-y-auto">
          {results.data?.length === 0 && !results.isFetching && (
            <li className="text-caption px-2 py-2">{t("noResults")}</li>
          )}
          {results.data?.map((person) => {
            const selected = person.id === value;
            return (
              <li key={person.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setPickedName(selected ? null : person.name);
                    onChange(selected ? null : person.id);
                    setOpen(false);
                  }}
                  className="text-dense flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <Check
                    aria-hidden
                    className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{person.name}</span>
                    <span className="text-caption tabular-nums">{person.caption ?? person.id}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-center"
            onClick={() => {
              setPickedName(null);
              onChange(null);
              setOpen(false);
            }}
          >
            {t("clearFilters")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
