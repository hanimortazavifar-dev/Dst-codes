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

/** Public site address, used for canonical links (keep in sync with public/sitemap.xml). */
export const SITE_URL = "https://lubestation.ir";
