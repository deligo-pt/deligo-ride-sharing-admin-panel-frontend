"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * One-time code as six boxes. Underneath it is a single real <input> (opacity
 * 0, on top of the boxes), so paste, SMS/e-mail autofill (`one-time-code`),
 * backspace and screen readers all work like a normal field.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  className,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  className?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "maxLength">) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";

  return (
    <div className={cn("relative", className)}>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={(event) => {
          setFocused(true);
          // Keep the caret at the end: the boxes fill left to right.
          event.target.setSelectionRange(value.length, value.length);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        className="absolute inset-0 z-10 size-full cursor-text text-base opacity-0 disabled:cursor-not-allowed"
      />
      <div
        aria-hidden
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {Array.from({ length }, (_, i) => {
          const char = value[i];
          const current = focused && i === active && value.length < length;
          return (
            <div
              key={i}
              className={cn(
                "tabular grid h-12 place-items-center rounded-lg border border-input bg-background text-xl font-semibold transition-[border-color,box-shadow] sm:h-14 dark:bg-input/30",
                (current || (focused && value.length === length && i === length - 1)) &&
                  "border-ring ring-3 ring-ring/50",
                invalid && "border-destructive",
                props.disabled && "opacity-50",
              )}
            >
              {char ?? (current && <span className="h-6 w-px animate-pulse bg-foreground" />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
