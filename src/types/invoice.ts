import type { Cents, DateRange, ISODate, ListParams } from "./common";

export type InvoiceStatus = "ISSUED" | "FAILED" | "CANCELLED";

/**
 * Invoice-receipt ("Fatura-Recibo") for a completed ride. The provider is a
 * placeholder until the certified invoicing software is chosen (§19,
 * Appendix B) — the prototype only shows the data.
 */
export type Invoice = {
  id: string;
  /** "FR 2026/000123". */
  number: string;
  /** AT validation code printed on the invoice, e.g. "JJ3K7M2P-123". */
  atcud?: string;
  rideId: string;
  customerId: string;
  customerName: string;
  /** Only when the customer asked for an invoice with NIF; otherwise "Consumidor final". */
  customerNif?: string;
  issuedAt: ISODate;
  netCents: Cents;
  vatRate: number;
  vatCents: Cents;
  totalCents: Cents;
  status: InvoiceStatus;
  provider: "e-Fatura (placeholder)";
  failureReason?: string;
  cancelledReason?: string;
};

export type InvoiceListParams = ListParams &
  DateRange & {
    status?: InvoiceStatus[];
    customerId?: string;
    rideId?: string;
  };

/** Monthly VAT summary for the accountant (SAF-T export lives with the provider). */
export type TaxSummary = {
  month: string;
  invoiceCount: number;
  netCents: Cents;
  vatCents: Cents;
  totalCents: Cents;
  failedCount: number;
};
