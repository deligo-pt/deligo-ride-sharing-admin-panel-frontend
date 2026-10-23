"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeStorage } from "@/lib/safe-storage";
import { GATEWAY_METHODS, type GatewayMethod } from "@/types/payment";

/**
 * Demo controls (shown in Settings → Demo, P28). Read by `mock/latency.ts`
 * on every service call, so changes apply to the next request.
 */
type DemoSettings = {
  /** 150–600 ms per call, so loading states are visible. */
  latency: boolean;
  /** Fail a share of calls with a NETWORK error, to show error states. */
  simulateErrors: boolean;
  /** Share of calls that fail while `simulateErrors` is on (0–1). */
  errorRate: number;
  /** Sign out after 1 minute of inactivity instead of 30, to show the session-expired flow. */
  shortSessions: boolean;
  /**
   * Whether each payment method's gateway integration is configured and
   * enabled. Payments → Methods shows a method as "Operational" only when it
   * is (requirements §12). A demo stand-in for the real integration status.
   */
  gateways: Record<GatewayMethod, boolean>;
  setLatency: (on: boolean) => void;
  setSimulateErrors: (on: boolean) => void;
  setErrorRate: (rate: number) => void;
  setShortSessions: (on: boolean) => void;
  setGateway: (method: GatewayMethod, on: boolean) => void;
};

export const useDemoSettings = create<DemoSettings>()(
  persist(
    (set) => ({
      latency: true,
      simulateErrors: false,
      errorRate: 0.3,
      shortSessions: false,
      gateways: Object.fromEntries(GATEWAY_METHODS.map((m) => [m, true])) as Record<GatewayMethod, boolean>,
      setLatency: (latency) => set({ latency }),
      setSimulateErrors: (simulateErrors) => set({ simulateErrors }),
      setErrorRate: (errorRate) => set({ errorRate: Math.min(1, Math.max(0, errorRate)) }),
      setShortSessions: (shortSessions) => set({ shortSessions }),
      setGateway: (method, on) => set((state) => ({ gateways: { ...state.gateways, [method]: on } })),
    }),
    { name: "deligo-ride-admin:demo-settings", storage: safeStorage },
  ),
);
