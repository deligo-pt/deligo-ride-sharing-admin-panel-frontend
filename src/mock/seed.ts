import { Faker, base, pt_PT } from "@faker-js/faker";

/**
 * Deterministic randomness for the sample data (ride_plan.md §D).
 *
 * One faker instance with Portuguese data (`pt_PT` + `base` only — the
 * `locale/pt_PT` entry also bundles all of English, ~115 kB gz). Every
 * generator runs inside `withSeed(name)`, which re-seeds from `SEED + name`:
 * a module's data is the same no matter which module was generated first, so
 * the lazy per-module generation stays deterministic. Never use Math.random
 * in generators.
 */
export const SEED = 2026;

export const faker = new Faker({ locale: [pt_PT, base] });

function hash(text: string) {
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function withSeed<T>(name: string, run: () => T): T {
  faker.seed(SEED + hash(name));
  return run();
}

/** Integer in [min, max]. */
export const int = (min: number, max: number) => faker.number.int({ min, max });

/** Float in [min, max). */
export const float = (min: number, max: number) => faker.number.float({ min, max });

export const chance = (probability: number) => faker.number.float({ min: 0, max: 1 }) < probability;

/**
 * One item. Always exactly one draw — faker's arrayElement skips the draw for
 * one-item lists, which would make the stream depend on the data.
 */
export const pick = <T>(items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(float(0, 1) * items.length))]!;

/** `weighted([["CARD", 45], ["MB_WAY", 25]])` — weights need not sum to 100. */
export function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = float(0, total);
  for (const [value, w] of entries) {
    roll -= w;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1]![0];
}

/** Random hex string (gateway references, correlation IDs). */
export const hex = (length: number) => faker.string.hexadecimal({ length, casing: "upper", prefix: "" });

export const digits = (length: number) => faker.string.numeric({ length, allowLeadingZeros: true });

const stripAccents = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

export type Sex = "female" | "male";

/** Portuguese full name — first + one or two surnames, like "Inês Rocha Ferreira". */
export function personName(sex: Sex = chance(0.5) ? "female" : "male") {
  const first = faker.person.firstName(sex);
  const last = chance(0.55)
    ? `${faker.person.lastName()} ${faker.person.lastName()}`
    : faker.person.lastName();
  return { name: `${first} ${last}`, sex };
}

const EMAIL_DOMAINS = [
  ["gmail.com", 45],
  ["hotmail.com", 15],
  ["outlook.pt", 10],
  ["sapo.pt", 12],
  ["icloud.com", 8],
  ["yahoo.com", 4],
  ["live.com.pt", 6],
] as const;

/**
 * "ines.ferreira234@sapo.pt" from "Inês Rocha Ferreira". `unique` (the
 * record's number) is appended so two "Ana Silva"s never share an email.
 */
export function emailFor(name: string, unique: number, domain?: string) {
  const parts = stripAccents(name).toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(Boolean);
  const first = parts[0] ?? "cliente";
  const last = parts[parts.length - 1] ?? "deligo";
  const local = pick([`${first}.${last}`, `${first}${last}`, `${first[0]}${last}`, `${first}_${last}`]);
  return `${local}${unique}@${domain ?? weighted(EMAIL_DOMAINS)}`;
}

/** Work email for staff and fleet contacts: "ines.ferreira@deligo.pt". */
export function workEmail(name: string, domain: string) {
  const parts = stripAccents(name).toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(Boolean);
  return `${parts[0] ?? "geral"}.${parts[parts.length - 1] ?? "deligo"}@${domain}`;
}

export const slug = (text: string) =>
  stripAccents(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
