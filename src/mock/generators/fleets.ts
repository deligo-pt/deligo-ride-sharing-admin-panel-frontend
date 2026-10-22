import type { AccountStatus, City, StatusChange } from "@/types/common";
import type { ComplianceDocument, DocumentStatus, DocumentType } from "@/types/document";
import type { FleetVerification } from "@/types/fleet";
import type { FleetRecord } from "../records";
import { DAY, HOUR, iso, now } from "../clock";
import { adminsWithRole } from "../fixtures/admins";
import { DEMO } from "../fixtures/demo";
import { APPROVED_FLEET_SLOTS, COUNTS, fleetId } from "../ids";
import { SPOTS, CITY_WEIGHTS } from "../places";
import { iban, mobile, nif } from "../pt";
import { faker, int, personName, pick, slug, weighted, withSeed, workEmail } from "../seed";
import { expiryFrom, makeDocument, pickReason } from "./document-factory";

export type FleetsBundle = { fleets: FleetRecord[]; documents: ComplianceDocument[] };

const REVIEWERS = adminsWithRole("VERIFICATION_OFFICER");

const COMPANY_STYLES = [
  (s: string) => `${s} TVDE, Lda`,
  (s: string) => `Transportes ${s} & Filhos, Lda`,
  (s: string) => `${s} Mobilidade, Unipessoal Lda`,
  (s: string) => `Frota ${s}, Lda`,
  (s: string) => `${s} Drive, Lda`,
] as const;

const PLACE_COMPANIES: Record<City, readonly string[]> = {
  LISBOA: ["Lisboa Executive Cars, Lda", "Tejo Rides, Lda", "Alfama Transfers, Lda", "Belém Mobility, Lda"],
  PORTO: ["Douro Drivers, Lda", "Invicta TVDE, Lda", "Ribeira Cars, Unipessoal Lda"],
  FARO: ["Algarve Transfers, Lda", "Ria Formosa Mobilidade, Lda"],
};

/**
 * 40 fleet operators. FLT-300…335 are approved and get drivers by formula
 * (ids.ts); FLT-336…339 applied recently and have none yet.
 */
export function generateFleets(): FleetsBundle {
  return withSeed("fleets", () => {
    const nowMs = now();
    const fleets: FleetRecord[] = [];
    const documents: ComplianceDocument[] = [];
    const usedNames = new Set<string>();

    for (let i = 0; i < COUNTS.fleets; i++) {
      const id = fleetId(i);
      const city = weighted<City>(CITY_WEIGHTS);
      let companyName = faker.helpers.maybe(() => pick(PLACE_COMPANIES[city]), { probability: 0.25 }) ?? pick(COMPANY_STYLES)(faker.person.lastName());
      while (usedNames.has(companyName)) companyName = pick(COMPANY_STYLES)(faker.person.lastName());
      usedNames.add(companyName);

      const applicant = i >= APPROVED_FLEET_SLOTS;
      const verification: FleetVerification = !applicant ? "APPROVED" : i === 38 ? "REJECTED" : "PENDING";
      const registeredMs = applicant
        ? id === DEMO.fleetPending
          ? nowMs - 2 * DAY
          : nowMs - int(3, 20) * DAY
        : nowMs - int(120, 1000) * DAY;
      const accountStatus: AccountStatus = i === 17 ? "SUSPENDED" : "ACTIVE";
      const { name: contactName } = personName();

      const docTypes: DocumentType[] = ["COMPANY_CERTIFICATE", "NIF_PROOF", "IBAN_PROOF"];
      docTypes.forEach((type, k) => {
        const status: DocumentStatus =
          verification === "APPROVED" ? "APPROVED" : verification === "REJECTED" && type === "COMPANY_CERTIFICATE" ? "REJECTED" : verification === "REJECTED" ? "APPROVED" : "PENDING";
        documents.push(
          makeDocument({
            ownerType: "FLEET",
            ownerId: id,
            type,
            seq: i * 4 + k,
            submittedMs: registeredMs + int(1, 20) * HOUR,
            // A certidão permanente is valid for one year.
            expiresMs: type === "COMPANY_CERTIFICATE" ? expiryFrom(nowMs, { minDays: 40, maxDays: 360, soonShare: 0.1 }) : undefined,
            status,
            reviewerId: status === "PENDING" ? undefined : pick(REVIEWERS).id,
            rejectionReason: status === "REJECTED" ? pickReason(type) : undefined,
          }),
        );
      });

      const statusHistory: StatusChange<FleetVerification | AccountStatus>[] = [
        { status: "PENDING", at: iso(registeredMs), by: id },
      ];
      if (verification !== "PENDING")
        statusHistory.push({
          status: verification,
          at: iso(registeredMs + int(2, 8) * DAY),
          by: pick(REVIEWERS).id,
          reason: verification === "REJECTED" ? "Certidão permanente sem CAE de transporte de passageiros." : undefined,
        });
      if (accountStatus === "SUSPENDED")
        statusHistory.push({
          status: "SUSPENDED",
          at: iso(nowMs - 9 * DAY),
          by: "ADM-002",
          reason: "Faturação em atraso e 3 viaturas com inspeção caducada.",
        });

      const spot = pick(SPOTS[city]);
      fleets.push({
        id,
        companyName,
        contactName,
        email: workEmail(contactName, `${slug(companyName).replace(/-(lda|unipessoal)/g, "").slice(0, 18)}.pt`),
        phone: mobile(),
        nif: nif("5"),
        iban: iban(),
        address: spot.address,
        registeredAt: iso(registeredMs),
        verification,
        accountStatus,
        statusHistory,
      });
    }
    return { fleets, documents };
  });
}
