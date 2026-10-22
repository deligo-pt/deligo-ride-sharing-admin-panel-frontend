import type { AccountStatus, City, StatusChange } from "@/types/common";
import type { ComplianceDocument, DocumentStatus, DocumentType } from "@/types/document";
import type { DriverVerification } from "@/types/driver";
import type { DriverRecord } from "../records";
import { DAY, HOUR, iso, lisbonParts, now } from "../clock";
import { credentialStatus } from "../derive";
import { adminsWithRole } from "../fixtures/admins";
import { DEMO } from "../fixtures/demo";
import { COUNTS, driverId, fleetId, fleetIndexOfDriver, noteId, vehicleOfDriver } from "../ids";
import { CITY_WEIGHTS, nearCentre } from "../places";
import { iban, licenceNumber, mobile, nif, tvdeNumber } from "../pt";
import { chance, emailFor, float, int, personName, pick, weighted, withSeed } from "../seed";
import { expiryFrom, makeDocument, pickReason } from "./document-factory";

export type DriversBundle = { drivers: DriverRecord[]; documents: ComplianceDocument[] };

const REVIEWERS = adminsWithRole("VERIFICATION_OFFICER");

/**
 * 600 drivers with their compliance documents. Verification state and
 * documents are generated together so they always agree.
 */
export function generateDrivers(): DriversBundle {
  return withSeed("drivers", () => {
    const nowMs = now();
    const hour = lisbonParts(nowMs).hour;
    // Share of approved drivers online right now — busier in the day and evening.
    const onlineShare = hour >= 7 && hour <= 23 ? 0.38 : 0.12;
    const drivers: DriverRecord[] = [];
    const documents: ComplianceDocument[] = [];

    for (let i = 0; i < COUNTS.drivers; i++) {
      const id = driverId(i);
      const { name, sex } = personName(chance(0.82) ? "male" : "female");
      let verification = weighted<DriverVerification>([
        ["APPROVED", 78],
        ["UNDER_REVIEW", 6],
        ["PENDING_DOCS", 6],
        ["NOT_SUBMITTED", 3],
        ["REJECTED", 3],
        ["SUSPENDED", 4],
      ]);
      if (id === DEMO.driverUnderReview) verification = "UNDER_REVIEW";
      if (id === DEMO.driverRejected) verification = "REJECTED";
      if (([DEMO.driverTvdeExpiring, DEMO.driverLicenceExpired, DEMO.driverFailedPayout] as string[]).includes(id))
        verification = "APPROVED";

      const applicant = verification === "NOT_SUBMITTED" || verification === "PENDING_DOCS" || verification === "UNDER_REVIEW";
      const joinedMs = applicant ? nowMs - int(1, 25) * DAY - int(0, 23) * HOUR : nowMs - int(40, 900) * DAY;
      const accountStatus: AccountStatus = verification === "SUSPENDED" ? "SUSPENDED" : chance(0.01) ? "DEACTIVATED" : "ACTIVE";
      const city = weighted<City>(CITY_WEIGHTS);
      const foreign = chance(0.22); // many TVDE drivers hold a residence permit

      // Credentials (expiry drives VALID / EXPIRING_SOON / EXPIRED).
      let licenceExp = expiryFrom(nowMs, { minDays: 200, maxDays: 3650, soonShare: 0.02, pastShare: 0.01 });
      let tvdeExp = expiryFrom(nowMs, { minDays: 120, maxDays: 1800, soonShare: 0.05, pastShare: 0.02 });
      if (id === DEMO.driverTvdeExpiring) tvdeExp = nowMs + 6 * DAY;
      if (id === DEMO.driverLicenceExpired) licenceExp = nowMs - 3 * DAY;
      if (id === DEMO.driverTvdeExpiring) licenceExp = nowMs + 900 * DAY;
      const tvdeYear = new Date(tvdeExp - 5 * 365 * DAY).getUTCFullYear();

      // Documents.
      const docTypes: DocumentType[] = [
        "DRIVING_LICENCE",
        "TVDE_CERTIFICATE",
        foreign ? "RESIDENCE_PERMIT" : "ID_CARD",
        "CRIMINAL_RECORD",
        "NIF_PROOF",
        "IBAN_PROOF",
      ];
      const submitted =
        verification === "NOT_SUBMITTED"
          ? []
          : verification === "PENDING_DOCS"
            ? docTypes.slice(0, int(2, 4))
            : docTypes;
      const rejectedType: DocumentType | undefined =
        verification === "REJECTED" ? (id === DEMO.driverRejected ? "CRIMINAL_RECORD" : pick(docTypes)) : undefined;
      // ~5% of approved drivers have just uploaded a renewal that waits for review.
      const renewal: DocumentType | undefined =
        verification === "APPROVED" && chance(0.05) ? pick(["DRIVING_LICENCE", "TVDE_CERTIFICATE", "IBAN_PROOF"] as const) : undefined;

      const driverDocs = submitted.map((type, k) => {
        const expiresMs =
          type === "DRIVING_LICENCE"
            ? licenceExp
            : type === "TVDE_CERTIFICATE"
              ? tvdeExp
              : type === "ID_CARD" || type === "RESIDENCE_PERMIT"
                ? expiryFrom(nowMs, { minDays: 150, maxDays: 3000, soonShare: 0.02 })
                : undefined;
        const status: DocumentStatus =
          type === rejectedType
            ? "REJECTED"
            : verification === "UNDER_REVIEW" || verification === "PENDING_DOCS"
              ? "PENDING"
              : type === renewal
                ? "PENDING"
                : "APPROVED";
        const submittedMs =
          status === "PENDING" && verification === "APPROVED" ? nowMs - int(1, 48) * HOUR : joinedMs + int(0, 3) * DAY;
        return makeDocument({
          ownerType: "DRIVER",
          ownerId: id,
          type,
          seq: i * 7 + k,
          submittedMs: Math.min(submittedMs, nowMs - HOUR),
          expiresMs,
          status,
          reviewerId: status === "PENDING" ? undefined : pick(REVIEWERS).id,
          rejectionReason: status === "REJECTED" ? pickReason(type) : undefined,
        });
      });
      documents.push(...driverDocs);

      const statusHistory: StatusChange<DriverVerification | AccountStatus>[] = [
        { status: "NOT_SUBMITTED", at: iso(joinedMs), by: id },
      ];
      if (submitted.length) statusHistory.push({ status: verification === "PENDING_DOCS" ? "PENDING_DOCS" : "UNDER_REVIEW", at: iso(joinedMs + DAY), by: id });
      if (verification === "APPROVED" || verification === "SUSPENDED")
        statusHistory.push({ status: "APPROVED", at: iso(joinedMs + int(2, 6) * DAY), by: pick(REVIEWERS).id });
      if (verification === "REJECTED")
        statusHistory.push({ status: "REJECTED", at: iso(joinedMs + int(2, 6) * DAY), by: pick(REVIEWERS).id, reason: rejectedType ? pickReason(rejectedType) : undefined });
      if (verification === "SUSPENDED")
        statusHistory.push({
          status: "SUSPENDED",
          at: iso(nowMs - int(1, 30) * DAY),
          by: "ADM-003",
          reason: pick([
            "Várias queixas de condução perigosa em investigação.",
            "Seguro do veículo caducado — suspensão até envio da nova apólice.",
            "Taxa de cancelamento acima de 30% nas últimas 2 semanas.",
          ]),
        });

      const approvedActive = verification === "APPROVED" && accountStatus === "ACTIVE";
      // Same draws whatever the hour (onlineShare changes with it), so the stream stays in sync.
      const onlineRoll = float(0, 1);
      const position = nearCentre(city);
      const reportedSecondsAgo = int(5, 90);
      const online = approvedActive && onlineRoll < onlineShare;
      const fleetIndex = fleetIndexOfDriver(i);

      drivers.push({
        id,
        name,
        email: emailFor(name, 20000 + i),
        phone: mobile(),
        nif: nif(chance(0.7) ? "2" : "1"),
        iban: iban(),
        photoUrl: `https://i.pravatar.cc/150?u=${id}-${sex}`,
        joinedAt: iso(joinedMs),
        verification,
        licence: { number: licenceNumber(), expiresAt: iso(licenceExp), status: credentialStatus(iso(licenceExp), nowMs) },
        tvde: {
          number: tvdeNumber(tvdeYear),
          expiresAt: iso(tvdeExp),
          status: credentialStatus(iso(tvdeExp), nowMs),
        },
        fleetManagerId: fleetIndex === undefined ? undefined : fleetId(fleetIndex),
        // Applicants register their car at sign-up, so every driver has one.
        vehicleId: vehicleOfDriver(i),
        online,
        location: online ? { ...position, at: iso(nowMs - reportedSecondsAgo * 1000) } : undefined,
        rating: verification === "APPROVED" || verification === "SUSPENDED" ? Math.round(float(4.3, 5) * 10) / 10 : 0,
        accountStatus,
        city,
        statusHistory,
        notes:
          verification === "SUSPENDED"
            ? [
                {
                  id: noteId(100 + i),
                  text: "Motorista contactado por telefone; aguarda documentação para reavaliar.",
                  authorId: "ADM-003",
                  authorName: "Marta Oliveira",
                  createdAt: iso(nowMs - int(1, 20) * DAY),
                },
              ]
            : [],
      });
    }
    return { drivers, documents };
  });
}
