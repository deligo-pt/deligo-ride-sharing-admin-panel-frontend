"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The one way to show a status (§G). One tone map per entity status; the
 * label is `status.<kind>.<value>` in the messages. Tones: success = done/ok,
 * warning = needs attention soon, danger = blocked/failed, info = waiting on
 * someone, brand = in motion, neutral = closed/inactive.
 */
type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const TONES = {
  customer: { ACTIVE: "success", SUSPENDED: "danger", PENDING_VERIFICATION: "warning", DEACTIVATED: "neutral" },
  verification: { VERIFIED: "success", UNVERIFIED: "warning" },
  account: { ACTIVE: "success", SUSPENDED: "danger", DEACTIVATED: "neutral" },
  driverVerification: {
    NOT_SUBMITTED: "neutral",
    PENDING_DOCS: "warning",
    UNDER_REVIEW: "info",
    APPROVED: "success",
    REJECTED: "danger",
    SUSPENDED: "danger",
  },
  credential: { VALID: "success", EXPIRING_SOON: "warning", EXPIRED: "danger", MISSING: "neutral" },
  fleetVerification: { PENDING: "info", APPROVED: "success", REJECTED: "danger" },
  vehicleApproval: { PENDING_REVIEW: "info", APPROVED: "success", REJECTED: "danger", SUSPENDED: "danger" },
  vehicleOperational: { ACTIVE: "success", INACTIVE: "neutral", SUSPENDED: "danger" },
  ride: {
    SCHEDULED: "info",
    REQUESTED: "warning",
    SEARCHING: "warning",
    ACCEPTED: "brand",
    DRIVER_ARRIVING: "brand",
    DRIVER_ARRIVED: "brand",
    IN_PROGRESS: "brand",
    COMPLETED: "success",
    CANCELLED: "neutral",
    EXPIRED: "neutral",
    EMERGENCY: "danger",
  },
  payment: {
    PENDING: "warning",
    PROCESSING: "info",
    SUCCESSFUL: "success",
    FAILED: "danger",
    REFUNDED: "neutral",
    PARTIALLY_REFUNDED: "warning",
    NOT_CHARGED: "neutral",
  },
  reconciliation: {
    MATCHED: "success",
    IN_PROGRESS: "info",
    AWAITING_FILE: "neutral",
    NOT_EXPECTED: "neutral",
    MISMATCH: "danger",
  },
  commissionRule: { ACTIVE: "success", SCHEDULED: "info", ENDED: "neutral", WITHDRAWN: "neutral" },
  settlement: { PENDING: "warning", PROCESSING: "info", COMPLETED: "success", FAILED: "danger" },
  payout: { PENDING: "warning", PROCESSING: "info", SUCCESSFUL: "success", FAILED: "danger" },
  pricing: { DRAFT: "neutral", SCHEDULED: "info", ACTIVE: "success", ARCHIVED: "neutral" },
  promotion: { SCHEDULED: "info", ACTIVE: "success", EXPIRED: "neutral", DISABLED: "neutral", EXHAUSTED: "warning" },
  ticket: { OPEN: "warning", IN_PROGRESS: "info", ESCALATED: "danger", RESOLVED: "success", CLOSED: "neutral" },
  priority: { LOW: "neutral", MEDIUM: "info", HIGH: "warning", CRITICAL: "danger" },
  incident: { ACTIVE: "danger", RESOLVED: "success", FALSE_ALARM: "neutral" },
  notification: { DRAFT: "neutral", SCHEDULED: "info", SENT: "success", FAILED: "danger", CANCELLED: "neutral" },
  document: { PENDING: "info", APPROVED: "success", REJECTED: "danger", EXPIRED: "warning" },
  invoice: { ISSUED: "success", FAILED: "danger", CANCELLED: "neutral" },
  admin: { ACTIVE: "success", INVITED: "info", DISABLED: "neutral" },
  gdpr: { RECEIVED: "warning", IN_PROGRESS: "info", COMPLETED: "success", REJECTED: "neutral" },
} as const satisfies Record<string, Record<string, Tone>>;

export type StatusKind = keyof typeof TONES;
export type StatusValue<K extends StatusKind> = keyof (typeof TONES)[K] & string;

export function StatusBadge<K extends StatusKind>({
  kind,
  value,
  className,
}: {
  kind: K;
  value: StatusValue<K>;
  className?: string;
}) {
  const t = useTranslations("status");
  const tone = (TONES[kind] as Record<string, Tone>)[value] ?? "neutral";
  return (
    <Badge variant={tone} className={cn("text-micro h-5", className)} data-status={value}>
      {t(`${kind}.${value}` as Parameters<typeof t>[0])}
    </Badge>
  );
}

/** The values of a status kind, for filter options. */
export const statusValues = <K extends StatusKind>(kind: K) => Object.keys(TONES[kind]) as StatusValue<K>[];
