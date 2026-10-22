import { defineRouting } from "next-intl/routing";

/**
 * Every URL carries its language: /pt/rides, /en/rides. Portuguese is the
 * default; detection is off so `/` always opens the demo in Portuguese.
 */
export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localePrefix: "always",
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
