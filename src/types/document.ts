import type { DateRange, ISODate, ListParams } from "./common";

export type DocumentOwnerType = "DRIVER" | "FLEET" | "VEHICLE";

/**
 * Portuguese TVDE paperwork (to be confirmed by compliance, §18):
 * driver — carta de condução, certificado TVDE, CC/autorização de residência,
 * registo criminal, NIF, IBAN; vehicle — seguro, IPO, DUA; fleet — certidão
 * permanente, NIF, IBAN.
 */
export type DocumentType =
  | "DRIVING_LICENCE"
  | "TVDE_CERTIFICATE"
  | "ID_CARD"
  | "RESIDENCE_PERMIT"
  | "CRIMINAL_RECORD"
  | "NIF_PROOF"
  | "IBAN_PROOF"
  | "INSURANCE"
  | "INSPECTION"
  | "VEHICLE_REGISTRATION"
  | "COMPANY_CERTIFICATE";

export type DocumentStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type DocumentReview = {
  status: DocumentStatus | "SUBMITTED" | "RESUBMISSION_REQUESTED";
  at: ISODate;
  by: string;
  reason?: string;
};

export type ComplianceDocument = {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  type: DocumentType;
  /** Placeholder preview (the prototype has no real uploads). */
  fileUrl: string;
  fileName: string;
  fileKind: "image" | "pdf";
  submittedAt: ISODate;
  expiresAt?: ISODate;
  status: DocumentStatus;
  rejectionReason?: string;
  reviewHistory: DocumentReview[];
};

export type DocumentListItem = ComplianceDocument & { ownerName: string };

export type DocumentListParams = ListParams &
  DateRange & {
    status?: DocumentStatus[];
    ownerType?: DocumentOwnerType[];
    type?: DocumentType[];
    ownerId?: string;
    /** Approved documents expiring within N days (expiry queue). */
    expiringWithinDays?: number;
  };
