import type { Page } from "@/types/common";
import type { Promotion, PromotionInput, PromotionListParams, PromotionPerformance, Redemption } from "@/types/promotion";
import { ServiceError } from "@/lib/service-error";
import { lisbonDay } from "@/mock/clock";
import { inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { actor, audit, backend, clone, diff, nowIso, requireReason, type Backend } from "./_shared";
import { toPromotion } from "./_views";

/** Promotions — requirements §14. Eligibility is checked by the backend at booking; this is the admin side. */

/**
 * Sort fields: code, startsAt, endsAt, redemptions, revenueImpactCents.
 * // API: GET /admin/promotions
 */
export async function listPromotions(params: PromotionListParams): Promise<Page<Promotion>> {
  const b = await backend();
  const rows = b.db.promotions
    .all()
    .filter((p) => matchesQuery(params.q, p.code, p.name.pt, p.name.en, p.id))
    .map((p) => toPromotion(b, p))
    .filter((p) => inSet(p.state, params.state));
  const sorted = sortRows(
    rows,
    params.sort,
    {
      code: (p) => p.code,
      startsAt: (p) => p.startsAt,
      endsAt: (p) => p.endsAt,
      redemptions: (p) => p.redemptions,
      revenueImpactCents: (p) => p.revenueImpactCents,
    },
    "startsAt:desc",
  );
  return paginate(sorted, params.page, params.pageSize);
}

/** // API: GET /admin/promotions/:id */
export async function getPromotion(id: string): Promise<Promotion> {
  const b = await backend();
  return clone(toPromotion(b, b.db.promotions.require(id)));
}

function validate(b: Backend, input: PromotionInput, selfId?: string) {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,20}$/.test(code)) throw new ServiceError("VALIDATION", "Code: 4–20 letters or digits", "code");
  if (b.db.promotions.all().some((p) => p.id !== selfId && p.code === code)) throw new ServiceError("CONFLICT", "Code already exists", "code");
  if (!input.name.pt.trim() || !input.name.en.trim()) throw new ServiceError("VALIDATION", "Name is required in both languages", "name");
  if (input.discountType === "PERCENTAGE" && !(input.value > 0 && input.value <= 1)) throw new ServiceError("VALIDATION", "Percentage must be 1–100%", "value");
  if (input.discountType === "FLAT" && !(Number.isInteger(input.value) && input.value > 0)) throw new ServiceError("VALIDATION", "Amount must be more than 0", "value");
  if (input.endsAt <= input.startsAt) throw new ServiceError("VALIDATION", "End must be after start", "endsAt");
  if (input.perCustomerLimit < 1) throw new ServiceError("VALIDATION", "Per-customer limit must be at least 1", "perCustomerLimit");
  if (input.usageLimit !== undefined && input.usageLimit < input.perCustomerLimit) throw new ServiceError("VALIDATION", "Total limit is below the per-customer limit", "usageLimit");
  if (!input.eligible.categories.length || !input.eligible.cities.length || !input.eligible.userGroups.length) {
    throw new ServiceError("VALIDATION", "Pick at least one user group, ride type and city", "eligible");
  }
  return code;
}

/** // API: POST /promotions */
export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const b = await backend();
  const code = validate(b, input);
  const rec = b.db.promotions.insert({ ...input, code, id: `PRM-${b.seq.promotion.take()}`, createdAt: nowIso(), createdBy: actor().id });
  audit(b, { action: "promotion.create", resourceType: "promotion", resourceId: rec.id, after: { code, value: rec.value, discountType: rec.discountType } });
  return clone(toPromotion(b, rec));
}

/** // API: PATCH /admin/promotions/:id */
export async function updatePromotion(id: string, input: PromotionInput): Promise<Promotion> {
  const b = await backend();
  const current = b.db.promotions.require(id);
  const code = validate(b, input, id);
  // A code that has been redeemed keeps its code and discount — only dates, limits and eligibility change.
  const used = b.db.ix.rides.byPromotion.get(id).length > 0;
  if (used && (code !== current.code || input.discountType !== current.discountType || input.value !== current.value)) {
    throw new ServiceError("CONFLICT", "Code and discount cannot change after the first redemption");
  }
  const next = b.db.promotions.update(id, { ...input, code });
  audit(b, { action: "promotion.update", resourceType: "promotion", resourceId: id, ...diff(current, next) });
  return clone(toPromotion(b, next));
}

/** // API: PATCH /admin/promotions/:id */
export async function setPromotionEnabled(id: string, enabled: boolean, reason: string): Promise<Promotion> {
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.promotions.require(id);
  if (current.enabled === enabled) throw new ServiceError("CONFLICT", `Promotion is already ${enabled ? "enabled" : "disabled"}`);
  const next = b.db.promotions.update(id, { enabled });
  audit(b, { action: enabled ? "promotion.enable" : "promotion.disable", resourceType: "promotion", resourceId: id, before: { enabled: !enabled }, after: { enabled }, reason: text });
  return clone(toPromotion(b, next));
}

/** Rides that used the code, newest first. // API: GET /admin/promotions/:id/redemptions (❌) */
export async function listRedemptions(id: string, params: { page: number; pageSize: number }): Promise<Page<Redemption>> {
  const { db } = await backend();
  db.promotions.require(id);
  const rows: Redemption[] = db.ix.rides.byPromotion
    .get(id)
    .map((rideId) => db.rides.get(rideId)!)
    .map((r) => ({
      rideId: r.id,
      customerId: r.customerId,
      customerName: db.customers.get(r.customerId)?.name ?? r.customerId,
      discountCents: r.fareBreakdown.discount,
      redeemedAt: r.completedAt ?? r.bookedAt,
    }))
    .sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt));
  return paginate(rows, params.page, params.pageSize);
}

/** // API: GET /admin/promotions/:id/performance (❌) */
export async function getPromotionPerformance(id: string): Promise<PromotionPerformance> {
  const { db } = await backend();
  db.promotions.require(id);
  const rides = db.ix.rides.byPromotion.get(id).map((r) => db.rides.get(r)!);
  const daily = new Map<string, { redemptions: number; discountCents: number }>();
  for (const r of rides) {
    const day = lisbonDay(r.completedAt ?? r.bookedAt);
    const d = daily.get(day) ?? { redemptions: 0, discountCents: 0 };
    d.redemptions++;
    d.discountCents += r.fareBreakdown.discount;
    daily.set(day, d);
  }
  return {
    promotionId: id,
    redemptions: rides.length,
    uniqueCustomers: new Set(rides.map((r) => r.customerId)).size,
    discountCents: rides.reduce((s, r) => s + r.fareBreakdown.discount, 0),
    grossCents: rides.reduce((s, r) => s + r.fareBreakdown.total, 0),
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
  };
}
