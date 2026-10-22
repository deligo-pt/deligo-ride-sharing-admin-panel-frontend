/**
 * The one error type services throw — shaped like a future API error body.
 * Screens switch on `code` (translated in P5's ErrorState), never on `message`
 * (English, for developers).
 */
export type ServiceErrorCode =
  | "NETWORK" // simulated outage ("simulate errors" demo setting) or fetch failure later
  | "NOT_FOUND"
  | "VALIDATION" // bad input; `field` names the form field
  | "CONFLICT" // action not allowed in the record's current state
  | "FORBIDDEN"
  | "UNAUTHORIZED"; // no session (signed out, expired, or signed out in another tab)

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly field?: string;
  /** Extra values for the screen's message, e.g. `{ attemptsLeft: 3 }`. */
  readonly details?: Record<string, string | number>;

  constructor(
    code: ServiceErrorCode,
    message: string,
    field?: string,
    details?: Record<string, string | number>,
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.field = field;
    this.details = details;
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
