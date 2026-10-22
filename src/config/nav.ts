import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  Car,
  ChartColumn,
  CreditCard,
  FileCheck2,
  Gauge,
  History,
  IdCard,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  Megaphone,
  Percent,
  ReceiptText,
  Route,
  Rocket,
  Settings,
  SlidersHorizontal,
  ShieldCheck,
  Tag,
  TicketPercent,
  Users,
  UsersRound,
  Wallet,
  Workflow,
} from "lucide-react";

/**
 * The admin menu — single source for the sidebar, the mobile drawer, the
 * breadcrumbs and the ⌘K command palette. Order = order on screen.
 *
 * Labels live in messages: `nav.groups.<group key>` and `nav.items.<key>`.
 * `key` doubles as the permission module name (§E). `phase` is the
 * ride_plan.md phase that builds the page.
 */
export type ModuleKey =
  | "dashboard"
  | "live"
  | "customers"
  | "drivers"
  | "fleet"
  | "vehicles"
  | "documents"
  | "rides"
  | "pricing"
  | "support"
  | "payments"
  | "commission"
  | "payouts"
  | "invoices"
  | "promotions"
  | "notifications"
  | "reports"
  | "admins"
  | "audit"
  | "settings";

export type NavGroupKey = "overview" | "people" | "operations" | "finance" | "growth" | "system";

export type NavItem = {
  key: ModuleKey;
  href: `/${string}`;
  icon: LucideIcon;
  phase: string;
  /** Extra words (PT and EN) the command palette matches on, besides the label. */
  keywords?: string[];
};

/** `icon` heads the group's drawer in the sidebar and stands for it on the icon rail. */
export type NavGroup = { key: NavGroupKey; icon: LucideIcon; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    key: "overview",
    icon: Gauge,
    items: [
      {
        key: "dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        phase: "P8",
        keywords: ["kpi", "home", "início"],
      },
      {
        key: "live",
        href: "/live",
        icon: MapPinned,
        phase: "P15",
        keywords: ["map", "mapa", "tracking"],
      },
    ],
  },
  {
    key: "people",
    icon: UsersRound,
    items: [
      {
        key: "customers",
        href: "/customers",
        icon: Users,
        phase: "P9",
        keywords: ["riders", "passageiros"],
      },
      {
        key: "drivers",
        href: "/drivers",
        icon: IdCard,
        phase: "P10",
        keywords: ["tvde", "licence", "carta"],
      },
      {
        key: "fleet",
        href: "/fleet-managers",
        icon: Building2,
        phase: "P11",
        keywords: ["frota", "partners"],
      },
      {
        key: "vehicles",
        href: "/vehicles",
        icon: Car,
        phase: "P12",
        keywords: ["insurance", "seguro", "inspeção"],
      },
      {
        key: "documents",
        href: "/documents",
        icon: FileCheck2,
        phase: "P24",
        keywords: ["verification", "verificação", "kyc"],
      },
    ],
  },
  {
    key: "operations",
    icon: Workflow,
    items: [
      {
        key: "rides",
        href: "/rides",
        icon: Route,
        phase: "P13",
        keywords: ["trips", "corridas", "scheduled", "agendadas"],
      },
      {
        key: "pricing",
        href: "/pricing",
        icon: Tag,
        phase: "P16",
        keywords: ["surge", "zones", "zonas", "dinâmico"],
      },
      {
        key: "support",
        href: "/support",
        icon: LifeBuoy,
        phase: "P21",
        keywords: ["tickets", "sos", "incidents", "incidentes"],
      },
    ],
  },
  {
    key: "finance",
    icon: Wallet,
    items: [
      {
        key: "payments",
        href: "/payments",
        icon: CreditCard,
        phase: "P17",
        keywords: ["refunds", "reembolsos", "transactions"],
      },
      {
        key: "commission",
        href: "/commission",
        icon: Percent,
        phase: "P18",
        keywords: ["settlements", "liquidações"],
      },
      {
        key: "payouts",
        href: "/payouts",
        icon: Banknote,
        phase: "P19",
        keywords: ["earnings", "ganhos", "payouts"],
      },
      {
        key: "invoices",
        href: "/invoices",
        icon: ReceiptText,
        phase: "P25",
        keywords: ["saft", "e-fatura", "iva", "vat"],
      },
    ],
  },
  {
    key: "growth",
    icon: Rocket,
    items: [
      {
        key: "promotions",
        href: "/promotions",
        icon: TicketPercent,
        phase: "P20",
        keywords: ["promo codes", "códigos", "discounts", "descontos"],
      },
      {
        key: "notifications",
        href: "/notifications",
        icon: Megaphone,
        phase: "P22",
        keywords: ["announcements", "broadcast", "avisos"],
      },
      {
        key: "reports",
        href: "/reports",
        icon: ChartColumn,
        phase: "P23",
        keywords: ["export", "exportar", "csv", "analytics"],
      },
    ],
  },
  {
    key: "system",
    icon: SlidersHorizontal,
    items: [
      {
        key: "admins",
        href: "/admin-users",
        icon: ShieldCheck,
        phase: "P26",
        keywords: ["permissions", "permissões", "roles"],
      },
      {
        key: "audit",
        href: "/audit-logs",
        icon: History,
        phase: "P27",
        keywords: ["logs", "histórico"],
      },
      {
        key: "settings",
        href: "/settings",
        icon: Settings,
        phase: "P28",
        keywords: ["privacy", "privacidade", "gdpr", "rgpd"],
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV.flatMap((group) => group.items);

/** The nav entry for a (locale-free) pathname — the longest matching href wins. */
export function findNavItem(pathname: string): { item: NavItem; group: NavGroup } | null {
  let best: { item: NavItem; group: NavGroup } | null = null;
  for (const group of NAV) {
    for (const item of group.items) {
      const match = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (match && (!best || item.href.length > best.item.href.length)) best = { item, group };
    }
  }
  return best;
}
