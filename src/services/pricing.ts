import type { Cents, Page } from "@/types/common";
import type { FarePreview, PricingListParams, PricingRule, PricingRuleInput, Zone } from "@/types/pricing";
import type { RideCategory } from "@/types/vehicle";
import { ServiceError } from "@/lib/service-error";
import { computeFare } from "@/mock/fare";
import { inSet, paginate, sortRows } from "@/mock/query";
import { actor, audit, authorize, backend, clone, diff, nowIso, requireReason, type Backend } from "./_shared";

/**
 * Pricing & fares — requirements §11. Rules are versioned: edits happen on a
 * DRAFT, publishing schedules it, and the previous ACTIVE version is archived
 * when the new one takes effect. Completed rides keep their charged fare.
 */

/** Promote SCHEDULED versions whose date has come (a backend cron would do this). */
function applyDueVersions(b: Backend) {
  const { db } = b;
  const nowStr = nowIso();
  for (const rule of db.pricingRules.all()) {
    if (rule.status !== "SCHEDULED" || rule.effectiveFrom > nowStr) continue;
    for (const old of db.pricingRules.all()) {
      if (old.status === "ACTIVE" && old.category === rule.category && old.zoneId === rule.zoneId) {
        db.pricingRules.update(old.id, { status: "ARCHIVED" });
      }
    }
    db.pricingRules.update(rule.id, { status: "ACTIVE" });
  }
}

/** The rule with the admin's name beside the id (the pricing screens show who changed it). */
const named = (b: Backend, rule: PricingRule): PricingRule => ({
  ...rule,
  changedByName: b.db.admins.get(rule.changedBy)?.name ?? rule.changedBy,
});

/**
 * Sort fields: version, effectiveFrom, changedAt.
 * // API: GET /admin/pricing (✅ current only; ❌ versions)
 */
export async function listPricingRules(params: PricingListParams): Promise<Page<PricingRule>> {
  authorize("pricing", "view");
  const b = await backend();
  applyDueVersions(b);
  const rows = b.db.pricingRules
    .all()
    .filter((r) => inSet(r.category, params.category) && inSet(r.status, params.status) && (!params.zoneId || r.zoneId === params.zoneId));
  const sorted = sortRows(
    rows,
    params.sort,
    { version: (r) => r.version, effectiveFrom: (r) => r.effectiveFrom, changedAt: (r) => r.changedAt },
    "effectiveFrom:desc",
  );
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((r) => named(b, r)) };
}

/** The fare in force now, one per category. // API: GET /admin/pricing */
export async function getActivePricing(): Promise<PricingRule[]> {
  authorize("pricing", "view");
  const b = await backend();
  applyDueVersions(b);
  return clone(b.db.pricingRules.all().filter((r) => r.status === "ACTIVE" && !r.zoneId).map((r) => named(b, r)));
}

/** // API: GET /admin/pricing/rules/:id (❌) */
export async function getPricingRule(id: string): Promise<PricingRule> {
  authorize("pricing", "view");
  const b = await backend();
  return clone(named(b, b.db.pricingRules.require(id)));
}

function validateRule(input: PricingRuleInput) {
  const money: (keyof PricingRuleInput)[] = ["baseFare", "minimumFare", "perKm", "perMinute", "bookingFee", "waitingPerMinute", "cancellationFee"];
  for (const key of money) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100_000) {
      throw new ServiceError("VALIDATION", `${String(key)} must be a whole number of cents between 0 and 100000`, String(key));
    }
  }
  if (input.minimumFare < input.baseFare) throw new ServiceError("VALIDATION", "Minimum fare cannot be lower than the base fare", "minimumFare");
  if (input.surge.enabled && (input.surge.maxMultiplier < 1 || input.surge.maxMultiplier > 3)) {
    throw new ServiceError("VALIDATION", "Surge cap must be between 1.0 and 3.0", "surge.maxMultiplier");
  }
  for (const band of input.timeBands) {
    if (!/^\d{2}:\d{2}$/.test(band.from) || !/^\d{2}:\d{2}$/.test(band.to) || !band.days.length) {
      throw new ServiceError("VALIDATION", "Time bands need days and HH:mm times", "timeBands");
    }
    if (band.multiplier < 1 || band.multiplier > 3) throw new ServiceError("VALIDATION", "Time band multiplier must be 1.0–3.0", "timeBands");
  }
}

/** New DRAFT version, based on what the admin typed. // API: POST /admin/pricing/rules (❌) */
export async function createPricingDraft(input: PricingRuleInput): Promise<PricingRule> {
  authorize("pricing", "modify_pricing");
  const b = await backend();
  validateRule(input);
  const latest = Math.max(0, ...b.db.pricingRules.all().filter((r) => r.category === input.category && r.zoneId === input.zoneId).map((r) => r.version));
  const rule = b.db.pricingRules.insert({
    ...input,
    id: `PRC-${b.seq.pricing.take()}`,
    version: latest + 1,
    status: "DRAFT",
    effectiveFrom: nowIso(),
    changedBy: actor().id,
    changedAt: nowIso(),
  });
  audit(b, { action: "pricing.create_draft", resourceType: "pricing", resourceId: rule.id, after: { category: rule.category, version: rule.version } });
  return clone(rule);
}

/** Only drafts can be edited — published versions are history. // API: PATCH /admin/pricing/rules/:id (❌) */
export async function updatePricingDraft(id: string, input: PricingRuleInput): Promise<PricingRule> {
  authorize("pricing", "modify_pricing");
  const b = await backend();
  const current = b.db.pricingRules.require(id);
  if (current.status !== "DRAFT") throw new ServiceError("CONFLICT", "Only drafts can be edited");
  validateRule(input);
  const next = b.db.pricingRules.update(id, { ...input, changedBy: actor().id, changedAt: nowIso() });
  audit(b, { action: "pricing.update_draft", resourceType: "pricing", resourceId: id, ...diff(current, next) });
  return clone(next);
}

/**
 * Publish a draft from a date. Today = active now (the previous version is
 * archived); later = SCHEDULED until then.
 * // API: PATCH /admin/pricing/:vehicleType (✅ immediate only) — versions ❌
 */
export async function publishPricingRule(id: string, effectiveFrom: string, reason: string): Promise<PricingRule> {
  authorize("pricing", "modify_pricing");
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.pricingRules.require(id);
  if (current.status !== "DRAFT") throw new ServiceError("CONFLICT", "Only drafts can be published");
  const startMs = Date.parse(effectiveFrom);
  if (Number.isNaN(startMs) || startMs < Date.now() - 5 * 60_000) throw new ServiceError("VALIDATION", "Start must be now or later", "effectiveFrom");
  const next = b.db.pricingRules.update(id, {
    status: "SCHEDULED",
    effectiveFrom: new Date(Math.max(startMs, Date.now() - 1000)).toISOString(),
    changedBy: actor().id,
    changedAt: nowIso(),
    changeReason: text,
  });
  applyDueVersions(b);
  const published = b.db.pricingRules.require(id);
  audit(b, { action: "pricing.publish", resourceType: "pricing", resourceId: id, before: { status: "DRAFT" }, after: { status: published.status, effectiveFrom: next.effectiveFrom }, reason: text });
  return clone(published);
}

/** Drop a draft or a scheduled version that has not started. // API: POST /admin/pricing/rules/:id/archive (❌) */
export async function archivePricingRule(id: string, reason: string): Promise<PricingRule> {
  authorize("pricing", "modify_pricing");
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.pricingRules.require(id);
  if (current.status !== "DRAFT" && current.status !== "SCHEDULED") throw new ServiceError("CONFLICT", "Only drafts and scheduled versions can be withdrawn");
  const next = b.db.pricingRules.update(id, { status: "ARCHIVED", changedBy: actor().id, changedAt: nowIso(), changeReason: text });
  audit(b, { action: "pricing.archive", resourceType: "pricing", resourceId: id, before: { status: current.status }, after: { status: "ARCHIVED" }, reason: text });
  return clone(next);
}

export type FarePreviewInput = {
  rule: PricingRuleInput;
  distanceKm: number;
  durationMin: number;
  waitingMin?: number;
  /** Lisbon booking time, for time bands. Defaults to now. */
  at?: string;
  surge?: number;
  zoneCents?: Cents;
};

/** Calculation breakdown before publishing (§11) — same formula as real rides. // API: POST /admin/pricing/preview (❌) */
export async function previewFare(input: FarePreviewInput): Promise<FarePreview> {
  authorize("pricing", "view");
  await backend();
  validateRule(input.rule);
  const rule: PricingRule = { ...input.rule, id: "preview", version: 0, status: "DRAFT", effectiveFrom: nowIso(), changedBy: "", changedAt: nowIso() };
  const fare = computeFare(rule, {
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    waitingMin: input.waitingMin ?? 0,
    atMs: input.at ? Date.parse(input.at) : Date.now(),
    surge: input.surge ?? 1,
    zoneCents: input.zoneCents ?? 0,
  });
  return {
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    waitingMin: input.waitingMin ?? 0,
    multiplier: fare.multiplier,
    netCents: fare.net,
    lines: [
      { key: "base", cents: fare.base },
      { key: "distance", cents: fare.distance },
      { key: "time", cents: fare.time },
      { key: "waiting", cents: fare.waiting },
      { key: "booking", cents: fare.booking },
      { key: "zone", cents: fare.zone },
      { key: "surge", cents: fare.surge },
      { key: "vat", cents: fare.vat },
    ],
    minimumApplied: fare.minimumApplied,
    totalCents: fare.total,
  };
}

/** // API: GET /admin/pricing/zones (❌) */
export async function listZones(): Promise<Zone[]> {
  authorize("pricing", "view");
  const { db } = await backend();
  return clone([...db.zones.all()]);
}

/** Edit a zone's name, type, surcharge, polygon or active flag. // API: PATCH /admin/pricing/zones/:id (❌) */
export async function updateZone(id: string, patch: Partial<Omit<Zone, "id">>, reason: string): Promise<Zone> {
  authorize("pricing", "modify_pricing");
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.zones.require(id);
  if (patch.surchargeCents !== undefined && (!Number.isInteger(patch.surchargeCents) || patch.surchargeCents < 0)) {
    throw new ServiceError("VALIDATION", "Surcharge must be a whole number of cents", "surchargeCents");
  }
  if (patch.polygon && patch.polygon.length < 4) throw new ServiceError("VALIDATION", "A zone needs at least 3 points", "polygon");
  const next = b.db.zones.update(id, patch);
  audit(b, { action: "zone.update", resourceType: "zone", resourceId: id, ...diff(current, next), reason: text });
  return clone(next);
}

/** Categories that have a fare — for selects. */
export const PRICING_CATEGORIES: readonly RideCategory[] = ["ECONOMY", "COMFORT", "PREMIUM"];
