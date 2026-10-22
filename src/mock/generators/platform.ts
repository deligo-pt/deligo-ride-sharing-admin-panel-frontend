import type { AdminUser } from "@/types/admin";
import type { AuditLog, AuditResourceType } from "@/types/audit";
import type { Notification, NotificationAudience, NotificationChannel, NotificationStatus } from "@/types/notification";
import type { GdprRequest, GdprRequestStatus, GdprRequestType, PlatformSettings } from "@/types/settings";
import type { CustomerRecord } from "../records";
import { DAY, HOUR, iso, now } from "../clock";
import { ADMIN_SEEDS, adminName } from "../fixtures/admins";
import {
  COUNTS,
  auditId,
  customerId,
  documentId,
  driverId,
  fleetId,
  gdprId,
  notificationId,
  paymentId,
  promotionId,
  rideId,
  ticketId,
  vehicleId,
} from "../ids";
import { chance, hex, int, pick, slug, weighted, withSeed } from "../seed";

/** The 15 staff accounts (fixtures/admins.ts) with login data. */
export function generateAdmins(): AdminUser[] {
  return withSeed("admins", () => {
    const nowMs = now();
    return ADMIN_SEEDS.map((a, i) => ({
      id: a.id,
      name: a.name,
      email: `${slug(a.name).replace(/-/g, ".")}@deligo.pt`,
      roleId: a.roleId,
      status: a.status,
      mfaEnabled: a.mfaEnabled,
      invitedAt: iso(nowMs - (a.status === "INVITED" ? 2 : 400 - i * 20) * DAY),
      lastLoginAt:
        a.status === "INVITED" ? undefined : iso(nowMs - (a.status === "DISABLED" ? 60 * DAY : int(5, 60 * 24) * 60_000)),
    }));
  });
}

type NotifTemplate = { title: { pt: string; en: string }; body: { pt: string; en: string }; audience: NotificationAudience };

const NOTIFICATIONS: NotifTemplate[] = [
  { audience: "CUSTOMERS", title: { pt: "15% em todas as viagens", en: "15% off every ride" }, body: { pt: "Usa o código OUTONO15 até ao fim do mês.", en: "Use code OUTONO15 until the end of the month." } },
  { audience: "CUSTOMERS", title: { pt: "Novo: pagamento com MB WAY", en: "New: pay with MB WAY" }, body: { pt: "Já podes pagar as tuas viagens com MB WAY.", en: "You can now pay for your rides with MB WAY." } },
  { audience: "DRIVERS", title: { pt: "Documentos a expirar", en: "Documents expiring" }, body: { pt: "Tens documentos que expiram em breve. Atualiza-os na app para continuares a conduzir.", en: "Some of your documents expire soon. Update them in the app to keep driving." } },
  { audience: "DRIVERS", title: { pt: "Pagamentos semanais", en: "Weekly payouts" }, body: { pt: "A transferência desta semana foi enviada. Pode demorar até 2 dias úteis.", en: "This week's transfer has been sent. It can take up to 2 business days." } },
  { audience: "DRIVERS", title: { pt: "Grande procura no aeroporto", en: "High demand at the airport" }, body: { pt: "Muitos voos a chegar ao Humberto Delgado entre as 18h e as 21h.", en: "Many flights landing at Humberto Delgado between 6 and 9 pm." } },
  { audience: "FLEET_MANAGERS", title: { pt: "Novo extrato disponível", en: "New statement available" }, body: { pt: "O extrato semanal da tua frota já está disponível no portal.", en: "Your fleet's weekly statement is now available in the portal." } },
  { audience: "FLEET_MANAGERS", title: { pt: "Atualização de tarifário", en: "Fare update" }, body: { pt: "O preço por km da categoria Económica muda daqui a 10 dias.", en: "The Economy per-km price changes in 10 days." } },
  { audience: "SEGMENT", title: { pt: "Voltamos a ver-te?", en: "Shall we see you again?" }, body: { pt: "25% na próxima viagem com o código VOLTA25.", en: "25% off your next ride with code VOLTA25." } },
  { audience: "CUSTOMERS", title: { pt: "Web Summit em Lisboa", en: "Web Summit in Lisbon" }, body: { pt: "Reserva com antecedência: espera-se grande procura no Parque das Nações.", en: "Book ahead: high demand expected around Parque das Nações." } },
  { audience: "CUSTOMERS", title: { pt: "Manutenção programada", en: "Scheduled maintenance" }, body: { pt: "A app estará indisponível domingo entre as 04h e as 05h.", en: "The app will be unavailable on Sunday between 4 and 5 am." } },
];

/** 60 announcements: mostly sent, a few failed, scheduled and drafts. */
export function generateNotifications(): Notification[] {
  return withSeed("notifications", () => {
    const nowMs = now();
    const rows: Notification[] = [];
    for (let i = 0; i < COUNTS.notifications; i++) {
      const t = NOTIFICATIONS[i % NOTIFICATIONS.length]!;
      // Newest last: the final 7 are drafts and scheduled.
      const status: NotificationStatus =
        i >= COUNTS.notifications - 4 ? "DRAFT" : i >= COUNTS.notifications - 7 ? "SCHEDULED" : chance(0.05) ? "FAILED" : i % 17 === 5 ? "CANCELLED" : "SENT";
      const createdMs = status === "DRAFT" || status === "SCHEDULED" ? nowMs - int(1, 72) * HOUR : nowMs - (90 - i * 1.5) * DAY;
      const recipients =
        t.audience === "CUSTOMERS" ? int(2100, 2400) : t.audience === "DRIVERS" ? int(450, 520) : t.audience === "FLEET_MANAGERS" ? 36 : int(150, 600);
      const channels: NotificationChannel[] =
        t.audience === "FLEET_MANAGERS" ? ["EMAIL"] : weighted([[["PUSH"], 50], [["PUSH", "EMAIL"], 35], [["SMS"], 8], [["PUSH", "SMS"], 7]] as const).slice();
      const sent = status === "SENT" ? recipients * channels.length : status === "FAILED" ? Math.round(recipients * 0.3) : 0;
      const failed = status === "FAILED" ? sent : Math.round(sent * (0.01 + (int(0, 30) / 1000)));
      rows.push({
        id: notificationId(i),
        title: t.title,
        body: t.body,
        audience: t.audience,
        segment: t.audience === "SEGMENT" ? pick(["CUSTOMERS_INACTIVE_30D", "CUSTOMERS_LISBOA", "CUSTOMERS_PORTO"] as const) : undefined,
        channels,
        scheduledFor: status === "SCHEDULED" ? iso(nowMs + int(4, 120) * HOUR) : undefined,
        sentAt: status === "SENT" || status === "FAILED" ? iso(createdMs + int(5, 120) * 60_000) : undefined,
        status,
        recipients,
        delivery: {
          sent,
          delivered: status === "FAILED" ? 0 : sent - failed,
          failed,
          opened: status === "SENT" ? Math.round((sent - failed) * (int(18, 45) / 100)) : 0,
        },
        createdAt: iso(createdMs),
        createdBy: pick(["ADM-001", "ADM-003", "ADM-004"]),
      });
    }
    return rows;
  });
}

type AuditTemplate = {
  action: string;
  resourceType: AuditResourceType;
  weight: number;
  id: () => string;
  admins: readonly string[];
  reason?: () => string;
  change?: () => { before?: Record<string, unknown>; after?: Record<string, unknown> };
};

const anyCustomer = () => customerId(int(0, COUNTS.customers - 1));
const anyDriver = () => driverId(int(0, COUNTS.drivers - 1));

const AUDIT_TEMPLATES: AuditTemplate[] = [
  { action: "auth.login", resourceType: "auth", weight: 30, id: () => "session", admins: ADMIN_SEEDS.filter((a) => a.status === "ACTIVE").map((a) => a.id) },
  { action: "auth.login_failed", resourceType: "auth", weight: 2, id: () => "session", admins: ["ADM-004", "ADM-006", "ADM-014"] },
  { action: "auth.logout", resourceType: "auth", weight: 8, id: () => "session", admins: ["ADM-001", "ADM-003", "ADM-005", "ADM-011"] },
  { action: "document.approve", resourceType: "document", weight: 15, id: () => documentId(int(0, 4199)), admins: ["ADM-009", "ADM-010"], change: () => ({ before: { status: "PENDING" }, after: { status: "APPROVED" } }) },
  { action: "document.reject", resourceType: "document", weight: 3, id: () => documentId(int(0, 4199)), admins: ["ADM-009", "ADM-010"], reason: () => "Imagem ilegível — pedir novo envio.", change: () => ({ before: { status: "PENDING" }, after: { status: "REJECTED" } }) },
  { action: "driver.approve", resourceType: "driver", weight: 5, id: anyDriver, admins: ["ADM-009", "ADM-010"], change: () => ({ before: { verification: "UNDER_REVIEW" }, after: { verification: "APPROVED" } }) },
  { action: "driver.suspend", resourceType: "driver", weight: 1, id: anyDriver, admins: ["ADM-003", "ADM-004"], reason: () => "Várias queixas de condução perigosa em investigação.", change: () => ({ before: { accountStatus: "ACTIVE" }, after: { accountStatus: "SUSPENDED" } }) },
  { action: "vehicle.approve", resourceType: "vehicle", weight: 4, id: () => vehicleId(int(0, COUNTS.vehicles - 1)), admins: ["ADM-009", "ADM-010"], change: () => ({ before: { approval: "PENDING_REVIEW" }, after: { approval: "APPROVED" } }) },
  { action: "ticket.assign", resourceType: "ticket", weight: 8, id: () => ticketId(int(0, COUNTS.tickets - 1)), admins: ["ADM-003", "ADM-005"], change: () => ({ after: { assigneeId: pick(["ADM-005", "ADM-006", "ADM-007"]) } }) },
  { action: "ticket.update_status", resourceType: "ticket", weight: 12, id: () => ticketId(int(0, COUNTS.tickets - 1)), admins: ["ADM-005", "ADM-006", "ADM-007"], change: () => ({ before: { status: "OPEN" }, after: { status: "IN_PROGRESS" } }) },
  { action: "payment.refund", resourceType: "payment", weight: 2, id: () => paymentId(int(0, 17000)), admins: ["ADM-011", "ADM-012"], reason: () => "Cobrança duplicada no cartão.", change: () => ({ before: { refundedCents: 0 }, after: { refundedCents: int(300, 2500) } }) },
  { action: "customer.suspend", resourceType: "customer", weight: 1, id: anyCustomer, admins: ["ADM-003", "ADM-005"], reason: () => "Faltas de comparência repetidas.", change: () => ({ before: { status: "ACTIVE" }, after: { status: "SUSPENDED" } }) },
  { action: "customer.add_note", resourceType: "customer", weight: 3, id: anyCustomer, admins: ["ADM-005", "ADM-006", "ADM-007"] },
  { action: "ride.cancel", resourceType: "ride", weight: 1, id: () => rideId(int(0, COUNTS.rides - 1)), admins: ["ADM-003", "ADM-004"], reason: () => "Cliente pediu cancelamento por telefone após avaria do veículo.", change: () => ({ before: { status: "DRIVER_ARRIVING" }, after: { status: "CANCELLED" } }) },
  { action: "promotion.update", resourceType: "promotion", weight: 1, id: () => promotionId(int(0, COUNTS.promotions - 1)), admins: ["ADM-001", "ADM-003"], change: () => ({ before: { enabled: true }, after: { enabled: false } }) },
  { action: "fleet.approve", resourceType: "fleet", weight: 0.5, id: () => fleetId(int(0, 35)), admins: ["ADM-009"], change: () => ({ before: { verification: "PENDING" }, after: { verification: "APPROVED" } }) },
  { action: "settings.update", resourceType: "settings", weight: 0.3, id: () => "platform", admins: ["ADM-001"], change: () => ({ before: { "operations.maxSearchMinutes": 4 }, after: { "operations.maxSearchMinutes": 5 } }) },
  { action: "admin.role_change", resourceType: "admin", weight: 0.2, id: () => pick(["ADM-006", "ADM-013"]), admins: ["ADM-001"], reason: () => "Mudança de equipa.", change: () => ({ before: { roleId: "SUPPORT_AGENT" }, after: { roleId: "FLEET_OPS_MANAGER" } }) },
];

/** 3 000 historical entries over 90 days, oldest first; new actions are prepended by services. */
export function generateAuditLogs(): AuditLog[] {
  return withSeed("audit", () => {
    const nowMs = now();
    const times = Array.from({ length: COUNTS.audit }, () => nowMs - int(2, 90 * 24 * 60) * 60_000).sort((a, b) => b - a);
    return times.map((atMs, i) => {
      const t = weighted(AUDIT_TEMPLATES.map((tpl) => [tpl, tpl.weight] as const));
      const admin = pick(t.admins);
      const change = t.change?.();
      return {
        id: auditId(COUNTS.audit - i),
        adminId: admin,
        adminName: adminName(admin),
        action: t.action as AuditLog["action"],
        resourceType: t.resourceType,
        resourceId: t.id(),
        at: iso(atMs),
        before: change?.before,
        after: change?.after,
        reason: t.reason?.(),
        correlationId: `req_${hex(16).toLowerCase()}`,
        ip: `10.20.${int(0, 9)}.${int(2, 254)}`,
      };
    });
  });
}

/** 30 data-subject requests; the open ones have due dates in the next weeks. */
export function generateGdprRequests(customers: readonly CustomerRecord[]): GdprRequest[] {
  return withSeed("gdpr", () => {
    const nowMs = now();
    const rows: GdprRequest[] = [];
    for (let i = 0; i < COUNTS.gdpr; i++) {
      const receivedMs = nowMs - (COUNTS.gdpr - i) * int(2, 4) * DAY;
      const ageDays = (nowMs - receivedMs) / DAY;
      const status: GdprRequestStatus = ageDays > 25 ? weighted([["COMPLETED", 88], ["REJECTED", 12]] as const) : weighted([["RECEIVED", 45], ["IN_PROGRESS", 45], ["COMPLETED", 10]] as const);
      const type = weighted<GdprRequestType>([["ACCESS", 35], ["ERASURE", 30], ["RECTIFICATION", 15], ["PORTABILITY", 12], ["RESTRICTION", 8]]);
      const driver = chance(0.15);
      const subjectIndex = int(20, COUNTS.customers - 1);
      rows.push({
        id: gdprId(i),
        subjectType: driver ? "DRIVER" : "CUSTOMER",
        subjectId: driver ? driverId(int(0, COUNTS.drivers - 1)) : customerId(subjectIndex),
        subjectName: driver ? "Motorista" : customers[subjectIndex]?.name ?? "Cliente",
        type,
        status,
        receivedAt: iso(receivedMs),
        dueAt: iso(receivedMs + 30 * DAY),
        completedAt: status === "COMPLETED" || status === "REJECTED" ? iso(receivedMs + int(3, 25) * DAY) : undefined,
        handledBy: status === "RECEIVED" ? undefined : "ADM-001",
        note:
          type === "ERASURE" && status === "COMPLETED"
            ? "Dados pessoais anonimizados. Faturas mantidas 10 anos por obrigação fiscal."
            : status === "REJECTED"
              ? "Identidade do requerente não confirmada."
              : undefined,
      });
    }
    return rows;
  });
}

export function defaultSettings(): PlatformSettings {
  return {
    branding: { platformName: "DeliGo", supportEmail: "contact@deligo.pt", supportPhone: "+351920136680" },
    localization: { defaultLanguage: "pt", timeZone: "Europe/Lisbon", currency: "EUR", dateFormat: "dd/MM/yyyy" },
    rideTypes: [
      { category: "ECONOMY", enabled: true, seats: 4 },
      { category: "COMFORT", enabled: true, seats: 4 },
      { category: "PREMIUM", enabled: true, seats: 4 },
    ],
    paymentMethods: [
      { method: "CARD", enabled: true, gatewayConfigured: true },
      { method: "MB_WAY", enabled: true, gatewayConfigured: true },
      { method: "APPLE_PAY", enabled: true, gatewayConfigured: true },
      { method: "GOOGLE_PAY", enabled: true, gatewayConfigured: true },
      { method: "WALLET", enabled: true, gatewayConfigured: true },
      { method: "CASH", enabled: true, gatewayConfigured: true },
    ],
    operations: {
      driverSearchRadiusKm: 5,
      driverAcceptTimeoutSec: 20,
      maxSearchMinutes: 5,
      scheduledLeadMinutes: 30,
      maxStops: 2,
      freeCancellationMinutes: 2,
      documentExpiryWarningDays: 30,
    },
    notifications: { emailOnSos: true, dailyDigest: true, payoutFailureAlerts: true },
    security: { sessionTimeoutMinutes: 30, mfaRequired: true, passwordMinLength: 12 },
    privacy: { dataRetentionYears: 5, invoiceRetentionYears: 10, maskPhonesForAnalysts: true },
    updatedAt: iso(now() - 12 * DAY),
    updatedBy: "ADM-001",
  };
}
