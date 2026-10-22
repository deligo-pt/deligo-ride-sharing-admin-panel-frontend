import type messages from "@/messages/pt.json";
import type { routing } from "./routing";

// Typed `t()` keys (pt.json is the source of truth) and locale union.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
