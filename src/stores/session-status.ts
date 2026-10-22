"use client";

import { create } from "zustand";

/**
 * Where the current tab's session stands (P6). The session itself lives in
 * the `deligo-session` cookie (`lib/session.ts`); this only tells the
 * SessionWatcher what to show:
 * - `active`: signed in.
 * - `expired`: the "session expired" dialog. `cause` is `idle` (no activity
 *   for the timeout) or `ended` (a call came back UNAUTHORIZED, or the
 *   session ended in another tab).
 * - `signingOut`: the admin chose Log out — no dialog, just leave.
 */
export type SessionStatus = "active" | "expired" | "signingOut";
export type ExpiryCause = "idle" | "ended";

type State = { status: SessionStatus; cause: ExpiryCause };

export const useSessionStatus = create<State>()(() => ({ status: "active", cause: "ended" }));

export const setSessionStatus = (status: SessionStatus, cause: ExpiryCause = "ended") =>
  useSessionStatus.setState({ status, cause });

/** Ends the session in this tab unless it is already ending. */
export function expireSession(cause: ExpiryCause = "ended") {
  if (useSessionStatus.getState().status === "active") setSessionStatus("expired", cause);
}
