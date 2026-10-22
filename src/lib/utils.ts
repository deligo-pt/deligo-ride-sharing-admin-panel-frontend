import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * The custom type scale (globals.css) must be registered as font sizes —
 * otherwise tailwind-merge reads `text-dense` as a colour and drops it when a
 * `text-<colour>` class follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["page-title", "section", "card-title", "body", "dense", "caption", "micro"] },
      ],
    },
  },
});

/** Merge class names, resolving Tailwind conflicts (`px-2 px-4` → `px-4`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Ana Martins" → "AM", for avatars. */
export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
