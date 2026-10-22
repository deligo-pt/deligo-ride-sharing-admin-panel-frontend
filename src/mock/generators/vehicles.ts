import type { StatusChange } from "@/types/common";
import type { ComplianceDocument, DocumentStatus } from "@/types/document";
import type { RideCategory, VehicleApproval, VehicleColour, VehicleOperational, VehicleType } from "@/types/vehicle";
import type { VehicleRecord } from "../records";
import { DAY, HOUR, iso, now } from "../clock";
import { credentialStatus } from "../derive";
import { adminsWithRole } from "../fixtures/admins";
import { DEMO } from "../fixtures/demo";
import { COUNTS, driverId, fleetId, fleetIndexOfVehicle, vehicleId } from "../ids";
import { INSURERS, plate, policyNumber } from "../pt";
import { chance, int, pick, weighted, withSeed } from "../seed";
import { expiryFrom, makeDocument, pickReason } from "./document-factory";

export type VehiclesBundle = { vehicles: VehicleRecord[]; documents: ComplianceDocument[] };

const REVIEWERS = adminsWithRole("VERIFICATION_OFFICER");

type Model = { make: string; model: string; type: VehicleType; electric?: boolean };

/** Cars common in Portuguese TVDE fleets, by the category they serve. */
const MODELS: Record<RideCategory, readonly Model[]> = {
  ECONOMY: [
    { make: "Toyota", model: "Corolla", type: "Sedan" },
    { make: "Toyota", model: "Prius", type: "Hatchback" },
    { make: "Renault", model: "Clio", type: "Hatchback" },
    { make: "Dacia", model: "Logan", type: "Sedan" },
    { make: "Dacia", model: "Jogger", type: "SUV" },
    { make: "Skoda", model: "Octavia", type: "Sedan" },
    { make: "Seat", model: "León", type: "Hatchback" },
    { make: "Nissan", model: "Leaf", type: "Hatchback", electric: true },
    { make: "Hyundai", model: "Ioniq", type: "Hatchback" },
    { make: "Peugeot", model: "308", type: "Hatchback" },
    { make: "Kia", model: "Ceed", type: "Hatchback" },
    { make: "Fiat", model: "500e", type: "Micro", electric: true },
  ],
  COMFORT: [
    { make: "Tesla", model: "Model 3", type: "Sedan", electric: true },
    { make: "Kia", model: "Niro EV", type: "SUV", electric: true },
    { make: "Toyota", model: "C-HR", type: "SUV" },
    { make: "Hyundai", model: "Kona Electric", type: "SUV", electric: true },
    { make: "Skoda", model: "Superb", type: "Sedan" },
    { make: "Volkswagen", model: "Passat", type: "Sedan" },
    { make: "Peugeot", model: "508", type: "Sedan" },
    { make: "MG", model: "MG4", type: "Hatchback", electric: true },
  ],
  PREMIUM: [
    { make: "Mercedes-Benz", model: "Classe E", type: "Sedan" },
    { make: "BMW", model: "Série 5", type: "Sedan" },
    { make: "Tesla", model: "Model Y", type: "SUV", electric: true },
    { make: "Mercedes-Benz", model: "EQE", type: "Sedan", electric: true },
    { make: "Volvo", model: "XC60", type: "SUV" },
    { make: "Audi", model: "A6", type: "Sedan" },
  ],
};

const COLOURS = [
  ["BLACK", 30],
  ["WHITE", 22],
  ["GREY", 20],
  ["SILVER", 14],
  ["BLUE", 9],
  ["RED", 3],
  ["GREEN", 1],
  ["BEIGE", 1],
] as const satisfies readonly (readonly [VehicleColour, number])[];

/**
 * 700 vehicles: VEH-5000…5599 belong to drivers DRV-20000…20599 (same index),
 * VEH-5600…5699 are spare fleet cars. The vehicle's category sets which rides
 * its driver gets. TVDE rules: cars at most 7 years old, insurance covering
 * passenger transport, yearly inspection (IPO).
 */
export function generateVehicles(): VehiclesBundle {
  return withSeed("vehicles", () => {
    const nowMs = now();
    const thisYear = new Date(nowMs).getUTCFullYear();
    const vehicles: VehicleRecord[] = [];
    const documents: ComplianceDocument[] = [];

    for (let i = 0; i < COUNTS.vehicles; i++) {
      const id = vehicleId(i);
      const ownedByDriver = i < COUNTS.drivers;
      const category = weighted<RideCategory>([
        ["ECONOMY", 60],
        ["COMFORT", 30],
        ["PREMIUM", 10],
      ]);
      const model = pick(MODELS[category]);
      const year = int(thisYear - 6, thisYear);
      const fleetIndex = fleetIndexOfVehicle(i);
      const registeredMs = nowMs - int(ownedByDriver ? 30 : 5, 800) * DAY;

      const insuranceExp = expiryFrom(nowMs, { minDays: 30, maxDays: 365, soonShare: 0.06, pastShare: 0.02 });
      const inspectionExp = expiryFrom(nowMs, { minDays: 30, maxDays: 365, soonShare: 0.06, pastShare: 0.02 });

      let approval: VehicleApproval = weighted<VehicleApproval>([
        ["APPROVED", 88],
        ["PENDING_REVIEW", 7],
        ["REJECTED", 2],
        ["SUSPENDED", 3],
      ]);
      if (id === DEMO.vehiclePending) approval = "PENDING_REVIEW";
      const insuranceExpired = insuranceExp < nowMs;
      const operational: VehicleOperational =
        approval === "SUSPENDED" || (approval === "APPROVED" && insuranceExpired)
          ? "SUSPENDED"
          : approval !== "APPROVED"
            ? "INACTIVE"
            : !ownedByDriver && chance(0.5)
              ? "INACTIVE"
              : "ACTIVE";

      const docSpecs = [
        { type: "INSURANCE" as const, expiresMs: insuranceExp },
        { type: "INSPECTION" as const, expiresMs: inspectionExp },
        { type: "VEHICLE_REGISTRATION" as const, expiresMs: undefined },
      ];
      const rejectedDoc = approval === "REJECTED" ? pick(docSpecs).type : undefined;
      docSpecs.forEach((spec, k) => {
        const status: DocumentStatus =
          spec.type === rejectedDoc ? "REJECTED" : approval === "PENDING_REVIEW" ? "PENDING" : "APPROVED";
        documents.push(
          makeDocument({
            ownerType: "VEHICLE",
            ownerId: id,
            type: spec.type,
            seq: i * 3 + k,
            submittedMs:
              id === DEMO.vehiclePending && spec.type === "INSURANCE"
                ? nowMs - 3 * HOUR
                : approval === "PENDING_REVIEW"
                  ? nowMs - int(4, 96) * HOUR
                  : registeredMs + int(1, 30) * HOUR,
            expiresMs: spec.expiresMs,
            status,
            reviewerId: status === "PENDING" ? undefined : pick(REVIEWERS).id,
            rejectionReason: status === "REJECTED" ? pickReason(spec.type) : undefined,
          }),
        );
      });

      const statusHistory: StatusChange<VehicleApproval | VehicleOperational>[] = [
        { status: "PENDING_REVIEW", at: iso(registeredMs), by: ownedByDriver ? driverId(i) : fleetId(fleetIndex ?? 0) },
      ];
      if (approval !== "PENDING_REVIEW")
        statusHistory.push({ status: approval === "SUSPENDED" ? "APPROVED" : approval, at: iso(registeredMs + int(1, 5) * DAY), by: pick(REVIEWERS).id });
      if (operational === "SUSPENDED")
        statusHistory.push({
          status: "SUSPENDED",
          at: iso(nowMs - int(1, 25) * DAY),
          by: "ADM-003",
          reason: insuranceExpired ? "Seguro caducado." : "Inspeção periódica (IPO) reprovada.",
        });

      vehicles.push({
        id,
        plate: plate(year),
        make: model.make,
        model: model.model,
        year,
        colour: weighted<VehicleColour>(COLOURS),
        category,
        type: model.type,
        seats: model.type === "Micro" ? 3 : category === "PREMIUM" && model.type === "SUV" ? 6 : 4,
        electric: Boolean(model.electric),
        driverId: ownedByDriver ? driverId(i) : undefined,
        fleetManagerId: fleetIndex === undefined ? undefined : fleetId(fleetIndex),
        insurance: {
          policyNo: policyNumber(),
          insurer: pick(INSURERS),
          expiresAt: iso(insuranceExp),
          status: credentialStatus(iso(insuranceExp), nowMs),
        },
        inspection: { expiresAt: iso(inspectionExp), status: credentialStatus(iso(inspectionExp), nowMs) },
        approval,
        operational,
        registeredAt: iso(registeredMs),
        statusHistory,
      });
    }
    return { vehicles, documents };
  });
}
