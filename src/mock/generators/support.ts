import type { StatusChange } from "@/types/common";
import type { Ride } from "@/types/ride";
import type {
  IncidentStatus,
  SafetyIncident,
  Ticket,
  TicketCategory,
  TicketEvent,
  TicketPriority,
  TicketStatus,
} from "@/types/support";
import type { CustomerRecord } from "../records";
import { DAY, iso, now } from "../clock";
import { adminName, adminsWithRole } from "../fixtures/admins";
import { DEMO } from "../fixtures/demo";
import { COUNTS, incidentId, indexOf, noteId, rideId, ticketId } from "../ids";
import { chance, int, pick, weighted, withSeed } from "../seed";

export type SupportBundle = { tickets: Ticket[]; incidents: SafetyIncident[] };

type Inputs = { rides: readonly Ride[]; customers: readonly CustomerRecord[] };

const AGENTS = adminsWithRole("SUPPORT_AGENT");

/** What customers and drivers write — in their own language (PT, a few EN). */
const TEMPLATES: Record<TicketCategory, readonly { subject: string; text: string; en?: true }[]> = {
  COMPLAINT: [
    { subject: "Percurso mais longo", text: "O motorista fez um caminho muito mais longo do que o GPS indicava e a viagem ficou bastante mais cara." },
    { subject: "Viatura suja", text: "O carro estava sujo e cheirava a tabaco. Não é o que espero de uma viagem Conforto." },
    { subject: "Motorista não apareceu", text: "A app dizia que o motorista tinha chegado mas ele não estava no local. Esperei 10 minutos." },
    { subject: "Ar condicionado desligado", text: "Pedi para ligar o ar condicionado e o motorista recusou. Estavam 34 graus." },
    { subject: "Longer route than needed", text: "The driver took a much longer route than the app suggested and I was charged more.", en: true },
  ],
  DRIVER_BEHAVIOUR: [
    { subject: "Condução perigosa", text: "O motorista ia em excesso de velocidade na 2.ª Circular e a falar ao telemóvel." },
    { subject: "Motorista mal-educado", text: "O motorista foi rude quando lhe pedi para parar perto da porta do hotel." },
    { subject: "Recusou levar o cão", text: "Tenho um cão-guia e o motorista recusou a viagem à chegada." },
    { subject: "Rude driver", text: "The driver was shouting on the phone the whole trip and ignored my requests.", en: true },
  ],
  PAYMENT: [
    { subject: "Cobrança duplicada", text: "Fui cobrado duas vezes pela mesma viagem no cartão. Peço o reembolso de uma das cobranças." },
    { subject: "Taxa de cancelamento indevida", text: "Cancelei dentro dos 2 minutos e mesmo assim cobraram a taxa de cancelamento." },
    { subject: "MB WAY não confirmado", text: "Aprovei o pagamento no MB WAY mas a app diz que está pendente." },
    { subject: "Fatura sem NIF", text: "Pedi fatura com NIF e a fatura saiu como consumidor final. Podem corrigir?" },
    { subject: "Charged after cancellation", text: "The driver cancelled but I was still charged the full fare.", en: true },
  ],
  LOST_ITEM: [
    { subject: "Telemóvel esquecido", text: "Deixei o meu telemóvel no banco de trás. É um iPhone com capa azul." },
    { subject: "Mochila esquecida", text: "Esqueci uma mochila preta com um portátil no porta-bagagens." },
    { subject: "Chaves perdidas", text: "Acho que deixei as chaves de casa no carro. Têm um porta-chaves do Benfica." },
    { subject: "Left my wallet", text: "I left my wallet in the car, brown leather. Please help me contact the driver.", en: true },
  ],
  SAFETY: [
    { subject: "Senti-me inseguro", text: "O motorista fez comentários inapropriados durante a viagem. Senti-me muito desconfortável." },
    { subject: "Pequeno acidente", text: "Houve uma pequena colisão numa rotunda. Ninguém se magoou mas quero reportar." },
    { subject: "Passageiro agressivo", text: "O passageiro ficou agressivo e ameaçou-me quando pedi para pôr o cinto." },
  ],
  GENERAL: [
    { subject: "Alterar e-mail da conta", text: "Gostaria de alterar o e-mail associado à minha conta." },
    { subject: "Apagar a minha conta", text: "Quero apagar a minha conta e todos os meus dados." },
    { subject: "Sugestão", text: "Seria ótimo poder agendar viagens com mais de 7 dias de antecedência." },
    { subject: "Pagamento semanal atrasado", text: "Ainda não recebi a transferência desta semana. Podem verificar?" },
  ],
};

const RESOLUTIONS: Record<TicketCategory, readonly string[]> = {
  COMPLAINT: ["Reembolso parcial da diferença de percurso.", "Motorista advertido; crédito de 3 € atribuído ao cliente."],
  DRIVER_BEHAVIOUR: ["Motorista advertido por escrito.", "Motorista suspenso 7 dias após análise."],
  PAYMENT: ["Cobrança duplicada estornada.", "Taxa de cancelamento reembolsada.", "Fatura reemitida com NIF."],
  LOST_ITEM: ["Objeto entregue ao cliente pelo motorista.", "Motorista não encontrou o objeto; cliente informado."],
  SAFETY: ["Caso analisado pela equipa de segurança; motorista desativado.", "Relatório enviado à seguradora."],
  GENERAL: ["Pedido tratado e cliente informado.", "Encaminhado para o pedido RGPD correspondente."],
};

const INTERNAL_NOTES = [
  "Contactei o motorista por telefone; confirma a versão do cliente.",
  "Verificado o percurso GPS: desvio de 3,2 km.",
  "Aguardo resposta do cliente por e-mail.",
  "Pedi à equipa financeira para validar o estorno.",
  "Motorista com 2 queixas semelhantes nos últimos 30 dias.",
];

function ageStatus(ageDays: number): TicketStatus {
  if (ageDays < 1) return weighted<TicketStatus>([["OPEN", 50], ["IN_PROGRESS", 40], ["ESCALATED", 10]]);
  if (ageDays < 7) return weighted<TicketStatus>([["OPEN", 15], ["IN_PROGRESS", 40], ["ESCALATED", 8], ["RESOLVED", 37]]);
  return weighted<TicketStatus>([["RESOLVED", 60], ["CLOSED", 36], ["ESCALATED", 1.5], ["IN_PROGRESS", 2.5]]);
}

function priorityFor(category: TicketCategory): TicketPriority {
  if (category === "SAFETY") return weighted<TicketPriority>([["CRITICAL", 40], ["HIGH", 60]]);
  if (category === "DRIVER_BEHAVIOUR") return weighted<TicketPriority>([["HIGH", 40], ["MEDIUM", 60]]);
  if (category === "LOST_ITEM") return "MEDIUM";
  return weighted<TicketPriority>([["LOW", 45], ["MEDIUM", 45], ["HIGH", 10]]);
}

/** 400 tickets over 90 days (TCK-5000…5399, in generation order) and 25 SOS incidents. */
export function generateSupport(input: Inputs): SupportBundle {
  return withSeed("support", () => {
    const nowMs = now();
    const finished = input.rides.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED");
    const rideEndMs = (r: Ride) => Date.parse(r.completedAt ?? r.cancellation?.at ?? r.bookedAt);
    // Rides are picked by ID slot, walking back to the nearest one that fits —
    // never pick(list): the list's length changes with the time of day (today's
    // later slots are dropped), which would change every pick after it.
    const byId = new Map(input.rides.map((r) => [r.id, r]));
    const rideAtOrBefore = (slot: number, fits: (r: Ride) => boolean) => {
      for (let i = slot; i >= 0; i--) {
        const r = byId.get(rideId(i));
        if (r && fits(r)) return r;
      }
      return finished[0]!;
    };
    const isFinished = (r: Ride) => r.status === "COMPLETED" || r.status === "CANCELLED";

    type Draft = Omit<Ticket, "id" | "history" | "notes"> & { seedNotes: number };
    const drafts: Draft[] = [];
    for (let i = 0; i < COUNTS.tickets; i++) {
      const category = weighted<TicketCategory>([
        ["COMPLAINT", 25],
        ["DRIVER_BEHAVIOUR", 15],
        ["PAYMENT", 20],
        ["LOST_ITEM", 15],
        ["SAFETY", 7],
        ["GENERAL", 18],
      ]);
      const withRide = category !== "GENERAL" || chance(0.3);
      const slot = int(0, COUNTS.rides - 1);
      const ride = withRide ? rideAtOrBefore(slot, isFinished) : undefined;
      const reporter = category === "SAFETY" && chance(0.3) ? "DRIVER" : category === "GENERAL" && chance(0.25) ? "DRIVER" : "CUSTOMER";
      const createdMs = ride
        ? Math.min(nowMs - int(5, 60) * 60_000, rideEndMs(ride) + int(10, 72 * 60) * 60_000)
        : nowMs - int(10, 90 * 24 * 60) * 60_000;
      const customerId = ride?.customerId ?? (reporter === "CUSTOMER" ? `CUS-${10000 + int(0, COUNTS.customers - 1)}` : undefined);
      const customer = customerId ? input.customers[indexOf(customerId, 10000)] : undefined;
      const pool = TEMPLATES[category].filter((t) => (customer?.language === "en") === Boolean(t.en));
      const template = pick(pool.length ? pool : TEMPLATES[category]);
      const status = ageStatus((nowMs - createdMs) / DAY);
      // Drawn whatever the status (status depends on age, i.e. on the clock).
      const assignRoll = chance(0.3);
      const agent = pick(AGENTS).id;
      const resolutionText = pick(RESOLUTIONS[category]);
      const noteCount = int(0, 2);
      drafts.push({
        rideId: ride?.id,
        customerId,
        driverId: ride?.driverId,
        reporter,
        category,
        subject: template.subject,
        description: template.text,
        createdAt: iso(createdMs),
        updatedAt: iso(createdMs),
        priority: priorityFor(category),
        assigneeId: status !== "OPEN" || assignRoll ? agent : undefined,
        status,
        resolution: status === "RESOLVED" || status === "CLOSED" ? resolutionText : undefined,
        seedNotes: status === "OPEN" ? 0 : noteCount,
      });
    }
    // IDs follow generation order, not time: recent tickets are capped at "now",
    // so sorting by time would renumber them whenever the data is regenerated.

    // Fixture: the last ticket is a recent, escalated safety complaint about a driver.
    const fixture = drafts[drafts.length - 1]!;
    const fixtureRide = rideAtOrBefore(COUNTS.rides - 300, (r) => r.status === "COMPLETED" && !!r.driverId);
    Object.assign(fixture, {
      rideId: fixtureRide.id,
      customerId: fixtureRide.customerId,
      driverId: fixtureRide.driverId,
      reporter: "CUSTOMER",
      category: "DRIVER_BEHAVIOUR",
      subject: "Condução perigosa",
      description: "O motorista ia a mais de 100 km/h na Avenida da Índia, passou dois sinais vermelhos e ignorou quando pedi para abrandar.",
      priority: "CRITICAL",
      status: "ESCALATED",
      assigneeId: "ADM-005",
      resolution: undefined,
      seedNotes: 2,
      createdAt: iso(nowMs - 2 * 3_600_000),
      updatedAt: iso(nowMs - 2 * 3_600_000),
    } satisfies Partial<Draft>);

    let noteSeq = 5000;
    const tickets: Ticket[] = drafts.map(({ seedNotes, ...d }, i) => {
      const createdMs = Date.parse(d.createdAt);
      const stepMinutes = int(20, 240);
      const notePicks = [pick(INTERNAL_NOTES), pick(INTERNAL_NOTES)];
      const step = (n: number) => Math.min(nowMs - 60_000, createdMs + n * stepMinutes * 60_000);
      const history: TicketEvent[] = [
        { id: `${ticketId(i)}-E1`, type: "CREATED", at: d.createdAt, by: d.customerId ?? d.driverId ?? "SYSTEM", byName: d.reporter === "DRIVER" ? "Motorista" : "Cliente" },
      ];
      if (d.assigneeId) history.push({ id: `${ticketId(i)}-E2`, type: "ASSIGNED", at: iso(step(1)), by: "ADM-003", byName: adminName("ADM-003"), detail: d.assigneeId });
      if (d.status !== "OPEN") history.push({ id: `${ticketId(i)}-E3`, type: "STATUS", at: iso(step(2)), by: d.assigneeId ?? "ADM-003", byName: adminName(d.assigneeId ?? "ADM-003"), detail: "IN_PROGRESS" });
      if (d.status === "ESCALATED") history.push({ id: `${ticketId(i)}-E4`, type: "ESCALATED", at: iso(step(3)), by: d.assigneeId ?? "ADM-003", byName: adminName(d.assigneeId ?? "ADM-003"), detail: "Equipa de segurança" });
      if (d.status === "RESOLVED" || d.status === "CLOSED") history.push({ id: `${ticketId(i)}-E5`, type: "RESOLVED", at: iso(step(4)), by: d.assigneeId ?? "ADM-003", byName: adminName(d.assigneeId ?? "ADM-003"), detail: d.resolution });
      if (d.status === "CLOSED") history.push({ id: `${ticketId(i)}-E6`, type: "STATUS", at: iso(step(6)), by: "SYSTEM", byName: "Sistema", detail: "CLOSED" });
      const notes = Array.from({ length: seedNotes }, (_, n) => ({
        id: noteId(noteSeq++),
        text: notePicks[n]!,
        authorId: d.assigneeId ?? "ADM-003",
        authorName: adminName(d.assigneeId ?? "ADM-003"),
        createdAt: iso(step(2 + n)),
      }));
      return { ...d, id: ticketId(i), updatedAt: history[history.length - 1]!.at, history, notes };
    });

    // ---- SOS incidents -----------------------------------------------------
    const incidents: SafetyIncident[] = [];
    const past = Array.from({ length: COUNTS.incidents - 1 }, () =>
      rideAtOrBefore(int(0, COUNTS.rides - 1), (r) => r.status === "COMPLETED" && !!r.startedAt && !!r.driverId),
    ).sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
    past.forEach((ride, i) => {
      const raisedMs = Date.parse(ride.startedAt!) + int(2, Math.max(3, ride.durationMin - 1)) * 60_000;
      const status = weighted<IncidentStatus>([["RESOLVED", 62], ["FALSE_ALARM", 38]]);
      const escalatedTo = status === "RESOLVED" ? weighted([["SAFETY_TEAM", 60], ["PSP", 30], ["112", 10]] as const) : undefined;
      const resolvedMs = raisedMs + int(8, 90) * 60_000;
      const timeline: StatusChange<IncidentStatus | "ESCALATED">[] = [{ status: "ACTIVE", at: iso(raisedMs), by: ride.customerId }];
      if (escalatedTo) timeline.push({ status: "ESCALATED", at: iso(raisedMs + 3 * 60_000), by: "ADM-005", reason: escalatedTo });
      timeline.push({ status, at: iso(resolvedMs), by: "ADM-005" });
      incidents.push({
        id: incidentId(i),
        rideId: ride.id,
        customerId: ride.customerId,
        driverId: ride.driverId,
        initiator: chance(0.8) ? "CUSTOMER" : "DRIVER",
        location: { lat: ride.dropoff.lat, lng: ride.dropoff.lng, address: ride.dropoff.address },
        raisedAt: iso(raisedMs),
        status,
        escalatedTo,
        resolvedAt: iso(resolvedMs),
        resolvedBy: pick(AGENTS).id,
        outcome:
          status === "FALSE_ALARM"
            ? pick(["Botão SOS pressionado por engano; cliente confirmou que estava bem.", "Teste do cliente à funcionalidade SOS."])
            : pick(["Cliente acompanhado até casa; motorista suspenso para averiguação.", "PSP deslocou-se ao local; ocorrência registada.", "Discussão sobre o percurso; situação acalmada por telefone."]),
        timeline,
      });
    });

    // Fixture: live SOS on the EMERGENCY ride (the newest incident).
    const emergency = input.rides.find((r) => r.id === DEMO.rideEmergency);
    if (emergency) {
      const raisedMs = nowMs - 4 * 60_000;
      const point = emergency.lastLocation ?? emergency.pickup;
      incidents.push({
        id: incidentId(COUNTS.incidents - 1),
        rideId: emergency.id,
        customerId: emergency.customerId,
        driverId: emergency.driverId,
        initiator: "CUSTOMER",
        location: { lat: point.lat, lng: point.lng, address: emergency.pickup.address },
        raisedAt: iso(raisedMs),
        status: "ACTIVE",
        timeline: [{ status: "ACTIVE", at: iso(raisedMs), by: emergency.customerId }],
      });
    }
    return { tickets, incidents };
  });
}
