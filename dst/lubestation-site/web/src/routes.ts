export const ROUTES = {
  home: "/",
  governance: "/corporate-governance",
  partners: "/partner-ecosystem",
  /** Followed by the dealer's slug (see src/data/dealers.ts). */
  dealerReport: "/dealer-report",
  support: "/technical-support",
  scheme: "/scheme-overview",
  core: "/core-operations",
  admin: "/admin",
} as const;

/** Section links shown in the home page navigation, in display order. */
export const SECTION_NAV = [
  { to: ROUTES.governance, label: "Corporate Governance" },
  { to: ROUTES.partners, label: "Partner Ecosystem" },
  { to: ROUTES.support, label: "Technical Support & Services" },
  { to: ROUTES.scheme, label: "Scheme Overview" },
  { to: ROUTES.core, label: "Core Operations" },
] as const;

/** Every page an admin can grant (same keys as LS_PAGES in public/api/_lib.php). */
export type PageKey = "home" | "partners" | "dealers" | "scheme" | "core" | "governance" | "support" | "admin";

/** Open to visitors without an account until an admin changes it (LS_DEFAULT_PUBLIC). */
export const DEFAULT_PUBLIC_PAGES: PageKey[] = ["home", "partners", "scheme", "core"];

/** Every page of the site, in the order shown on the admin page's access table. "admin" implies all. */
export const PAGE_LIST: { key: PageKey; label: string; path: string }[] = [
  { key: "home", label: "صفحه اصلی", path: ROUTES.home },
  { key: "partners", label: "انتخاب نمایندگی", path: ROUTES.partners },
  { key: "dealers", label: "گزارش نمایندگی", path: ROUTES.dealerReport },
  { key: "scheme", label: "معرفی طرح", path: ROUTES.scheme },
  { key: "core", label: "معرفی شرکت", path: ROUTES.core },
  { key: "governance", label: "داشبورد مدیریت ارشد", path: ROUTES.governance },
  { key: "support", label: "پشتیبانی فنی", path: ROUTES.support },
  { key: "admin", label: "مدیریت سامانه", path: ROUTES.admin },
];

/** Public site address, used for canonical links (keep in sync with public/sitemap.xml). */
export const SITE_URL = "https://lubestation.ir";
