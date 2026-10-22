import type { CredentialStatus, ISODate } from "@/types/common";
import type { DocumentStatus, DocumentType } from "@/types/document";
import type { CommissionRule } from "@/types/finance";
import type { RideCategory } from "@/types/vehicle";
import { DAY } from "./clock";

/**
 * Rules shared by generators and services (the "business rules" a backend
 * would own). Pure functions — `nowMs` is passed in.
 */

/** Warn this many days before a licence, certificate or policy expires. */
export const EXPIRY_WARNING_DAYS = 30;

export function credentialStatus(expiresAt: ISODate | undefined, nowMs: number): CredentialStatus {
  if (!expiresAt) return "MISSING";
  const left = Date.parse(expiresAt) - nowMs;
  if (left < 0) return "EXPIRED";
  if (left < EXPIRY_WARNING_DAYS * DAY) return "EXPIRING_SOON";
  return "VALID";
}

/** A document past its expiry date counts as EXPIRED whatever its review said. */
export function effectiveDocumentStatus(
  status: DocumentStatus,
  expiresAt: ISODate | undefined,
  nowMs: number,
): DocumentStatus {
  if (status === "APPROVED" && expiresAt && Date.parse(expiresAt) < nowMs) return "EXPIRED";
  return status;
}

/**
 * Mandatory documents per owner (proposal — to be confirmed against TVDE law,
 * §6/§18). Identity: either the citizen card or a residence permit.
 */
export const MANDATORY_DRIVER_DOCS: readonly (DocumentType | readonly DocumentType[])[] = [
  "DRIVING_LICENCE",
  "TVDE_CERTIFICATE",
  ["ID_CARD", "RESIDENCE_PERMIT"],
  "CRIMINAL_RECORD",
  "NIF_PROOF",
  "IBAN_PROOF",
];

export const MANDATORY_VEHICLE_DOCS: readonly DocumentType[] = [
  "INSURANCE",
  "INSPECTION",
  "VEHICLE_REGISTRATION",
];

export const MANDATORY_FLEET_DOCS: readonly DocumentType[] = [
  "COMPANY_CERTIFICATE",
  "NIF_PROOF",
  "IBAN_PROOF",
];

/** True when every mandatory document has a currently-valid approved copy. */
export function hasValidDocuments(
  docs: readonly { type: DocumentType; status: DocumentStatus; expiresAt?: ISODate }[],
  mandatory: readonly (DocumentType | readonly DocumentType[])[],
  nowMs: number,
) {
  const valid = new Set(
    docs
      .filter((d) => effectiveDocumentStatus(d.status, d.expiresAt, nowMs) === "APPROVED")
      .map((d) => d.type),
  );
  return mandatory.every((need) =>
    typeof need === "string" ? valid.has(need) : need.some((alt) => valid.has(alt)),
  );
}

/** Commission rate for a category at a moment (the rule in force then). */
export function commissionRateAt(rules: readonly CommissionRule[], category: RideCategory, atMs: number) {
  let best: CommissionRule | undefined;
  for (const r of rules) {
    if (r.category !== category || Date.parse(r.effectiveFrom) > atMs) continue;
    if (r.effectiveTo && Date.parse(r.effectiveTo) <= atMs) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best?.rate ?? 0.2;
}

export type RequirementResult = {
  options: DocumentType[];
  state: "OK" | "PENDING" | "REJECTED" | "EXPIRED" | "MISSING";
  documentId?: string;
};

/**
 * Per mandatory document: OK when a valid approved copy exists, otherwise the
 * most useful reason it isn't (pending review, rejected, expired, or never
 * sent). The screens list the unmet ones (§6).
 */
export function documentRequirements(
  docs: readonly { id: string; type: DocumentType; status: DocumentStatus; expiresAt?: ISODate }[],
  mandatory: readonly (DocumentType | readonly DocumentType[])[],
  nowMs: number,
): RequirementResult[] {
  const rank: Record<RequirementResult["state"], number> = { OK: 4, PENDING: 3, REJECTED: 2, EXPIRED: 1, MISSING: 0 };
  return mandatory.map((need) => {
    const options = typeof need === "string" ? [need] : [...need];
    let best: RequirementResult = { options, state: "MISSING" };
    for (const d of docs) {
      if (!options.includes(d.type)) continue;
      const state = effectiveDocumentStatus(d.status, d.expiresAt, nowMs);
      const mapped: RequirementResult["state"] = state === "APPROVED" ? "OK" : state;
      if (rank[mapped] > rank[best.state]) best = { options, state: mapped, documentId: d.id };
    }
    return best;
  });
}
