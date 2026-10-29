# LUBESTATION web app

The DST / LUBESTATION site for **lubestation.ir**: a React + Vite + TypeScript front end plus a
small PHP API, built to run on ordinary shared hosting (ParsPack, cPanel/DirectAdmin, Apache or
LiteSpeed, PHP 7.3+). No database and no foreign services: data comes from an Excel file.

## How data flows

1. An admin uploads the data workbook (`.xlsx`) on `/admin`, **or** sets an online address the
   server downloads it from (cached for `cache_minutes`).
2. `api/data.php` hands the file only to signed-in users.
3. The browser parses it (`src/lib/xlsx.ts`, no library) and maps the sheets to the dashboards
   (`src/data/workbook.ts`). Sheet and column titles live in `src/data/schema.ts`.

The template with every sheet and sample rows is `public/lubestation-data-template.xlsx`; it is
generated from the schema by `npm run template` (Node 23+). Change the schema, then regenerate.

## Run locally

```bash
cd web
npm install
npm run dev        # dev server with hot reload
npm run build      # type-check + production build into dist/
npx vite preview   # serve the production build (with the production CSP header)
```

Locally, `dev/apiMock.ts` stands in for the PHP API (in memory, starts with no users and the
sample template as data), so every page works without PHP.

## Pages

| URL | Page | Access |
|---|---|---|
| `/` | Home — scroll-driven 3D particle hero | public |
| `/partner-ecosystem` | Dealer picker | public |
| `/scheme-overview` | Bulk-oil scheme overview | public |
| `/core-operations` | DST company & products | public |
| `/corporate-governance` | Senior-management tank dashboard | signed in |
| `/technical-support` | Maintenance & support | signed in |
| `/admin` | Data file, online source, users, own password | admin |

Old addresses (`/#/…` and `*.html`) redirect to these.

## Users

Access is set per user and per page on `/admin`: management dashboard, technical support and
system admin (which implies all pages); public pages are open to everyone. The server sends each
user only the workbook sheets their pages need, so e.g. technician details never reach a
dashboard-only user (needs the ZipArchive and DOM PHP extensions, standard on shared hosts). On a fresh install the
first visit to a protected page shows a form that creates the first admin; later users are
added on `/admin`. Accounts live in `api/storage/users.json` (bcrypt hashes); sessions are
HttpOnly, SameSite=Strict cookies. Logins are throttled (8 failures → 15 minutes).

## Deploy to the ParsPack host

1. `npm run build`.
2. Upload **the contents of `dist/`** (including the hidden `.htaccess` files) to `public_html`.
3. Make sure `public_html/api/storage` is writable by PHP (usually 755 is enough).
4. Open `https://lubestation.ir/admin` and create the first admin account.
5. Check that `https://lubestation.ir/api/storage/users.json` and `/api/_lib.php` return 403/404
   (if they don't, the host ignores `.htaccess`: move `storage_dir` outside `public_html`).
6. Once the SSL certificate is active, uncomment the HTTPS redirect and HSTS lines in
   `public/.htaccess`, rebuild and re-upload `.htaccess`.

`api/config.php` holds the server settings (online source, cache time, size limit, session
length, storage folder). Re-uploading the site never touches `api/storage/` because the build
contains only its `.htaccess` — but do not delete that folder on the host, it holds the users and
the uploaded file.

## Layout

- `src/pages/` — one component + CSS module per page
- `src/components/` — shared UI (`RequireRole` login gate, `DataState`, dashboard panels)
- `src/data/` — workbook schema, parser, station logic, `useDashboard` loader
- `src/lib/` — API client, auth context, xlsx reader, Jalali dates, formatting
- `src/three/` — three.js scenes (home hero, dashboard background)
- `public/api/` — the PHP API; `public/.htaccess` — rewrites, security headers, caching
- `dev/apiMock.ts` — local stand-in for the API; `scripts/make-template.ts` — template generator
