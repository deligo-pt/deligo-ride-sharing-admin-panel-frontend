import type { AdminUser } from "@/types/admin";
import type { AuditLog } from "@/types/audit";
import type { ComplianceDocument } from "@/types/document";
import type { CommissionRule, Settlement } from "@/types/finance";
import type { Invoice } from "@/types/invoice";
import type { Notification } from "@/types/notification";
import type { Payment } from "@/types/payment";
import type { Payout } from "@/types/payout";
import type { PricingRule, Zone } from "@/types/pricing";
import type { Ride } from "@/types/ride";
import type { GdprRequest, PlatformSettings } from "@/types/settings";
import type { SafetyIncident, Ticket } from "@/types/support";
import type { CustomerRecord, DriverRecord, FleetRecord, PromotionRecord, VehicleRecord } from "./records";
import { resetClock } from "./clock";
import { generatePricingRules, generateZones, generateCommissionRules, generatePromotions } from "./generators/catalog";
import { generateCustomers } from "./generators/customers";
import { NEW_DOCUMENT_OFFSET } from "./generators/document-factory";
import { generateDrivers } from "./generators/drivers";
import { generateFinance } from "./generators/finance";
import { generateFleets } from "./generators/fleets";
import {
  defaultSettings,
  generateAdmins,
  generateAuditLogs,
  generateGdprRequests,
  generateNotifications,
} from "./generators/platform";
import { generateRides } from "./generators/rides";
import { generateSupport } from "./generators/support";
import { generateVehicles } from "./generators/vehicles";
import { COUNTS } from "./ids";
import { Index, Sequence, Table } from "./table";

/**
 * The in-memory database. Each table is generated the first time something
 * reads it (§D: "generate lazily per module"), and generators that produce
 * several tables at once (rides → payments + invoices) fill them together.
 * Only services import this — through `getDb()` (mock/load.ts), a dynamic
 * import, so faker and the generators stay out of the first-load bundle.
 *
 * `reset()` drops everything; the next read regenerates the same data
 * (fixed seed) with "now" moved to the current time.
 */

type Store = {
  customers?: Table<CustomerRecord>;
  drivers?: Table<DriverRecord>;
  fleets?: Table<FleetRecord>;
  vehicles?: Table<VehicleRecord>;
  documents?: Table<ComplianceDocument>;
  rides?: Table<Ride>;
  payments?: Table<Payment>;
  invoices?: Table<Invoice>;
  settlements?: Table<Settlement>;
  payouts?: Table<Payout>;
  pricingRules?: Table<PricingRule>;
  zones?: Table<Zone>;
  commissionRules?: Table<CommissionRule>;
  promotions?: Table<PromotionRecord>;
  tickets?: Table<Ticket>;
  incidents?: Table<SafetyIncident>;
  notifications?: Table<Notification>;
  admins?: Table<AdminUser>;
  audit?: Table<AuditLog>;
  gdpr?: Table<GdprRequest>;
  settings?: { value: PlatformSettings };
  indexes?: Indexes;
  docParts?: { drivers?: ComplianceDocument[]; vehicles?: ComplianceDocument[]; fleets?: ComplianceDocument[] };
};

/** Lookups a backend would get from foreign-key indexes, built per group on first use. */
type RideIndexes = {
  byCustomer: Index;
  byDriver: Index;
  byFleet: Index;
  byPromotion: Index;
  paymentsByCustomer: Index;
  invoicesByCustomer: Index;
  invoiceByRide: Map<string, string>;
};
type SupportIndexes = { ticketsByRide: Index; ticketsByCustomer: Index; ticketsByDriver: Index; incidentsByRide: Index };
type PeopleIndexes = { driversByFleet: Index; vehiclesByFleet: Index };
type FinanceIndexes = { settlementsByPayee: Index; payoutsByPayee: Index };

type Indexes = {
  rides?: RideIndexes;
  support?: SupportIndexes;
  documents?: Index;
  people?: PeopleIndexes;
  finance?: FinanceIndexes;
};

let store: Store = {};

/** IDs for records created during the demo (refunds, notes, new vehicles…). */
export const seq = {
  note: new Sequence(200000),
  refund: new Sequence(90000),
  vehicle: new Sequence(5000 + COUNTS.vehicles),
  pricing: new Sequence(100),
  zone: new Sequence(100),
  commission: new Sequence(100),
  adjustment: new Sequence(100),
  promotion: new Sequence(100 + COUNTS.promotions),
  notification: new Sequence(200 + COUNTS.notifications),
  admin: new Sequence(COUNTS.admins),
  audit: new Sequence(500000 + COUNTS.audit + 1),
  document: new Sequence(70000 + NEW_DOCUMENT_OFFSET),
  ticketEvent: new Sequence(1),
};

function buildDrivers() {
  const bundle = generateDrivers();
  store.docParts = { ...store.docParts, drivers: bundle.documents };
  return new Table(bundle.drivers, "driver");
}
function buildVehicles() {
  const bundle = generateVehicles();
  store.docParts = { ...store.docParts, vehicles: bundle.documents };
  return new Table(bundle.vehicles, "vehicle");
}
function buildFleets() {
  const bundle = generateFleets();
  store.docParts = { ...store.docParts, fleets: bundle.documents };
  return new Table(bundle.fleets, "fleet manager");
}

function buildRides() {
  const bundle = generateRides({
    customers: db.customers.all(),
    drivers: db.drivers.all(),
    vehicles: db.vehicles.all(),
    pricingRules: db.pricingRules.all(),
    promotions: db.promotions.all(),
  });
  store.payments = new Table(bundle.payments, "payment");
  store.invoices = new Table(bundle.invoices, "invoice");
  return new Table(bundle.rides, "ride");
}

function buildFinance() {
  const bundle = generateFinance({
    rides: db.rides.all(),
    payments: db.payments.all(),
    drivers: db.drivers.all(),
    fleets: db.fleets.all(),
    commissionRules: db.commissionRules.all(),
  });
  store.payouts = new Table(bundle.payouts, "payout");
  return new Table(bundle.settlements, "settlement");
}

function buildSupport() {
  const bundle = generateSupport({ rides: db.rides.all(), customers: db.customers.all() });
  store.incidents = new Table(bundle.incidents, "incident");
  return new Table(bundle.tickets, "ticket");
}

function buildDocuments() {
  // Touch the owners first so their document parts exist.
  void db.drivers;
  void db.vehicles;
  void db.fleets;
  const parts = store.docParts ?? {};
  const all = [...(parts.drivers ?? []), ...(parts.vehicles ?? []), ...(parts.fleets ?? [])].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
  store.docParts = undefined;
  return new Table(all, "document");
}

function rideIndexes(): RideIndexes {
  const ix: RideIndexes = {
    byCustomer: new Index(),
    byDriver: new Index(),
    byFleet: new Index(),
    byPromotion: new Index(),
    paymentsByCustomer: new Index(),
    invoicesByCustomer: new Index(),
    invoiceByRide: new Map(),
  };
  for (const r of db.rides.all()) {
    ix.byCustomer.add(r.customerId, r.id);
    ix.byDriver.add(r.driverId, r.id);
    ix.byFleet.add(r.fleetManagerId, r.id);
    ix.byPromotion.add(r.promotionId, r.id);
  }
  for (const p of db.payments.all()) ix.paymentsByCustomer.add(p.customerId, p.id);
  for (const inv of db.invoices.all()) {
    ix.invoicesByCustomer.add(inv.customerId, inv.id);
    ix.invoiceByRide.set(inv.rideId, inv.id);
  }
  return ix;
}

function supportIndexes(): SupportIndexes {
  const ix: SupportIndexes = { ticketsByRide: new Index(), ticketsByCustomer: new Index(), ticketsByDriver: new Index(), incidentsByRide: new Index() };
  for (const t of db.tickets.all()) {
    ix.ticketsByRide.add(t.rideId, t.id);
    ix.ticketsByCustomer.add(t.customerId, t.id);
    ix.ticketsByDriver.add(t.driverId, t.id);
  }
  for (const inc of db.incidents.all()) ix.incidentsByRide.add(inc.rideId, inc.id);
  return ix;
}

function documentIndex(): Index {
  const ix = new Index();
  for (const d of db.documents.all()) ix.add(d.ownerId, d.id);
  return ix;
}

function peopleIndexes(): PeopleIndexes {
  const ix: PeopleIndexes = { driversByFleet: new Index(), vehiclesByFleet: new Index() };
  for (const d of db.drivers.all()) ix.driversByFleet.add(d.fleetManagerId, d.id);
  for (const v of db.vehicles.all()) ix.vehiclesByFleet.add(v.fleetManagerId, v.id);
  return ix;
}

function financeIndexes(): FinanceIndexes {
  const ix: FinanceIndexes = { settlementsByPayee: new Index(), payoutsByPayee: new Index() };
  for (const s of db.settlements.all()) ix.settlementsByPayee.add(s.payeeId, s.id);
  for (const p of db.payouts.all()) ix.payoutsByPayee.add(p.payeeId, p.id);
  return ix;
}

/** Each group only generates the tables it indexes. */
const ix = {
  get rides() {
    const all = (store.indexes ??= {});
    return (all.rides ??= rideIndexes());
  },
  get support() {
    const all = (store.indexes ??= {});
    return (all.support ??= supportIndexes());
  },
  get documents() {
    const all = (store.indexes ??= {});
    return (all.documents ??= documentIndex());
  },
  get people() {
    const all = (store.indexes ??= {});
    return (all.people ??= peopleIndexes());
  },
  get finance() {
    const all = (store.indexes ??= {});
    return (all.finance ??= financeIndexes());
  },
};

export const db = {
  get customers() {
    return (store.customers ??= new Table(generateCustomers(), "customer"));
  },
  get drivers() {
    return (store.drivers ??= buildDrivers());
  },
  get fleets() {
    return (store.fleets ??= buildFleets());
  },
  get vehicles() {
    return (store.vehicles ??= buildVehicles());
  },
  get documents() {
    return (store.documents ??= buildDocuments());
  },
  get rides() {
    return (store.rides ??= buildRides());
  },
  get payments() {
    if (!store.payments) store.rides ??= buildRides();
    return store.payments!;
  },
  get invoices() {
    if (!store.invoices) store.rides ??= buildRides();
    return store.invoices!;
  },
  get settlements() {
    return (store.settlements ??= buildFinance());
  },
  get payouts() {
    if (!store.payouts) store.settlements ??= buildFinance();
    return store.payouts!;
  },
  get pricingRules() {
    return (store.pricingRules ??= new Table(generatePricingRules(), "pricing rule"));
  },
  get zones() {
    return (store.zones ??= new Table(generateZones(), "zone"));
  },
  get commissionRules() {
    return (store.commissionRules ??= new Table(generateCommissionRules(), "commission rule"));
  },
  get promotions() {
    return (store.promotions ??= new Table(generatePromotions(), "promotion"));
  },
  get tickets() {
    return (store.tickets ??= buildSupport());
  },
  get incidents() {
    if (!store.incidents) store.tickets ??= buildSupport();
    return store.incidents!;
  },
  get notifications() {
    return (store.notifications ??= new Table(generateNotifications(), "notification"));
  },
  get admins() {
    return (store.admins ??= new Table(generateAdmins(), "admin"));
  },
  get audit() {
    return (store.audit ??= new Table(generateAuditLogs(), "audit entry"));
  },
  get gdpr() {
    return (store.gdpr ??= new Table(generateGdprRequests(db.customers.all()), "GDPR request"));
  },
  get settings() {
    return (store.settings ??= { value: defaultSettings() });
  },
  /** Foreign-key lookups (`db.ix.rides.byCustomer.get(id)`). */
  ix,
};

export type Db = typeof db;

/** "Reset demo data" (Settings → Demo): everything regenerates on next read. */
export function reset() {
  store = {};
  resetClock();
}
