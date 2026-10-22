import type { ComplianceDocument, DocumentOwnerType, DocumentStatus, DocumentType } from "@/types/document";
import { DAY, iso } from "../clock";
import { documentId } from "../ids";
import { chance, int, pick } from "../seed";

/** Each owner type gets its own ID range so lazily-built parts never collide. */
export const DOCUMENT_ID_OFFSET: Record<DocumentOwnerType, number> = {
  DRIVER: 0, // DOC-70000…
  VEHICLE: 5000, // DOC-75000…
  FLEET: 8000, // DOC-78000…
};
/** Documents uploaded during the demo start here. */
export const NEW_DOCUMENT_OFFSET = 9000;

const FILE_LABEL: Record<DocumentType, string> = {
  DRIVING_LICENCE: "carta-conducao",
  TVDE_CERTIFICATE: "certificado-tvde",
  ID_CARD: "cartao-cidadao",
  RESIDENCE_PERMIT: "autorizacao-residencia",
  CRIMINAL_RECORD: "registo-criminal",
  NIF_PROOF: "comprovativo-nif",
  IBAN_PROOF: "comprovativo-iban",
  INSURANCE: "apolice-seguro",
  INSPECTION: "ficha-inspecao-ipo",
  VEHICLE_REGISTRATION: "dua",
  COMPANY_CERTIFICATE: "certidao-permanente",
};

/** Scans are photos; certificates and proofs arrive as PDFs. */
const PDF_TYPES: readonly DocumentType[] = [
  "CRIMINAL_RECORD",
  "NIF_PROOF",
  "IBAN_PROOF",
  "INSURANCE",
  "INSPECTION",
  "COMPANY_CERTIFICATE",
];

export const REJECTION_REASONS: Record<DocumentType, readonly string[]> = {
  DRIVING_LICENCE: ["Imagem ilegível — verso da carta em falta.", "Carta de condução caducada."],
  TVDE_CERTIFICATE: ["Certificado TVDE não corresponde ao titular.", "Certificado caducado."],
  ID_CARD: ["Cartão de Cidadão com fotografia desfocada.", "Documento caducado."],
  RESIDENCE_PERMIT: ["Autorização de residência caducada.", "Falta o verso do documento."],
  CRIMINAL_RECORD: ["Registo criminal com mais de 3 meses.", "Registo criminal com averbamentos."],
  NIF_PROOF: ["Nome no comprovativo não coincide com o perfil."],
  IBAN_PROOF: ["IBAN não pertence ao titular da conta.", "Comprovativo sem carimbo do banco."],
  INSURANCE: ["Apólice não cobre transporte de passageiros (TVDE).", "Seguro caducado."],
  INSPECTION: ["Ficha de inspeção com resultado reprovado.", "Inspeção caducada."],
  VEHICLE_REGISTRATION: ["Matrícula no DUA não coincide com o veículo."],
  COMPANY_CERTIFICATE: ["Certidão permanente sem CAE de transporte.", "Código de acesso inválido."],
};

type DocInput = {
  ownerType: DocumentOwnerType;
  ownerId: string;
  type: DocumentType;
  /** Position within the owner type's range. */
  seq: number;
  submittedMs: number;
  expiresMs?: number;
  status: DocumentStatus;
  reviewerId?: string;
  rejectionReason?: string;
};

export function makeDocument(input: DocInput): ComplianceDocument {
  const id = documentId(DOCUMENT_ID_OFFSET[input.ownerType] + input.seq);
  const pdf = PDF_TYPES.includes(input.type);
  const reviewedMs = input.submittedMs + int(2, 72) * 3_600_000;
  const reviewHistory: ComplianceDocument["reviewHistory"] = [
    { status: "SUBMITTED", at: iso(input.submittedMs), by: input.ownerId },
  ];
  if (input.status !== "PENDING" && input.reviewerId) {
    reviewHistory.push({
      status: input.status === "EXPIRED" ? "APPROVED" : input.status,
      at: iso(reviewedMs),
      by: input.reviewerId,
      reason: input.rejectionReason,
    });
  }
  return {
    id,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    type: input.type,
    fileKind: pdf ? "pdf" : "image",
    fileName: `${FILE_LABEL[input.type]}-${input.ownerId.toLowerCase()}.${pdf ? "pdf" : "jpg"}`,
    // Placeholder scan (the prototype has no uploads); PDFs show an icon instead.
    fileUrl: pdf ? "" : `https://picsum.photos/seed/${id}/800/560`,
    submittedAt: iso(input.submittedMs),
    expiresAt: input.expiresMs === undefined ? undefined : iso(input.expiresMs),
    status: input.status,
    rejectionReason: input.rejectionReason,
    reviewHistory,
  };
}

/** Expiry a few months to years ahead, with a share already close or past. */
export function expiryFrom(nowMs: number, opts: { minDays: number; maxDays: number; soonShare?: number; pastShare?: number }) {
  if (opts.pastShare && chance(opts.pastShare)) return nowMs - int(1, 40) * DAY;
  if (opts.soonShare && chance(opts.soonShare)) return nowMs + int(1, 29) * DAY;
  return nowMs + int(opts.minDays, opts.maxDays) * DAY;
}

export const pickReason = (type: DocumentType) => pick(REJECTION_REASONS[type]);
