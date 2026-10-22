import type { City, Place, StatusChange } from "@/types/common";
import type { Invoice } from "@/types/invoice";
import type { Payment, PaymentMethod, PaymentStatus, Refund } from "@/types/payment";
import type { PricingRule } from "@/types/pricing";
import type { CancellationReason, Ride, RideStatus } from "@/types/ride";
import type { RideCategory } from "@/types/vehicle";
import type { CustomerRecord, DriverRecord, PromotionRecord, VehicleRecord } from "../records";
import { DAY, HOUR, addMinutes, iso, lisbonParts, now, startOfLisbonDay } from "../clock";
import { computeFare, type FareResult } from "../fare";
import { adminsWithRole } from "../fixtures/admins";
import { DEMO, FREQUENT_CUSTOMER_INDEX } from "../fixtures/demo";
import { COUNTS, customerId, invoiceId, invoiceNumber, paymentId, refundId, rideId } from "../ids";
import { CITY_WEIGHTS, SPOTS, haversineKm, lerpPoint, placeAt } from "../places";
import { cardDetail, mbwayDetail } from "../pt";
import { chance, digits, float, hex, int, pick, weighted, withSeed } from "../seed";
import { AIRPORT_SURCHARGE } from "./catalog";

export type RidesBundle = { rides: Ride[]; payments: Payment[]; invoices: Invoice[] };

type Inputs = {
  customers: readonly CustomerRecord[];
  drivers: readonly DriverRecord[];
  vehicles: readonly VehicleRecord[];
  pricingRules: readonly PricingRule[];
  promotions: readonly PromotionRecord[];
};

/** Lisbon hour → relative demand (morning and evening peaks, Friday/Saturday nights). */
const HOUR_WEIGHT = [3, 2, 1.5, 1, 0.8, 1, 2, 5, 8, 7, 5, 5, 6, 6, 5, 5, 6, 8, 9, 8, 7, 6, 6, 5];
const NIGHT_BOOST = [2.2, 2.4, 2.0, 1.5, 1.2]; // Fri/Sat 00–04h
const LIVE_RIDES = 30;
const SCHEDULED_RIDES = 80;

const FINANCE = adminsWithRole("FINANCE_ADMIN");

const METHODS = [
  ["CARD", 45],
  ["MB_WAY", 25],
  ["APPLE_PAY", 12],
  ["GOOGLE_PAY", 8],
  ["WALLET", 5],
  ["CASH", 5],
] as const satisfies readonly (readonly [PaymentMethod, number])[];

const FAILURE_REASONS: Record<PaymentMethod, readonly string[]> = {
  CARD: ["Cartão recusado pelo banco emissor.", "Autenticação 3-D Secure falhada.", "Saldo insuficiente."],
  MB_WAY: ["Pedido MB WAY expirado sem aprovação.", "Pedido MB WAY recusado pelo cliente."],
  APPLE_PAY: ["Token Apple Pay inválido."],
  GOOGLE_PAY: ["Pagamento Google Pay recusado."],
  WALLET: ["Saldo da carteira insuficiente."],
  CASH: ["Pagamento em numerário não confirmado pelo motorista."],
};

const REFUND_REASONS = [
  "Percurso mais longo do que o necessário — reembolso da diferença.",
  "Motorista iniciou a viagem antes de o cliente entrar.",
  "Cobrança duplicada no cartão.",
  "Viagem cancelada pelo motorista mas cobrada.",
  "Taxa de espera cobrada indevidamente.",
  "Veículo diferente do indicado na app.",
];

function gatewayRef(method: PaymentMethod) {
  if (method === "CASH") return undefined;
  if (method === "MB_WAY") return `MBW-${digits(10)}`;
  if (method === "WALLET") return `WLT-${hex(10)}`;
  return `RDQ-${hex(14)}`;
}

/** The fare version in force when the ride was booked. */
function ruleAt(rules: readonly PricingRule[], category: RideCategory, atMs: number) {
  let best: PricingRule | undefined;
  for (const r of rules) {
    if (r.category !== category || r.zoneId || (r.status !== "ACTIVE" && r.status !== "ARCHIVED")) continue;
    if (Date.parse(r.effectiveFrom) > atMs) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best ?? rules.find((r) => r.category === category && r.status === "ACTIVE")!;
}

function speedKmh(hour: number) {
  if ((hour >= 8 && hour <= 9) || (hour >= 17 && hour <= 19)) return 16;
  if (hour >= 22 || hour <= 5) return 32;
  return 23;
}

/**
 * A booking slot on one of the last 90 Lisbon days (today included), weighted
 * by hour (nightlife on Fri/Sat nights). Always exactly three draws and no
 * dependence on the time of day — slots later than "now" are generated too
 * and dropped afterwards (they sort last), so every older ride keeps its ID
 * and content whenever the data is regenerated.
 */
function bookingSlotMs(nowMs: number) {
  const day = int(0, 89);
  const dayStart = startOfLisbonDay(nowMs - day * DAY);
  const { weekday } = lisbonParts(dayStart + 12 * HOUR);
  const weekendNight = weekday === 6 || weekday === 0;
  const hour = weighted(HOUR_WEIGHT.map((w, h) => [h, weekendNight && h < 5 ? w * NIGHT_BOOST[h]! : w] as const));
  const minute = int(0, 59);
  return dayStart + hour * HOUR + minute * 60_000;
}

/** A finished ride's last event is at least this long before "now". */
const FINISHED_MARGIN_MS = 60_000;

/**
 * 20 000 ride slots over the last 90 days (RIDE-860000…879999, oldest first;
 * slots that would end after "now" are dropped, leaving ~19 800), then
 * ~30 happening now (RIDE-880000…, the first is the SOS fixture) and ~80
 * scheduled ones. Payments, refunds and invoices come from the same pass.
 */
export function generateRides(input: Inputs): RidesBundle {
  return withSeed("rides", () => {
    const nowMs = now();
    const vehicleById = new Map(input.vehicles.map((v) => [v.id, v]));

    // Drivers that could have driven in the past, by city and category.
    const pool = new Map<string, DriverRecord[]>();
    const cityPool = new Map<City, DriverRecord[]>();
    for (const d of input.drivers) {
      const v = d.vehicleId ? vehicleById.get(d.vehicleId) : undefined;
      if (!v || (d.verification !== "APPROVED" && d.verification !== "SUSPENDED")) continue;
      if (v.approval !== "APPROVED" && v.approval !== "SUSPENDED") continue;
      const key = `${d.city}|${v.category}`;
      pool.set(key, [...(pool.get(key) ?? []), d]);
      cityPool.set(d.city, [...(cityPool.get(d.city) ?? []), d]);
    }
    const driverFor = (city: City, category: RideCategory) => {
      const list = pool.get(`${city}|${category}`) ?? cityPool.get(city) ?? [...cityPool.values()][0]!;
      return pick(list);
    };

    const customerRegistered = input.customers.map((c) => Date.parse(c.registeredAt));
    // Fixed draws (one chance, one index); an unusable pick walks to the next customer.
    const bookableCustomer = (atMs: number, liveOnly = false) => {
      const frequent = chance(0.004);
      const start = int(0, COUNTS.customers - 1);
      if (frequent) return FREQUENT_CUSTOMER_INDEX;
      for (let step = 0; step < COUNTS.customers; step++) {
        const i = (start + step * 7) % COUNTS.customers;
        if (customerRegistered[i]! > atMs) continue;
        if (liveOnly && input.customers[i]!.status !== "ACTIVE") continue;
        return i;
      }
      return FREQUENT_CUSTOMER_INDEX;
    };

    const promoUses = new Map<string, number>();
    const promoPerCustomer = new Map<string, number>();
    const pickPromo = (atMs: number, category: RideCategory, city: City, custId: string) => {
      const live = input.promotions.filter(
        (p) =>
          (p.enabled || p.code === "NOITE20") &&
          Date.parse(p.startsAt) <= atMs &&
          Date.parse(p.endsAt) >= atMs &&
          p.eligible.categories.includes(category) &&
          p.eligible.cities.includes(city) &&
          (p.usageLimit === undefined || (promoUses.get(p.id) ?? 0) < p.usageLimit) &&
          (promoPerCustomer.get(`${p.id}|${custId}`) ?? 0) < p.perCustomerLimit,
      );
      const preferDemo = chance(0.5);
      const roll = float(0, 1);
      if (!live.length) return undefined;
      // The demo campaign is the most popular one while it runs.
      const demoPromo = live.find((p) => p.id === DEMO.promotionActive);
      return demoPromo && preferDemo ? demoPromo : live[Math.floor(roll * live.length)];
    };

    const rides: Ride[] = [];
    const payments: Payment[] = [];
    const invoiceDrafts: Omit<Invoice, "id" | "number" | "atcud">[] = [];
    let paymentSeq = 0;
    let refundSeq = 0;

    type Trip = { city: City; pickup: Place & { airport: boolean }; dropoff: Place & { airport: boolean }; stops: Place[]; distanceKm: number };
    const trip = (city: City): Trip => {
      const spots = SPOTS[city];
      const a = pick(spots);
      let b = pick(spots);
      while (b === a) b = pick(spots);
      const pickup = placeAt(a, city);
      const dropoff = placeAt(b, city);
      const stops = chance(0.04) ? [placeAt(pick(spots.filter((s) => s !== a && s !== b)), city)] : [];
      const direct = haversineKm(pickup, dropoff) * 1.35;
      const distanceKm = Math.max(1.2, Math.round((direct + stops.length * 1.5) * 10) / 10);
      return { city, pickup, dropoff, stops: stops.map(({ airport: _a, ...p }) => p), distanceKm };
    };
    const stripAirport = ({ airport: _a, ...p }: Place & { airport: boolean }): Place => p;

    const fareFor = (category: RideCategory, t: Trip, atMs: number, durationMin: number, promo?: PromotionRecord, waitingMin = 0): FareResult => {
      const { hour } = lisbonParts(atMs);
      const peak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20) || hour <= 3;
      const surgeRoll = chance(0.25);
      const surgeValue = Math.round(float(1.1, 1.8) * 10) / 10;
      const surge = peak && surgeRoll ? surgeValue : 1;
      const zoneCents = t.pickup.airport || t.dropoff.airport ? AIRPORT_SURCHARGE[t.city] : 0;
      const rule = ruleAt(input.pricingRules, category, atMs);
      const base = { distanceKm: t.distanceKm, durationMin, waitingMin, atMs, surge, zoneCents };
      const plain = computeFare(rule, base);
      if (!promo || (promo.minBookingCents !== undefined && plain.net < promo.minBookingCents)) return plain;
      return computeFare(rule, { ...base, discount: { type: promo.discountType, value: promo.value, maxCents: promo.maxDiscountCents } });
    };

    // ---- 1. Finished rides -------------------------------------------------
    const times = Array.from({ length: COUNTS.rides }, () => bookingSlotMs(nowMs)).sort((a, b) => a - b);

    times.forEach((bookedMs, k) => {
      const id = rideId(k);
      const city = weighted<City>(CITY_WEIGHTS);
      const category = weighted<RideCategory>([
        ["ECONOMY", 60],
        ["COMFORT", 30],
        ["PREMIUM", 10],
      ]);
      const scheduled = chance(0.06);
      const requestMs = bookedMs;
      const bookingMs = scheduled ? bookedMs - int(2, 72) * HOUR : bookedMs;
      // The customer must exist when they booked (scheduled rides are booked ahead).
      const custIndex = bookableCustomer(bookingMs);
      const custId = customerId(custIndex);
      const t = trip(city);
      const { hour } = lisbonParts(bookedMs);
      const durationMin = Math.round((t.distanceKm / speedKmh(hour)) * 60 + int(1, 4));

      let status: RideStatus = weighted<RideStatus>([
        ["COMPLETED", 82],
        ["CANCELLED", 13],
        ["EXPIRED", 5],
      ]);
      if (id === DEMO.ridePartialRefund) status = "COMPLETED";

      const cancelStage = status === "CANCELLED" ? weighted([["SEARCHING", 35], ["ACCEPTED", 45], ["ARRIVED", 20]] as const) : undefined;
      const hasDriver = status === "COMPLETED" || (status === "CANCELLED" && cancelStage !== "SEARCHING");
      const driver = hasDriver ? driverFor(city, category) : undefined;
      const vehicle = driver?.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;
      const rideType = vehicle?.category ?? category;

      const promo = status === "COMPLETED" && chance(0.08) ? pickPromo(bookedMs, rideType, city, custId) : undefined;
      const waitingMin = chance(0.3) ? int(1, 5) : 0;
      const actual = fareFor(rideType, t, bookedMs, durationMin, promo, waitingMin);
      const estimate = fareFor(rideType, t, bookedMs, Math.round(durationMin * float(0.85, 1.05)), promo);
      const promotionId = promo && actual.discount > 0 ? promo.id : undefined;
      if (promotionId) {
        promoUses.set(promotionId, (promoUses.get(promotionId) ?? 0) + 1);
        promoPerCustomer.set(`${promotionId}|${custId}`, (promoPerCustomer.get(`${promotionId}|${custId}`) ?? 0) + 1);
      }

      // Timeline.
      const timeline: StatusChange<RideStatus>[] = [];
      if (scheduled) timeline.push({ status: "SCHEDULED", at: iso(bookingMs), by: custId });
      timeline.push({ status: "REQUESTED", at: iso(requestMs), by: custId });
      let at = addMinutes(requestMs, 0.1);
      timeline.push({ status: "SEARCHING", at: iso(at), by: "SYSTEM" });
      let startedMs: number | undefined;
      let completedMs: number | undefined;
      let cancellation: Ride["cancellation"];

      if (status === "EXPIRED") {
        timeline.push({ status: "EXPIRED", at: iso(addMinutes(at, 5)), by: "SYSTEM", reason: "No driver accepted within 5 minutes" });
      } else if (driver) {
        at = addMinutes(at, float(0.3, 2));
        timeline.push({ status: "ACCEPTED", at: iso(at), by: driver.id });
        timeline.push({ status: "DRIVER_ARRIVING", at: iso(addMinutes(at, 0.1)), by: driver.id });
        at = addMinutes(at, float(3, 9));
        if (!(status === "CANCELLED" && cancelStage === "ACCEPTED")) {
          timeline.push({ status: "DRIVER_ARRIVED", at: iso(at), by: driver.id });
          at = addMinutes(at, float(1, 4) + waitingMin);
        }
        if (status === "COMPLETED") {
          startedMs = at;
          timeline.push({ status: "IN_PROGRESS", at: iso(at), by: driver.id });
          completedMs = addMinutes(at, durationMin);
          timeline.push({ status: "COMPLETED", at: iso(completedMs), by: driver.id });
        }
      }

      if (status === "CANCELLED") {
        const cancelAt = addMinutes(at, float(0.5, 3));
        let by: NonNullable<Ride["cancellation"]>["by"];
        let reason: CancellationReason;
        if (cancelStage === "SEARCHING") {
          by = "CUSTOMER";
          reason = "CUSTOMER_CHANGED_MIND";
        } else {
          by = weighted([["CUSTOMER", 60], ["DRIVER", 36], ["ADMIN", 4]] as const);
          reason =
            by === "CUSTOMER"
              ? pick(["CUSTOMER_CHANGED_MIND", "DRIVER_TOO_FAR"] as const)
              : by === "DRIVER"
                ? cancelStage === "ARRIVED"
                  ? "CUSTOMER_NO_SHOW"
                  : pick(["VEHICLE_ISSUE", "DRIVER_REQUESTED"] as const)
                : pick(["ADMIN_INTERVENTION", "SAFETY_CONCERN"] as const);
        }
        const rule = ruleAt(input.pricingRules, rideType, bookedMs);
        const fee =
          reason === "CUSTOMER_NO_SHOW" || (by === "CUSTOMER" && cancelStage !== "SEARCHING" && chance(0.35))
            ? rule.cancellationFee
            : 0;
        cancellation = { by, reason, feeCents: fee, at: iso(cancelAt) };
        timeline.push({ status: "CANCELLED", at: iso(cancelAt), by: by === "CUSTOMER" ? custId : by === "DRIVER" ? driver!.id : by === "ADMIN" ? "ADM-003" : "SYSTEM", reason });
      }

      // Payment.
      let method = weighted<PaymentMethod>(METHODS);
      if (method === "CASH" && !driver) method = "CARD";
      const chargeCents = status === "COMPLETED" ? actual.total : cancellation?.feeCents ?? 0;
      const chargedAtMs = completedMs ?? (cancellation ? Date.parse(cancellation.at) : undefined);
      let payment: Payment | undefined;
      if (chargeCents > 0 && chargedAtMs) {
        const ageMin = (nowMs - chargedAtMs) / 60_000;
        let pstatus: PaymentStatus = weighted<PaymentStatus>([
          ["SUCCESSFUL", 96.6],
          ["FAILED", method === "CASH" ? 0.2 : 1],
          ["REFUNDED", 0.8],
          ["PARTIALLY_REFUNDED", 1.6],
        ]);
        if (id === DEMO.ridePartialRefund) pstatus = "PARTIALLY_REFUNDED";
        if (method === "CASH" && (pstatus === "REFUNDED" || pstatus === "PARTIALLY_REFUNDED")) pstatus = "SUCCESSFUL";

        const mismatch = chance(0.004);
        const refunds: Refund[] = [];
        if (pstatus === "REFUNDED" || pstatus === "PARTIALLY_REFUNDED") {
          const amount = pstatus === "REFUNDED" ? chargeCents : Math.round(chargeCents * float(0.2, 0.5));
          refunds.push({
            id: refundId(refundSeq++),
            amountCents: amount,
            reason: id === DEMO.ridePartialRefund ? REFUND_REASONS[0]! : pick(REFUND_REASONS),
            adminId: pick(FINANCE).id,
            createdAt: iso(Math.min(nowMs - HOUR, chargedAtMs + int(2, 70) * HOUR)),
            gatewayRef: `RDQ-R${hex(12)}`,
            status: "SUCCESSFUL",
          });
        }
        const customer = input.customers[custIndex]!;
        payment = {
          id: paymentId(paymentSeq++),
          rideId: id,
          customerId: custId,
          amountCents: chargeCents,
          method,
          methodDetail:
            method === "CARD" || method === "APPLE_PAY" || method === "GOOGLE_PAY"
              ? cardDetail()
              : method === "MB_WAY"
                ? mbwayDetail(customer.phone)
                : undefined,
          createdAt: iso(chargedAtMs),
          status: pstatus,
          refundedCents: refunds.reduce((s, r) => s + r.amountCents, 0),
          gatewayRef: gatewayRef(method),
          failureReason: pstatus === "FAILED" ? pick(FAILURE_REASONS[method]) : undefined,
          refunds,
          // Unmatched in the gateway file (~0.4%) or too recent to be in it.
          reconciled: !mismatch && ageMin > 2 * 24 * 60 && pstatus !== "FAILED",
        };
        payments.push(payment);

        if (status === "COMPLETED" && (pstatus === "SUCCESSFUL" || pstatus === "REFUNDED" || pstatus === "PARTIALLY_REFUNDED")) {
          const failed = chance(0.01);
          invoiceDrafts.push({
            rideId: id,
            customerId: custId,
            customerName: customer.name,
            customerNif: customer.nif && (custIndex === FREQUENT_CUSTOMER_INDEX || chance(0.4)) ? customer.nif : undefined,
            issuedAt: iso(chargedAtMs + int(5, 120) * 1000),
            netCents: actual.total - actual.vat,
            vatRate: actual.vatRate,
            vatCents: actual.vat,
            totalCents: actual.total,
            status: failed ? "FAILED" : "ISSUED",
            provider: "e-Fatura (placeholder)",
            failureReason: failed ? pick(["Tempo limite na comunicação com a AT.", "NIF do adquirente inválido.", "Série de faturação não comunicada à AT."]) : undefined,
          });
        }
      }

      const fare = status === "COMPLETED" ? actual : estimate;
      rides.push({
        id,
        customerId: custId,
        driverId: driver?.id,
        vehicleId: vehicle?.id,
        fleetManagerId: driver?.fleetManagerId,
        pickup: stripAirport(t.pickup),
        dropoff: stripAirport(t.dropoff),
        stops: t.stops,
        bookedAt: iso(bookingMs),
        scheduledFor: scheduled ? iso(requestMs) : undefined,
        startedAt: startedMs ? iso(startedMs) : undefined,
        completedAt: completedMs ? iso(completedMs) : undefined,
        rideType,
        estimatedFareCents: estimate.total,
        finalFareCents: status === "COMPLETED" ? actual.total : cancellation?.feeCents || undefined,
        fareBreakdown: {
          base: fare.base,
          distance: fare.distance,
          time: fare.time,
          waiting: fare.waiting,
          booking: fare.booking,
          zone: fare.zone,
          surge: fare.surge,
          discount: fare.discount,
          vatRate: fare.vatRate,
          vat: fare.vat,
          total: fare.total,
        },
        surgeMultiplier: fare.multiplier,
        promotionId,
        payment: { method, status: payment?.status ?? "NOT_CHARGED", paymentId: payment?.id },
        status,
        timeline,
        cancellation,
        distanceKm: t.distanceKm,
        durationMin: status === "COMPLETED" ? durationMin : 0,
        rating: status === "COMPLETED" && chance(0.7) ? weighted([[5, 65], [4, 22], [3, 8], [2, 3], [1, 2]] as const) : undefined,
        notes: [],
      });
    });

    // ---- 2. Scheduled rides (next 7 days) ---------------------------------
    for (let j = 0; j < SCHEDULED_RIDES; j++) {
      const id = rideId(COUNTS.rides + LIVE_RIDES + j);
      const city = weighted<City>(CITY_WEIGHTS);
      const rideType = weighted<RideCategory>([["ECONOMY", 50], ["COMFORT", 35], ["PREMIUM", 15]]);
      const scheduledMs = nowMs + int(30, 7 * 24 * 60) * 60_000;
      const bookedMs = nowMs - int(10, 72 * 60) * 60_000;
      const custId = customerId(bookableCustomer(bookedMs, true));
      const t = trip(city);
      const durationMin = Math.round((t.distanceKm / speedKmh(lisbonParts(scheduledMs).hour)) * 60 + 2);
      const fare = fareFor(rideType, t, scheduledMs, durationMin);
      rides.push({
        id,
        customerId: custId,
        pickup: stripAirport(t.pickup),
        dropoff: stripAirport(t.dropoff),
        stops: t.stops,
        bookedAt: iso(bookedMs),
        scheduledFor: iso(scheduledMs),
        rideType,
        estimatedFareCents: fare.total,
        fareBreakdown: { base: fare.base, distance: fare.distance, time: fare.time, waiting: fare.waiting, booking: fare.booking, zone: fare.zone, surge: fare.surge, discount: fare.discount, vatRate: fare.vatRate, vat: fare.vat, total: fare.total },
        surgeMultiplier: fare.multiplier,
        payment: { method: weighted<PaymentMethod>(METHODS.filter(([m]) => m !== "CASH")), status: "PENDING" },
        status: "SCHEDULED",
        timeline: [{ status: "SCHEDULED", at: iso(bookedMs), by: custId }],
        distanceKm: t.distanceKm,
        durationMin,
        notes: [],
      });
    }

    // ---- 3. Rides happening now (last: who is online depends on the hour) --
    const busy = input.drivers.filter((d) => {
      const v = d.vehicleId ? vehicleById.get(d.vehicleId) : undefined;
      return d.online && v?.operational === "ACTIVE";
    });
    const liveStatuses: RideStatus[] = [
      "EMERGENCY",
      ...Array<RideStatus>(14).fill("IN_PROGRESS"),
      ...Array<RideStatus>(4).fill("DRIVER_ARRIVING"),
      ...Array<RideStatus>(2).fill("ACCEPTED"),
      ...Array<RideStatus>(4).fill("DRIVER_ARRIVED"),
      ...Array<RideStatus>(3).fill("SEARCHING"),
      ...Array<RideStatus>(2).fill("REQUESTED"),
    ];
    const usedDrivers = new Set<string>();
    liveStatuses.slice(0, LIVE_RIDES).forEach((status, j) => {
      const id = rideId(COUNTS.rides + j);
      const needsDriver = status !== "SEARCHING" && status !== "REQUESTED";
      const driver = needsDriver ? busy.find((d) => !usedDrivers.has(d.id) && chance(0.3)) ?? busy.find((d) => !usedDrivers.has(d.id)) : undefined;
      if (driver) usedDrivers.add(driver.id);
      const city = driver?.city ?? weighted<City>(CITY_WEIGHTS);
      const vehicle = driver?.vehicleId ? vehicleById.get(driver.vehicleId) : undefined;
      const rideType = vehicle?.category ?? "ECONOMY";
      const custIndex = bookableCustomer(nowMs, true);
      const custId = customerId(custIndex);
      const t = trip(city);
      const { hour } = lisbonParts(nowMs);
      const durationMin = Math.round((t.distanceKm / speedKmh(hour)) * 60 + 2);

      // Minutes since request, by how far along the ride is.
      const elapsed =
        status === "REQUESTED" ? 0.3 : status === "SEARCHING" ? float(0.5, j === 27 ? 4.5 : 2) : status === "ACCEPTED" ? float(1, 2) : status === "DRIVER_ARRIVING" ? float(2, 6) : status === "DRIVER_ARRIVED" ? float(6, j === 22 ? 14 : 9) : float(9, 9 + durationMin * 0.8);
      const requestMs = nowMs - elapsed * 60_000;
      const timeline: StatusChange<RideStatus>[] = [{ status: "REQUESTED", at: iso(requestMs), by: custId }];
      const order: RideStatus[] = ["SEARCHING", "ACCEPTED", "DRIVER_ARRIVING", "DRIVER_ARRIVED", "IN_PROGRESS"];
      const reach = status === "EMERGENCY" ? 5 : order.indexOf(status) + 1;
      const stepTimes = [0.1, 1, 1.1, 6, 8];
      let startedMs: number | undefined;
      for (let s = 0; s < reach; s++) {
        const stepMs = requestMs + Math.min(stepTimes[s]!, elapsed - 0.05) * 60_000;
        timeline.push({ status: order[s]!, at: iso(stepMs), by: s === 0 ? "SYSTEM" : driver?.id ?? "SYSTEM" });
        if (order[s] === "IN_PROGRESS") startedMs = stepMs;
      }
      if (status === "EMERGENCY") timeline.push({ status: "EMERGENCY", at: iso(nowMs - 4 * 60_000), by: custId, reason: "SOS raised from the customer app" });

      // Driver position: towards pickup before the trip, along the route during it.
      let lastLocation: Ride["lastLocation"];
      if (driver) {
        const progress = startedMs ? Math.min(0.95, (nowMs - startedMs) / (durationMin * 60_000)) : 0;
        const point = startedMs ? lerpPoint(t.pickup, t.dropoff, progress) : lerpPoint(driver.location ?? t.pickup, t.pickup, 0.6);
        // Two stale positions and one ride without location, so the map shows those states (§10).
        const staleMin = j === 3 || j === 9 ? int(6, 9) : 0;
        lastLocation = j === 12 ? undefined : { ...point, at: iso(nowMs - staleMin * 60_000 - int(3, 25) * 1000) };
      }

      const fare = fareFor(rideType, t, requestMs, durationMin);
      rides.push({
        id,
        customerId: custId,
        driverId: driver?.id,
        vehicleId: vehicle?.id,
        fleetManagerId: driver?.fleetManagerId,
        pickup: stripAirport(t.pickup),
        dropoff: stripAirport(t.dropoff),
        stops: [],
        bookedAt: iso(requestMs),
        startedAt: startedMs ? iso(startedMs) : undefined,
        rideType,
        estimatedFareCents: fare.total,
        fareBreakdown: { base: fare.base, distance: fare.distance, time: fare.time, waiting: fare.waiting, booking: fare.booking, zone: fare.zone, surge: fare.surge, discount: fare.discount, vatRate: fare.vatRate, vat: fare.vat, total: fare.total },
        surgeMultiplier: fare.multiplier,
        payment: { method: weighted<PaymentMethod>(METHODS.filter(([m]) => m !== "CASH")), status: "PENDING" },
        status,
        timeline,
        distanceKm: t.distanceKm,
        durationMin,
        lastLocation,
        notes: [],
      });
    });

    // Drop finished rides that would end after "now" (today's later slots).
    // IDs were assigned before this, so the rest keep theirs; the draws for the
    // dropped ones were still made, so the stream is unchanged.
    const dropped = new Set(
      rides
        .filter((r) => !r.id.startsWith("RIDE-88") && r.timeline[r.timeline.length - 1]!.at > iso(nowMs - FINISHED_MARGIN_MS))
        .map((r) => r.id),
    );
    if (dropped.size) {
      for (let i = rides.length - 1; i >= 0; i--) if (dropped.has(rides[i]!.id)) rides.splice(i, 1);
      for (let i = payments.length - 1; i >= 0; i--) if (dropped.has(payments[i]!.rideId)) payments.splice(i, 1);
      for (let i = invoiceDrafts.length - 1; i >= 0; i--) if (dropped.has(invoiceDrafts[i]!.rideId)) invoiceDrafts.splice(i, 1);
    }

    // The newest non-cash payments are still in flight: MB WAY waiting for the
    // customer's approval, cards being captured — so both states always show.
    const inFlight = new Set<string>();
    const recent = payments.filter((p) => p.status === "SUCCESSFUL" && p.method !== "CASH").slice(-8);
    recent.forEach((p, n) => {
      p.status = n < 3 ? "PENDING" : "PROCESSING";
      if (p.status === "PENDING") {
        p.method = "MB_WAY";
        p.gatewayRef = gatewayRef("MB_WAY");
        p.methodDetail = mbwayDetail(input.customers[Number(p.customerId.slice(4)) - 10000]!.phone);
      }
      p.reconciled = false;
      inFlight.add(p.rideId);
      const ride = rides.find((r) => r.id === p.rideId)!;
      ride.payment = { ...ride.payment, method: p.method, status: p.status };
    });

    // ---- Invoices: numbered in issue order (one series per year) ----------
    // Not for payments still in flight (the invoice is issued on capture).
    for (let i = invoiceDrafts.length - 1; i >= 0; i--) if (inFlight.has(invoiceDrafts[i]!.rideId)) invoiceDrafts.splice(i, 1);
    invoiceDrafts.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
    const perYear = new Map<number, number>();
    const invoices: Invoice[] = invoiceDrafts.map((draft, i) => {
      const year = new Date(draft.issuedAt).getUTCFullYear();
      const seq = (perYear.get(year) ?? 0) + 1;
      perYear.set(year, seq);
      return {
        id: invoiceId(i),
        number: invoiceNumber(year, seq),
        atcud: draft.status === "ISSUED" ? `JJ3K7M2P-${seq}` : undefined,
        ...draft,
      };
    });

    return { rides, payments, invoices };
  });
}
