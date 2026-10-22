/**
 * Records for the guided demo — the generators force these into the states
 * described, so the presenter always finds them (P30 writes the demo script
 * around this list). IDs are fixed; everything else about them is generated.
 */
export const DEMO = {
  /** Approved fleet driver whose TVDE certificate expires in 6 days. */
  driverTvdeExpiring: "DRV-20001",
  /** New applicant: all documents uploaded, waiting for review. */
  driverUnderReview: "DRV-20002",
  /** Approved, but the driving licence expired 3 days ago → not eligible. */
  driverLicenceExpired: "DRV-20003",
  /** Independent driver whose last weekly payout failed (IBAN rejected). */
  driverFailedPayout: "DRV-20004",
  /** Rejected applicant: criminal record certificate refused. */
  driverRejected: "DRV-20008",
  /** Fleet company that applied this week — onboarding documents pending. */
  fleetPending: "FLT-336",
  /** Spare fleet car waiting for approval (insurance uploaded today). */
  vehiclePending: "VEH-5600",
  /** Customer suspended after repeated no-shows (has an admin note). */
  customerSuspended: "CUS-10007",
  /** Frequent customer — long ride history, several invoices with NIF. */
  customerFrequent: "CUS-10001",
  /** SOS raised by the customer on a ride in progress right now (the newest incident). */
  incidentActive: "INC-124",
  /** The ride with the active SOS (status EMERGENCY). */
  rideEmergency: "RIDE-880000",
  /** A completed ride with a partial refund (wrong route complaint). */
  ridePartialRefund: "RIDE-878000",
  /** Escalated safety complaint about a driver, opened 2 hours ago. */
  ticketEscalated: "TCK-5399",
  /** Promotion that is live now and heavily used. */
  promotionActive: "PRM-100",
} as const;

/** Customer index used for the frequent-rider fixture (gets ~0.4% of rides, about 80). */
export const FREQUENT_CUSTOMER_INDEX = 1;
