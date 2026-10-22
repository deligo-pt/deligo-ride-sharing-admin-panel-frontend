import type { DateRange, ISODate, ListParams, Localized } from "./common";

export type NotificationAudience = "CUSTOMERS" | "DRIVERS" | "FLEET_MANAGERS" | "SEGMENT";
export type NotificationChannel = "PUSH" | "EMAIL" | "SMS";
export type NotificationStatus = "DRAFT" | "SCHEDULED" | "SENT" | "FAILED" | "CANCELLED";

/** Saved segments for `SEGMENT` audiences. */
export type NotificationSegment =
  | "CUSTOMERS_LISBOA"
  | "CUSTOMERS_PORTO"
  | "CUSTOMERS_FARO"
  | "DRIVERS_EXPIRING_DOCS"
  | "CUSTOMERS_INACTIVE_30D";

export type Notification = {
  id: string;
  title: Localized;
  body: Localized;
  audience: NotificationAudience;
  segment?: NotificationSegment;
  channels: NotificationChannel[];
  scheduledFor?: ISODate;
  sentAt?: ISODate;
  status: NotificationStatus;
  /** Recipients when sent; the estimate while draft/scheduled. */
  recipients: number;
  delivery: { sent: number; delivered: number; failed: number; opened: number };
  createdAt: ISODate;
  createdBy: string;
};

export type NotificationInput = Pick<
  Notification,
  "title" | "body" | "audience" | "segment" | "channels" | "scheduledFor"
>;

export type NotificationListParams = ListParams &
  DateRange & {
    status?: NotificationStatus[];
    audience?: NotificationAudience[];
    channel?: NotificationChannel[];
  };
