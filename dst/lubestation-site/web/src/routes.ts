export const ROUTES = {
  home: "/",
  governance: "/corporate-governance",
  partners: "/partner-ecosystem",
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

/** Protected pages an admin can grant per user (same keys as LS_PAGES in public/api/_lib.php). */
export type PageKey = "governance" | "support" | "admin";

/**
 * Every page of the site, in the order shown on the admin page's access table. `key: null` marks
 * a public page that everyone sees; "admin" access implies all other pages.
 */
export const PAGE_LIST: { key: PageKey | null; label: string; path: string }[] = [
  { key: null, label: "صفحه اصلی", path: ROUTES.home },
  { key: null, label: "انتخاب نمایندگی", path: ROUTES.partners },
  { key: null, label: "معرفی طرح", path: ROUTES.scheme },
  { key: null, label: "معرفی شرکت", path: ROUTES.core },
  { key: "governance", label: "داشبورد مدیریت ارشد", path: ROUTES.governance },
  { key: "support", label: "پشتیبانی فنی", path: ROUTES.support },
  { key: "admin", label: "مدیریت سامانه", path: ROUTES.admin },
];

/** Public site address, used for canonical links (keep in sync with public/sitemap.xml). */
export const SITE_URL = "https://lubestation.ir";
