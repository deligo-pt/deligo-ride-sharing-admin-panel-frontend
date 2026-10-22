import type { City, GeoPoint } from "@/types/common";
import type { CommissionRule } from "@/types/finance";
import type { PricingRule, TimeBand, Zone } from "@/types/pricing";
import type { PromotionUserGroup } from "@/types/promotion";
import type { RideCategory } from "@/types/vehicle";
import type { PromotionRecord } from "../records";
import { DAY, HOUR, iso, today } from "../clock";
import { commissionRuleId, pricingId, promotionId, zoneId } from "../ids";
import { CITY_CENTRE } from "../places";
import { int, withSeed } from "../seed";

const CATEGORIES: RideCategory[] = ["ECONOMY", "COMFORT", "PREMIUM"];

/** Fri–Sat nights and weekday morning peak. */
const TIME_BANDS: TimeBand[] = [
  { days: [5, 6], from: "22:00", to: "04:00", multiplier: 1.2 },
  { days: [1, 2, 3, 4, 5], from: "07:30", to: "09:30", multiplier: 1.1 },
];

type Tariff = Pick<
  PricingRule,
  "baseFare" | "minimumFare" | "perKm" | "perMinute" | "bookingFee" | "waitingPerMinute" | "cancellationFee"
>;

/** Current tariffs (cents) — in line with Lisbon TVDE prices in 2026. */
const TARIFF: Record<RideCategory, Tariff> = {
  ECONOMY: { baseFare: 120, minimumFare: 400, perKm: 70, perMinute: 15, bookingFee: 50, waitingPerMinute: 20, cancellationFee: 300 },
  COMFORT: { baseFare: 160, minimumFare: 550, perKm: 90, perMinute: 20, bookingFee: 60, waitingPerMinute: 25, cancellationFee: 400 },
  PREMIUM: { baseFare: 300, minimumFare: 900, perKm: 140, perMinute: 30, bookingFee: 80, waitingPerMinute: 35, cancellationFee: 600 },
};

const scale = (t: Tariff, factor: number): Tariff =>
  Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round((v * factor) / 5) * 5])) as Tariff;

/**
 * Fare versions per category: v1 archived, v2 active for 45 days, plus a
 * scheduled ECONOMY v3 and a PREMIUM draft — so every status shows.
 */
export function generatePricingRules(): PricingRule[] {
  const nowMs = today(); // day-aligned: rides compare their time with these dates
  const rules: PricingRule[] = [];
  let n = 0;
  const add = (rule: Omit<PricingRule, "id">) => rules.push({ id: pricingId(n++), ...rule });

  for (const category of CATEGORIES) {
    add({
      version: 1,
      category,
      ...scale(TARIFF[category], 0.92),
      timeBands: TIME_BANDS.slice(0, 1),
      surge: { enabled: true, maxMultiplier: 1.8 },
      vatRate: 0.06,
      effectiveFrom: iso(nowMs - 400 * DAY),
      status: "ARCHIVED",
      changedBy: "ADM-002",
      changedAt: iso(nowMs - 405 * DAY),
      changeReason: "Tarifário inicial de lançamento.",
    });
    add({
      version: 2,
      category,
      ...TARIFF[category],
      timeBands: TIME_BANDS,
      surge: { enabled: true, maxMultiplier: category === "PREMIUM" ? 1.5 : 2 },
      vatRate: 0.06,
      effectiveFrom: iso(nowMs - 45 * DAY),
      status: "ACTIVE",
      changedBy: "ADM-001",
      changedAt: iso(nowMs - 52 * DAY),
      changeReason: "Atualização anual: aumento do custo dos combustíveis e da energia.",
    });
  }
  add({
    version: 3,
    category: "ECONOMY",
    ...TARIFF.ECONOMY,
    perKm: 72,
    bookingFee: 55,
    timeBands: TIME_BANDS,
    surge: { enabled: true, maxMultiplier: 2 },
    vatRate: 0.06,
    effectiveFrom: iso(nowMs + 10 * DAY),
    status: "SCHEDULED",
    changedBy: "ADM-001",
    changedAt: iso(nowMs - 1 * DAY),
    changeReason: "Ajuste ao preço por km acordado com as frotas parceiras.",
  });
  add({
    version: 3,
    category: "PREMIUM",
    ...TARIFF.PREMIUM,
    minimumFare: 1000,
    timeBands: TIME_BANDS,
    surge: { enabled: false, maxMultiplier: 1 },
    vatRate: 0.06,
    effectiveFrom: iso(nowMs + 30 * DAY),
    status: "DRAFT",
    changedBy: "ADM-003",
    changedAt: iso(nowMs - 3 * HOUR),
  });
  return rules;
}

function box(centre: GeoPoint, dLat: number, dLng: number): GeoPoint[] {
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  const ring = [
    { lat: r(centre.lat - dLat), lng: r(centre.lng - dLng) },
    { lat: r(centre.lat - dLat), lng: r(centre.lng + dLng) },
    { lat: r(centre.lat + dLat), lng: r(centre.lng + dLng) },
    { lat: r(centre.lat + dLat), lng: r(centre.lng - dLng) },
  ];
  return [...ring, ring[0]!];
}

/** Airport pickup/drop-off surcharge per city (cents) — the SURCHARGE zones below. */
export const AIRPORT_SURCHARGE: Record<City, number> = { LISBOA: 200, PORTO: 150, FARO: 150 };

/** Airport surcharge zones, a restricted-traffic zone and the standard city zones. */
export function generateZones(): Zone[] {
  const zones: Omit<Zone, "id">[] = [
    { name: { pt: "Aeroporto de Lisboa", en: "Lisbon Airport" }, type: "SURCHARGE", polygon: box({ lat: 38.7742, lng: -9.1342 }, 0.006, 0.008), surchargeCents: AIRPORT_SURCHARGE.LISBOA, active: true },
    { name: { pt: "Aeroporto do Porto", en: "Porto Airport" }, type: "SURCHARGE", polygon: box({ lat: 41.2481, lng: -8.6814 }, 0.006, 0.008), surchargeCents: AIRPORT_SURCHARGE.PORTO, active: true },
    { name: { pt: "Aeroporto de Faro", en: "Faro Airport" }, type: "SURCHARGE", polygon: box({ lat: 37.0144, lng: -7.9659 }, 0.005, 0.007), surchargeCents: AIRPORT_SURCHARGE.FARO, active: true },
    { name: { pt: "Baixa Pombalina (ZAAC)", en: "Baixa Pombalina (restricted access)" }, type: "RESTRICTED", polygon: box({ lat: 38.711, lng: -9.1375 }, 0.003, 0.003), active: true },
    { name: { pt: "Lisboa — centro", en: "Lisbon — centre" }, type: "STANDARD", polygon: box(CITY_CENTRE.LISBOA, 0.05, 0.07), active: true },
    { name: { pt: "Porto — centro", en: "Porto — centre" }, type: "STANDARD", polygon: box(CITY_CENTRE.PORTO, 0.04, 0.06), active: true },
    { name: { pt: "Faro — centro", en: "Faro — centre" }, type: "STANDARD", polygon: box(CITY_CENTRE.FARO, 0.03, 0.04), active: true },
    { name: { pt: "Ribeira do Porto", en: "Porto Ribeira" }, type: "RESTRICTED", polygon: box({ lat: 41.1407, lng: -8.6131 }, 0.0015, 0.003), active: false },
  ];
  return zones.map((z, i) => ({ id: zoneId(i), ...z }));
}

/** ECONOMY commission dropped from 22% to 20% two months ago; the others are unchanged. */
export function generateCommissionRules(): CommissionRule[] {
  const nowMs = today(); // day-aligned: rides compare their time with these dates
  const base = { createdBy: "ADM-001" };
  return [
    { id: commissionRuleId(0), category: "ECONOMY", rate: 0.22, effectiveFrom: iso(nowMs - 400 * DAY), effectiveTo: iso(nowMs - 60 * DAY), createdAt: iso(nowMs - 405 * DAY), ...base },
    { id: commissionRuleId(1), category: "COMFORT", rate: 0.22, effectiveFrom: iso(nowMs - 400 * DAY), createdAt: iso(nowMs - 405 * DAY), ...base },
    { id: commissionRuleId(2), category: "PREMIUM", rate: 0.25, effectiveFrom: iso(nowMs - 400 * DAY), createdAt: iso(nowMs - 405 * DAY), ...base },
    { id: commissionRuleId(3), category: "ECONOMY", rate: 0.2, effectiveFrom: iso(nowMs - 60 * DAY), createdAt: iso(nowMs - 62 * DAY), ...base },
  ];
}

type PromoSeed = {
  code: string;
  pt: string;
  en: string;
  type: "FLAT" | "PERCENTAGE";
  value: number;
  max?: number;
  min?: number;
  /** Days relative to now. */
  start: number;
  end: number;
  limit?: number;
  perCustomer?: number;
  groups?: PromotionUserGroup[];
  categories?: RideCategory[];
  cities?: City[];
  enabled?: boolean;
};

/** 30 campaigns: past, live, scheduled and switched off. PRM-100 is the live demo one. */
const PROMOS: PromoSeed[] = [
  { code: "OUTONO15", pt: "Outono: 15% em todas as viagens", en: "Autumn: 15% off every ride", type: "PERCENTAGE", value: 0.15, max: 500, start: -25, end: 20, limit: 5000, perCustomer: 3 },
  { code: "BEMVINDO5", pt: "Boas-vindas: 5 € na 1.ª viagem", en: "Welcome: €5 off your first ride", type: "FLAT", value: 500, min: 800, start: -200, end: 165, perCustomer: 1, groups: ["NEW_CUSTOMERS"] },
  { code: "AEROPORTO3", pt: "3 € em viagens para o aeroporto", en: "€3 off airport rides", type: "FLAT", value: 300, min: 1500, start: -60, end: 30, limit: 3000, perCustomer: 4 },
  { code: "PORTO20", pt: "Porto: 20% ao fim de semana", en: "Porto: 20% off at weekends", type: "PERCENTAGE", value: 0.2, max: 400, start: -40, end: 5, limit: 1500, perCustomer: 2, cities: ["PORTO"] },
  { code: "CONFORTO10", pt: "10% no Conforto", en: "10% off Comfort", type: "PERCENTAGE", value: 0.1, max: 300, start: -15, end: 45, limit: 2000, perCustomer: 5, categories: ["COMFORT"] },
  { code: "VOLTA25", pt: "Voltamos a ver-te: 25%", en: "We miss you: 25% off", type: "PERCENTAGE", value: 0.25, max: 600, start: -10, end: 20, limit: 800, perCustomer: 1, groups: ["INACTIVE_30D"] },
  { code: "FARO4", pt: "Algarve: 4 € de desconto", en: "Algarve: €4 off", type: "FLAT", value: 400, min: 1200, start: -70, end: -5, limit: 600, perCustomer: 2, cities: ["FARO"] },
  { code: "VERAO2026", pt: "Verão 2026: 10%", en: "Summer 2026: 10% off", type: "PERCENTAGE", value: 0.1, max: 400, start: -110, end: -30, limit: 6000, perCustomer: 4 },
  { code: "SANTOANTONIO", pt: "Santos Populares: 5 €", en: "Popular Saints: €5 off", type: "FLAT", value: 500, min: 1000, start: -130, end: -120, limit: 1000, perCustomer: 1, cities: ["LISBOA"] },
  { code: "SAOJOAO", pt: "São João: 5 €", en: "São João: €5 off", type: "FLAT", value: 500, min: 1000, start: -120, end: -115, limit: 800, perCustomer: 1, cities: ["PORTO"] },
  { code: "PREMIUM15", pt: "15% no Premium", en: "15% off Premium", type: "PERCENTAGE", value: 0.15, max: 800, start: -50, end: -10, limit: 700, perCustomer: 2, categories: ["PREMIUM"] },
  { code: "FIEL10", pt: "Clientes frequentes: 10%", en: "Frequent riders: 10% off", type: "PERCENTAGE", value: 0.1, max: 300, start: -80, end: 40, perCustomer: 10, groups: ["FREQUENT"] },
  { code: "ESTUDANTE", pt: "Estudantes: 2 €", en: "Students: €2 off", type: "FLAT", value: 200, min: 600, start: -35, end: 60, limit: 4000, perCustomer: 6 },
  { code: "NOITE20", pt: "Noites de sexta: 20%", en: "Friday nights: 20% off", type: "PERCENTAGE", value: 0.2, max: 500, start: -20, end: 10, limit: 1200, perCustomer: 2, enabled: false },
  { code: "WEBSUMMIT", pt: "Web Summit: 15%", en: "Web Summit: 15% off", type: "PERCENTAGE", value: 0.15, max: 600, start: 14, end: 18, limit: 3000, perCustomer: 4, cities: ["LISBOA"] },
  { code: "NATAL5", pt: "Natal: 5 € de desconto", en: "Christmas: €5 off", type: "FLAT", value: 500, min: 1200, start: 55, end: 75, limit: 5000, perCustomer: 2 },
  { code: "ANONOVO", pt: "Passagem de ano: 20%", en: "New Year's Eve: 20% off", type: "PERCENTAGE", value: 0.2, max: 800, start: 72, end: 74, limit: 2000, perCustomer: 1 },
  { code: "DOURO10", pt: "Douro: 10%", en: "Douro: 10% off", type: "PERCENTAGE", value: 0.1, max: 300, start: 5, end: 35, limit: 1000, perCustomer: 3, cities: ["PORTO"] },
  { code: "TEJO3", pt: "Tejo: 3 €", en: "Tejo: €3 off", type: "FLAT", value: 300, min: 900, start: -90, end: -60, limit: 1500, perCustomer: 2, cities: ["LISBOA"] },
  { code: "MBWAY2", pt: "Paga com MB WAY: 2 €", en: "Pay with MB WAY: €2 off", type: "FLAT", value: 200, min: 700, start: -45, end: -15, limit: 2500, perCustomer: 3 },
  { code: "ELETRICO", pt: "Viagens elétricas: 8%", en: "Electric rides: 8% off", type: "PERCENTAGE", value: 0.08, max: 250, start: -30, end: 30, limit: 3000, perCustomer: 5, enabled: false },
  { code: "AMIGO5", pt: "Convida um amigo: 5 €", en: "Refer a friend: €5 off", type: "FLAT", value: 500, min: 800, start: -300, end: 60, perCustomer: 1, groups: ["NEW_CUSTOMERS"] },
  { code: "BLACKFRIDAY", pt: "Black Friday: 30%", en: "Black Friday: 30% off", type: "PERCENTAGE", value: 0.3, max: 700, start: 38, end: 41, limit: 4000, perCustomer: 2 },
  { code: "PRIMAVERA", pt: "Primavera: 10%", en: "Spring: 10% off", type: "PERCENTAGE", value: 0.1, max: 300, start: -210, end: -150, limit: 4000, perCustomer: 3 },
  { code: "CARNAVAL", pt: "Carnaval: 4 €", en: "Carnival: €4 off", type: "FLAT", value: 400, min: 1000, start: -245, end: -240, limit: 900, perCustomer: 1 },
  { code: "BENFICA", pt: "Dia de jogo na Luz: 3 €", en: "Match day at Luz: €3 off", type: "FLAT", value: 300, min: 800, start: -12, end: 2, limit: 400, perCustomer: 1, cities: ["LISBOA"] },
  { code: "DRAGAO", pt: "Dia de jogo no Dragão: 3 €", en: "Match day at Dragão: €3 off", type: "FLAT", value: 300, min: 800, start: -12, end: 2, limit: 300, perCustomer: 1, cities: ["PORTO"] },
  { code: "MADRUGADA", pt: "Madrugada segura: 15%", en: "Safe late nights: 15% off", type: "PERCENTAGE", value: 0.15, max: 400, start: -60, end: 25, limit: 2500, perCustomer: 4 },
  { code: "TESTE100", pt: "Teste interno (não usar)", en: "Internal test (do not use)", type: "PERCENTAGE", value: 1, max: 2000, start: -5, end: 25, limit: 5, perCustomer: 1, enabled: false },
  { code: "INVERNO12", pt: "Inverno: 12%", en: "Winter: 12% off", type: "PERCENTAGE", value: 0.12, max: 400, start: 45, end: 120, limit: 5000, perCustomer: 4 },
];

export function generatePromotions(): PromotionRecord[] {
  return withSeed("promotions", () => {
    const nowMs = today(); // day-aligned: rides compare their time with these dates
    return PROMOS.map((p, i) => ({
      id: promotionId(i),
      code: p.code,
      name: { pt: p.pt, en: p.en },
      discountType: p.type,
      value: p.value,
      maxDiscountCents: p.max,
      minBookingCents: p.min,
      startsAt: iso(nowMs + p.start * DAY),
      endsAt: iso(nowMs + (p.end + 1) * DAY - 60_000),
      usageLimit: p.limit,
      perCustomerLimit: p.perCustomer ?? 1,
      eligible: {
        userGroups: p.groups ?? ["ALL"],
        categories: p.categories ?? ["ECONOMY", "COMFORT", "PREMIUM"],
        cities: p.cities ?? ["LISBOA", "PORTO", "FARO"],
      },
      enabled: p.enabled ?? true,
      createdAt: iso(nowMs + (p.start - int(3, 15)) * DAY),
      createdBy: i % 3 === 0 ? "ADM-001" : "ADM-003",
    }));
  });
}
