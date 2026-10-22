import type { RoleId } from "@/config/roles";
import type { AdminStatus } from "./admin";
import type { ISODate } from "./common";

export type SignInInput = { email: string; password: string };

/** Accounts with two-factor get an OTP step; the others are signed in straight away. */
export type SignInResult =
  | { status: "SIGNED_IN"; session: SessionData }
  | { status: "OTP_REQUIRED"; challenge: OtpChallenge };

export type OtpChallenge = {
  id: string;
  /** "an***@deligo.pt" — where the code was "sent". */
  sentTo: string;
  expiresAt: ISODate;
  /** Resend is allowed from this moment. */
  resendAt: ISODate;
};

/** What the session cookie holds (lib/session.ts `Session`). */
export type SessionData = {
  adminId: string;
  name: string;
  email: string;
  role: RoleId;
  mfa: boolean;
  signedInAt: ISODate;
};

/** Demo only: the accounts listed on the login page (one per role + two error cases). */
export type DemoAccount = {
  adminId: string;
  name: string;
  email: string;
  roleId: RoleId;
  status: AdminStatus;
  mfaEnabled: boolean;
};

export type PasswordResetRequest = {
  /**
   * Demo only — the real API answers 202 with no body and e-mails the link.
   * Present when the account exists, so the prototype can open the "e-mail".
   */
  demoResetToken?: string;
};

export type ResetTokenInfo = { sentTo: string; expiresAt: ISODate };
