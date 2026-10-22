"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";

/**
 * Euro amount input that works in cents (§D.6: money is integer cents).
 * Accepts "12,50", "12.50", "1 234,5" or "1,234.50"; shows the value in the
 * current locale when not focused. `value` null = empty.
 */
export function parseEuroInput(text: string): number | null {
  const clean = text.replace(/[\s€]/g, "");
  if (!clean) return null;
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  const decimal = lastComma > lastDot ? "," : ".";
  const normalized = clean
    .split(decimal === "," ? "." : ",")
    .join("")
    .replace(decimal, ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function MoneyInput({
  value,
  onChange,
  id,
  invalid,
  disabled,
  placeholder,
  ...rest
}: {
  value: number | null;
  onChange: (cents: number | null) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-describedby"?: string;
}) {
  const locale = useLocale();
  const format = (cents: number | null) =>
    cents === null
      ? ""
      : new Intl.NumberFormat(locale === "pt" ? "pt-PT" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          cents / 100,
        );
  const [text, setText] = useState(() => format(value));
  const [focused, setFocused] = useState(false);
  // Follow outside changes (form reset) while not editing.
  const [seen, setSeen] = useState(value);
  if (!focused && value !== seen) {
    setSeen(value);
    setText(format(value));
  }

  return (
    <InputGroup data-disabled={disabled || undefined}>
      <InputGroupAddon>
        <InputGroupText>€</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        disabled={disabled}
        placeholder={placeholder ?? format(0)}
        aria-invalid={invalid || undefined}
        className="tabular-nums"
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setText(e.target.value);
          const cents = parseEuroInput(e.target.value);
          setSeen(cents);
          onChange(cents);
        }}
        onBlur={() => {
          setFocused(false);
          setText(format(parseEuroInput(text)));
        }}
        {...rest}
      />
    </InputGroup>
  );
}
