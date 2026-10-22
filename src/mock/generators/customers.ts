import type { CustomerStatus } from "@/types/customer";
import type { CustomerRecord } from "../records";
import { DAY, iso, now, today } from "../clock";
import { DEMO } from "../fixtures/demo";
import { customerId, COUNTS, noteId } from "../ids";
import { nif, mobile } from "../pt";
import { chance, emailFor, float, personName, weighted, withSeed } from "../seed";

/** 2 500 customers registered over the last 3 years, more of them recently. */
export function generateCustomers(): CustomerRecord[] {
  return withSeed("customers", () => {
    const nowMs = now();
    // Sign-ups are day-aligned (rides check them against booking time).
    const dayMs = today();
    const rows: CustomerRecord[] = [];
    for (let i = 0; i < COUNTS.customers; i++) {
      const id = customerId(i);
      const { name } = personName();
      // Skewed towards recent sign-ups; the first 20 are long-standing (fixtures live there).
      const ageDays = i < 20 ? 300 + i * 20 : Math.floor(1095 * float(0, 1) ** 1.6) + 1;
      const recent = ageDays <= 30;
      const status = weighted<CustomerStatus>([
        ["ACTIVE", 91],
        ["PENDING_VERIFICATION", recent ? 25 : 0],
        ["SUSPENDED", 2.5],
        ["DEACTIVATED", 3.5],
      ]);
      rows.push({
        id,
        name,
        email: emailFor(name, 10000 + i),
        phone: mobile(),
        nif: chance(0.35) ? nif() : undefined,
        registeredAt: iso(dayMs - ageDays * DAY + Math.floor(float(0, DAY))),
        status,
        verification: status === "PENDING_VERIFICATION" || chance(0.06) ? "UNVERIFIED" : "VERIFIED",
        language: chance(0.8) ? "pt" : "en",
        notes: [],
      });
    }

    // Fixtures (fixtures/demo.ts).
    const suspended = rows.find((c) => c.id === DEMO.customerSuspended)!;
    suspended.status = "SUSPENDED";
    suspended.verification = "VERIFIED";
    suspended.notes = [
      {
        id: noteId(1),
        text: "Três faltas de comparência em 10 dias (motoristas esperaram mais de 10 min). Conta suspensa até contacto com o apoio.",
        authorId: "ADM-005",
        authorName: "Beatriz Lopes",
        createdAt: iso(nowMs - 2 * DAY),
      },
    ];
    const frequent = rows.find((c) => c.id === DEMO.customerFrequent)!;
    frequent.status = "ACTIVE";
    frequent.verification = "VERIFIED";
    frequent.nif = frequent.nif ?? nif("2");
    return rows;
  });
}
