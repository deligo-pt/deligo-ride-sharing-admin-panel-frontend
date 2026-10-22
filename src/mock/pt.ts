import { chance, digits, int, pick, weighted } from "./seed";

/** Portuguese identifiers with valid formats (sample data only — not real people). */

/** NIF with a valid mod-11 check digit. Individuals start 1–3, companies 5. */
export function nif(first: "1" | "2" | "3" | "5" = chance(0.6) ? "2" : "1") {
  const body = first + digits(7);
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(body[i]) * (9 - i);
  const rest = sum % 11;
  const check = rest < 2 ? 0 : 11 - rest;
  return body + String(check);
}

/** "+351912345678" — mobile prefixes 91, 92, 93, 96. */
export function mobile() {
  return `+351${pick(["91", "92", "93", "96"])}${digits(7)}`;
}

const LETTERS = "ABCDEFGHIJLMNOPRSTUVXZ";
const letter = () => LETTERS[int(0, LETTERS.length - 1)];

/** Plate format by year: AA-00-AA since March 2020, 00-AA-00 for 2005–2020. */
export function plate(year: number) {
  const dd = () => digits(2);
  const ll = () => `${letter()}${letter()}`;
  return year >= 2020 ? `${ll()}-${dd()}-${ll()}` : `${dd()}-${ll()}-${dd()}`;
}

/** Portuguese IBAN shape (PT50 + 21 digits) — the check digits are not real. */
export function iban() {
  return `PT50${digits(21)}`;
}

export function maskIban(value: string) {
  return `${value.slice(0, 4)} •••• •••• •••• ${value.slice(-5, -1)} ${value.slice(-1)}`;
}

/** Driving licence: district letter + 6 digits + check digit, e.g. "L-123456 7". */
export function licenceNumber() {
  return `${pick(["L", "P", "FA", "BR", "C", "SE", "AV"])}-${digits(6)} ${digits(1)}`;
}

/** TVDE driver certificate (IMT), e.g. "TVDE-2024-018342". */
export function tvdeNumber(issuedYear: number) {
  return `TVDE-${issuedYear}-${digits(6)}`;
}

export const INSURERS = [
  "Fidelidade",
  "Tranquilidade",
  "Ageas Seguros",
  "Allianz Portugal",
  "Generali",
  "Zurich",
  "Liberty Seguros",
  "Caravela Seguros",
] as const;

export function policyNumber() {
  return `${digits(2)}.${digits(6)}/${int(23, 26)}`;
}

/** Card label for the payment list — brand + last four only (§12). */
export function cardDetail() {
  const brand = weighted([
    ["Visa", 55],
    ["Mastercard", 38],
    ["Amex", 7],
  ] as const);
  return `${brand} •••• ${digits(4)}`;
}

/** MB WAY shows the masked phone the customer approved with. */
export function mbwayDetail(phone: string) {
  return `MB WAY ${phone.slice(0, 4)} ••• ${phone.slice(-3)}`;
}
