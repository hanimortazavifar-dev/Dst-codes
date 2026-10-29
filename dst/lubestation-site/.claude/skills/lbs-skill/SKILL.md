---
name: lbs-skill
description: Build or edit a LUBESTATION (DST) site page in web/ (React + Vite + TypeScript app with a PHP API, hosted on ParsPack at lubestation.ir) — visual identity, card/KPI layout, login-gate pattern, Excel data source, and the local-test-then-deploy workflow. Use whenever asked to create a new page for the site, restyle an existing one, add a login-gated section, change the data workbook, or touch anything under web/.
---

# LUBESTATION page-building skill

Follow these conventions for any new or edited page in `web/` so the site stays visually and structurally consistent. `web/README.md` has the full picture; this is the working checklist.

## 0. Project structure

React + Vite + TypeScript single-page app with clean URLs (`createBrowserRouter`, Apache rewrite in `public/.htaccess`), served from the root of **lubestation.ir** on ParsPack shared hosting. A small PHP API (`public/api/*.php`, PHP 7.3+, no database) handles login, users and the data file.

- `src/App.tsx` — route table (each route wrapped in `Page` for title/description/canonical/robots); `src/routes.ts` — paths and home nav.
- `src/pages/` — one component + CSS module per page. `src/components/` — `RequireRole`, `DataState`, `icons`, `governance/*`.
- `src/data/` — `schema.ts` (sheet/column titles of the workbook), `workbook.ts` (parse + validate), `stations.ts` (status logic), `useDashboard.ts` (loader).
- `src/three/` — three.js scenes. three is bundled from npm, never from a CDN.
- `src/assets/` — images and fonts as real files. Fonts are self-hosted; no Google Fonts or any foreign CDN (Iranian users).
- Styling: CSS Modules per component; each page sets its own theme tokens on its root class.

## 1. Visual identity

- **Theme**: dark background, amber/gold (`#FDB913` / `var(--amber)`) as the single accent color, `Vazirmatn`/`B Koodak` font, RTL (`dir="rtl" lang="fa"`), Persian digits (use `fa()` from `lib/format`), Jalali dates (`lib/jalali`).
- **Header block** (management pages, centered): DST logo (`src/assets/dst-logo.webp`), `LUBESTATION` in white bold, role/section subtitle in amber, and the `HOME` router link.
- **Cards**: content cards get a full `1px solid var(--amber)` border, `border-radius:14–16px`, `background:var(--surface)`.
- **KPI cards**: centered, muted label, large bold number (~30px), optional muted unit; size via `min-height` + padding.
- **Background ambiance**: the particle-sphere scene in `src/three/orbitBackground.ts`, started from a `useEffect` that returns its cleanup, `prefers-reduced-motion` respected.
- Remove decorative elements the user doesn't want promptly and fully (CSS, DOM and script together).

## 2. Data comes from the Excel workbook

- Never hard-code business numbers in JSX or `src/data/*.ts`. Add a column/sheet to `schema.ts`, read it in `workbook.ts` (with a Persian issue message for bad values), then run `npm run template` to regenerate `public/lubestation-data-template.xlsx`.
- Pages call `useDashboard()` and render `<DataState>` until `status === "ready"`. Handle empty sheets gracefully (show a muted "ثبت نشده" line, not a crash).
- Dates in the workbook are Jalali strings (`1405/07/11`) or Excel dates; store `Date` objects and compute "days ago/until" at render time — never store relative days.

## 3. Login gate pattern (`RequireRole`)

- Wrap the page element in `src/App.tsx`: `<RequireRole role="viewer">` (any signed-in user) or `role="admin"`. Mark the `Page` `noindex` and add the path to `public/robots.txt` Disallow.
- Protection is real on the server: `api/data.php` serves the workbook only to signed-in users, `api/users.php` only to admins. Any new protected data must go through the API the same way — never into `public/` or the JS bundle.
- **Only gate pages that actually need it.** A picker/listing page stays open.

## 4. API conventions (`public/api/`)

- Shared helpers in `_lib.php`; settings in `config.php`; data in `storage/` (web access denied by `.htaccess`). Files starting with `_` and `config.php` are denied by `api/.htaccess`.
- Every state-changing request is POST with header `X-Requested-With: lubestation` (`require_post()`); the client (`src/lib/api.ts`) always sends it.
- Errors are `{ "error": "<Persian message>" }` with a proper status; the UI shows the message as-is.
- Stay PHP 7.3 compatible (no `match`, `str_contains`, nullsafe, named args). Writes are atomic (`write_json_file`).
- Keep `dev/apiMock.ts` in sync with any API change — it is what local testing runs against.
- **Never write real passwords into committed files.** Use placeholders in docs.

## 5. Local-test-before-deploy workflow

1. In `web/`: `npm install`, then `npm run dev`, or `npm run build && npx vite preview` (production build with the production CSP header; `npm run build` also type-checks).
2. Drive it in a browser: first visit to a protected page shows the first-admin setup form (mock is in memory and resets on restart). For visual changes, look at a real screenshot before claiming success; check phone width (375px) for horizontal overflow.
3. For a numeric/geometric request ("10% smaller"), measure `getBoundingClientRect()` before and after.
4. Deploy: upload the contents of `dist/` (including hidden `.htaccess` files) to `public_html` on ParsPack. Never delete `public_html/api/storage/` on the host — it holds users and the uploaded data. Then verify on the live URL (and that `/api/storage/users.json` returns 403).

## 6. Shell gotcha

A literal `$$` inside a **double-quoted** bash string expands to the shell's PID. Single-quote literal values that might contain `$`, and verify request bodies before sending.
