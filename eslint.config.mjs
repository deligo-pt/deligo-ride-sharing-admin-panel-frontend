import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // §G of ride_plan.md: no `any`, and no data fetching in effects.
      "@typescript-eslint/no-explicit-any": "error",
      // `const { iban: _iban, ...rest } = record` drops a field on purpose.
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true }],
      // shadcn's registry now imports `cn` from the npm package "cn" (published
      // 16 Oct 2026). We use our own helper; `shadcn add` output must be fixed.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "cn",
              message: 'Import { cn } from "@/lib/utils" (the "cn" npm package is not allowed).',
            },
            // P5: the full "zod" build is ~100 kB gz per form page; zod/mini validates the same.
            { name: "zod", message: 'Import * as z from "zod/mini" (the full build is ~100 kB gz).' },
            // Locale-aware navigation (P3): these keep the /pt|/en prefix.
            {
              name: "next/link",
              message: 'Use Link from "@/i18n/navigation" (keeps the locale prefix).',
            },
            {
              name: "next/navigation",
              importNames: ["redirect", "permanentRedirect", "useRouter", "usePathname"],
              message: 'Use these from "@/i18n/navigation" (keeps the locale prefix).',
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The MapLibre worker copied from node_modules by scripts/copy-maplibre-worker.mjs.
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
