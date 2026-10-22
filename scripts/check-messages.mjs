// pnpm check:messages — fails if pt.json and en.json don't have exactly the
// same keys, or a string is empty. Run after adding translations (ride_plan.md §G).
import { readFileSync } from "node:fs";

const load = (locale) =>
  JSON.parse(readFileSync(new URL(`../src/messages/${locale}.json`, import.meta.url), "utf8"));

function flatten(tree, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      if (Object.keys(value).length === 0) out.set(path, "{}");
      flatten(value, path, out);
    } else out.set(path, value);
  }
  return out;
}

const pt = flatten(load("pt"));
const en = flatten(load("en"));
const problems = [];
for (const key of pt.keys()) if (!en.has(key)) problems.push(`missing in en.json: ${key}`);
for (const key of en.keys()) if (!pt.has(key)) problems.push(`missing in pt.json: ${key}`);
for (const [locale, map] of [
  ["pt", pt],
  ["en", en],
]) {
  for (const [key, value] of map) {
    if (typeof value !== "string") continue;
    if (value.trim() === "") problems.push(`empty string in ${locale}.json: ${key}`);
    // Both files must use the same ICU placeholders: "{count} new" ↔ "{count} novas".
    const other = (locale === "pt" ? en : pt).get(key);
    const vars = (s) =>
      [...s.matchAll(/\{\s*(\w+)\s*[,}]/g)] // `{name}` or `{name, plural, …}` — not plural branch text
        .map((m) => m[1])
        .sort()
        .join(",");
    if (locale === "pt" && typeof other === "string" && vars(value) !== vars(other)) {
      problems.push(`placeholders differ for ${key}: pt {${vars(value)}} vs en {${vars(other)}}`);
    }
  }
}

if (problems.length) {
  console.error(`✗ messages: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(
  `✓ messages: ${[...pt.values()].filter((v) => typeof v === "string").length} strings, pt and en match`,
);
