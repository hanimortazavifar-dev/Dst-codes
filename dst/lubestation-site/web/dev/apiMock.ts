/**
 * In-memory stand-in for public/api/*.php, used by `npm run dev` and `vite preview` so the site can
 * be exercised without PHP. Same endpoints, payloads, access rules and error shapes; nothing is
 * persisted, and it starts with no users (so the first-admin setup screen shows) and the sample
 * template as data. Production always uses the PHP files.
 */
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { crc32, inflateRawSync } from "node:zlib";
import type { Plugin } from "vite";
import { titleKey } from "../src/data/schema.ts";

type Page = "home" | "partners" | "dealers" | "core" | "governance" | "support" | "admin";

interface User {
  id: string;
  phone: string;
  name: string;
  pages: Page[];
  password: string;
}

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PAGES: Page[] = ["home", "partners", "dealers", "core", "governance", "support", "admin"];
const DEFAULT_PUBLIC: Page[] = ["home", "partners", "core"];
// Keep in sync with LS_PAGE_SHEETS in public/api/_lib.php.
const PAGE_SHEETS: Record<"governance" | "support" | "dealers", string[]> = {
  governance: ["جایگاه‌ها", "مصرف هفتگی", "تنظیمات"],
  support: ["هشدارها", "تجهیزات", "سرویس‌ها", "قطعات یدکی", "تنظیمات"],
  dealers: ["نمایندگی‌ها", "برداشت‌ها", "تنظیمات"],
};

const cleanPages = (pages: unknown): Page[] => {
  const list = Array.isArray(pages) ? PAGES.filter((p) => pages.includes(p)) : [];
  return list.includes("admin") ? [...PAGES] : list;
};
const isAdmin = (u: User) => u.pages.includes("admin");

/** Reads every zip entry (xlsx files are small). */
function unzip(buf: Buffer) {
  const files = new Map<string, Buffer>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(raw) : raw);
  }
  return files;
}

/** Writes an uncompressed zip. */
function zipStore(files: Map<string, Buffer>) {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

/**
 * Drops the sheets a user's pages don't need from workbook.xml, as the PHP API does (the PHP
 * version also inlines shared strings so no text of removed sheets remains; dev data is not secret).
 */
function filterWorkbook(bytes: Buffer, keys: Set<string>) {
  const files = unzip(bytes);
  const wb = files.get("xl/workbook.xml")!.toString("utf8");
  const kept = wb.replace(/<(?:\w+:)?sheet\b[^>]*\bname="([^"]*)"[^>]*\/>/g, (tag, name: string) => {
    const decoded = name.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    return keys.has(titleKey(decoded)) ? tag : "";
  });
  files.set("xl/workbook.xml", Buffer.from(kept, "utf8"));
  return zipStore(files);
}

export function apiMock(templatePath: string): Plugin {
  const users: User[] = [];
  const sessions = new Map<string, string>();
  let publicPages: Page[] = [...DEFAULT_PUBLIC];
  const effectivePages = (u: User | null): Page[] => (u && isAdmin(u) ? [...PAGES] : PAGES.filter((p) => publicPages.includes(p) || !!u?.pages.includes(p)));
  let data: { bytes: Buffer; updatedAt: string; uploadedBy: string } = { bytes: readFileSync(templatePath), updatedAt: new Date().toISOString(), uploadedBy: "نمونه" };
  let remote: { url: string; bytes: Buffer | null; fetchedAt: string | null } = { url: "", bytes: null, fetchedAt: null };
  type LogRow = [string, string, number, string];
  const logs = new Map<string, { dealer: string; tank: string; updatedAt: string; uploadedBy: string; rows: LogRow[] }>();

  const pub = (u: User) => ({ id: u.id, phone: u.phone, name: u.name, role: isAdmin(u) ? "admin" : "viewer", pages: u.pages });

  async function body(req: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  }

  function json(res: ServerResponse, value: unknown, status = 200) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(value));
  }

  const fail = (res: ServerResponse, error: string, status = 400) => json(res, { error }, status);

  const sessionId = (req: IncomingMessage) => /(?:^|;\s*)ls_sid=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];

  function currentUser(req: IncomingMessage) {
    const sid = sessionId(req);
    const uid = sid ? sessions.get(sid) : undefined;
    return users.find((u) => u.id === uid) ?? null;
  }

  function signIn(res: ServerResponse, user: User) {
    const sid = randomBytes(16).toString("hex");
    sessions.set(sid, user.id);
    res.setHeader("Set-Cookie", `ls_sid=${sid}; Path=/; HttpOnly; SameSite=Strict`);
  }

  async function fetchRemote(url: string): Promise<string | null> {
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (!r.ok) return `دریافت فایل آنلاین ناموفق بود (${r.status}).`;
      const bytes = Buffer.from(await r.arrayBuffer());
      if (bytes.subarray(0, 4).toString("binary") !== "PK\x03\x04") return "فایل دریافت‌شده از آدرس آنلاین، فایل اکسل (xlsx) نیست. آدرس باید مستقیم به خود فایل باشد.";
      remote = { url, bytes, fetchedAt: new Date().toISOString() };
      return null;
    } catch {
      return "دریافت فایل آنلاین ناموفق بود.";
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const endpoint = url.pathname.replace(/^.*\/api\//, "");
    const method = req.method ?? "GET";
    const me = currentUser(req);
    let input: Record<string, unknown> = {};
    let raw: Buffer = Buffer.alloc(0);

    if (method === "POST") {
      if (req.headers["x-requested-with"] !== "lubestation") return fail(res, "درخواست نامعتبر است.", 403);
      raw = await body(req);
      if ((req.headers["content-type"] ?? "").startsWith("application/json")) input = JSON.parse(raw.toString("utf8") || "{}");
    }
    const needUser = (page: Page | "" = "") => {
      if (!me) return fail(res, "ابتدا وارد سامانه شوید.", 401), false;
      if (page && !me.pages.includes(page)) return fail(res, "شما مجوز این کار را ندارید.", 403), false;
      return true;
    };

    if (endpoint === "auth.php") {
      if (method === "GET") return json(res, { user: me ? pub(me) : null, setupNeeded: users.length === 0, publicPages });
      const { action } = input;
      if (action === "login") {
        const u = users.find((x) => x.phone === input.phone && x.password === input.password);
        if (!u) return fail(res, "شماره موبایل یا رمز عبور اشتباه است.", 401);
        signIn(res, u);
        return json(res, { user: pub(u) });
      }
      if (action === "logout") {
        sessions.delete(sessionId(req) ?? "");
        return json(res, { ok: true });
      }
      if (action === "setup") {
        if (users.length) return fail(res, "مدیر سامانه قبلاً ساخته شده است.", 409);
        if (!/^09\d{9}$/.test(String(input.phone))) return fail(res, "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.");
        if (String(input.password ?? "").length < 8) return fail(res, "رمز عبور باید دست‌کم ۸ کاراکتر باشد.");
        const u: User = { id: randomBytes(8).toString("hex"), phone: String(input.phone), name: String(input.name ?? ""), pages: [...PAGES], password: String(input.password) };
        users.push(u);
        signIn(res, u);
        return json(res, { user: pub(u) });
      }
      if (action === "password") {
        if (!needUser()) return;
        if (me!.password !== input.current) return fail(res, "رمز فعلی اشتباه است.");
        if (String(input.next ?? "").length < 8) return fail(res, "رمز عبور باید دست‌کم ۸ کاراکتر باشد.");
        me!.password = String(input.next);
        return json(res, { ok: true });
      }
    }

    if (endpoint === "users.php") {
      if (!needUser("admin")) return;
      const list = () => json(res, { users: users.map(pub), publicPages });
      if (method === "GET") return list();
      if (input.action === "public") {
        publicPages = cleanPages(Array.isArray(input.pages) ? input.pages.filter((p) => p !== "admin") : []).filter((p) => p !== "admin");
        return list();
      }
      if (input.action === "create") {
        if (!/^09\d{9}$/.test(String(input.phone))) return fail(res, "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.");
        if (users.some((u) => u.phone === input.phone)) return fail(res, "کاربری با این شماره موبایل وجود دارد.", 409);
        const pages = cleanPages(input.pages);
        if (!pages.length) return fail(res, "دست‌کم دسترسی به یک صفحه را انتخاب کنید.");
        if (String(input.password ?? "").length < 8) return fail(res, "رمز عبور باید دست‌کم ۸ کاراکتر باشد.");
        users.push({ id: randomBytes(8).toString("hex"), phone: String(input.phone), name: String(input.name ?? ""), pages, password: String(input.password) });
        return list();
      }
      const u = users.find((x) => x.id === input.id);
      if (!u) return fail(res, "کاربر پیدا نشد.", 404);
      const admins = users.filter(isAdmin).length;
      if (input.action === "update") {
        if (typeof input.name === "string") u.name = input.name.trim();
        if (input.pages !== undefined) {
          const pages = cleanPages(input.pages);
          const losesAdmin = isAdmin(u) && !pages.includes("admin");
          if (losesAdmin && u.id === me!.id) return fail(res, "نمی‌توانید دسترسی مدیریت را از حساب خودتان بردارید.");
          if (losesAdmin && admins <= 1) return fail(res, "سامانه باید دست‌کم یک مدیر داشته باشد.");
          u.pages = pages;
        }
        if (input.password) {
          if (String(input.password).length < 8) return fail(res, "رمز عبور باید دست‌کم ۸ کاراکتر باشد.");
          u.password = String(input.password);
        }
        return list();
      }
      if (input.action === "delete") {
        if (u.id === me!.id) return fail(res, "نمی‌توانید حساب خودتان را حذف کنید.");
        if (isAdmin(u) && admins <= 1) return fail(res, "سامانه باید دست‌کم یک مدیر داشته باشد.");
        users.splice(users.indexOf(u), 1);
        return list();
      }
    }

    if (endpoint === "logs.php") {
      if (method === "GET") {
        if (!effectivePages(me).some((p) => p === "dealers" || p === "governance")) return me ? fail(res, "شما به گزارش نمایندگی‌ها دسترسی ندارید.", 403) : fail(res, "ابتدا وارد سامانه شوید.", 401);
        return json(res, { logs: [...logs.values()] });
      }
      if (!needUser("admin")) return;
      const dealer = String(input.dealer ?? "");
      if (!/^[a-z0-9-]{1,40}$/.test(dealer)) return fail(res, "نمایندگی نامعتبر است.");
      if (input.action === "import") {
        const rows = input.rows;
        if (!Array.isArray(rows) || !rows.length) return fail(res, "فایل هیچ ردیف فروشی ندارد.");
        if (rows.length > 20000) return fail(res, "تعداد ردیف‌های فایل بیش از حد مجاز است.");
        const ok = (r: unknown): r is LogRow =>
          Array.isArray(r) && r.length === 4 && /^\d{4}-\d{2}-\d{2}$/.test(String(r[0])) && /^\d{2}:\d{2}:\d{2}$/.test(String(r[1])) && Number.isFinite(Number(r[2])) && typeof r[3] === "string" && r[3].length <= 32;
        if (!rows.every(ok)) return fail(res, "قالب ردیف‌های فایل نامعتبر است.");
        const old = logs.get(dealer);
        const merged = new Map<string, LogRow>();
        for (const r of [...(old?.rows ?? []), ...rows.map((r): LogRow => [r[0], r[1], Math.round(Number(r[2]) * 1000) / 1000, r[3].trim()])]) {
          merged.set(`${r[0]} ${r[1]}|${r[2].toFixed(3)}|${r[3]}`, r);
        }
        const sorted = [...merged.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, r]) => r);
        logs.set(dealer, { dealer, tank: String(input.tank ?? "").trim().slice(0, 80) || old?.tank || "", updatedAt: new Date().toISOString(), uploadedBy: me!.name || me!.phone, rows: sorted });
        return json(res, { added: sorted.length - (old?.rows.length ?? 0), total: sorted.length });
      }
      if (input.action === "clear") {
        logs.delete(dealer);
        return json(res, { ok: true });
      }
    }

    if (endpoint === "data.php") {
      if (method === "GET" && url.searchParams.has("meta")) {
        if (!needUser("admin")) return;
        return json(res, {
          source: remote.url ? "url" : "upload",
          url: remote.url,
          updatedAt: remote.url ? remote.fetchedAt : data.updatedAt,
          uploadedBy: data.uploadedBy,
          hasUpload: true,
          cacheMinutes: 10,
        });
      }
      if (method === "GET") {
        // Visitors get data only for data pages the admin made public.
        const pages = effectivePages(me);
        const allowed = (Object.keys(PAGE_SHEETS) as (keyof typeof PAGE_SHEETS)[]).filter((p) => pages.includes(p));
        if (!allowed.length) return me ? fail(res, "شما به هیچ صفحهٔ داده‌ای دسترسی ندارید.", 403) : fail(res, "ابتدا وارد سامانه شوید.", 401);
        let stale = false;
        if (remote.url) stale = (await fetchRemote(remote.url)) !== null;
        let bytes = remote.url ? remote.bytes : data.bytes;
        if (!bytes) return fail(res, "فایل آنلاین هنوز دریافت نشده است.", 502);
        if (allowed.length < Object.keys(PAGE_SHEETS).length) bytes = filterWorkbook(bytes, new Set(allowed.flatMap((p) => PAGE_SHEETS[p]).map(titleKey)));
        res.setHeader("Content-Type", XLSX_TYPE);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Data-Updated", (remote.url ? remote.fetchedAt : data.updatedAt) ?? "");
        res.setHeader("X-Data-Stale", stale ? "1" : "0");
        return res.end(bytes);
      }
      if (!needUser("admin")) return;
      if ((req.headers["content-type"] ?? "").startsWith("multipart/")) {
        const form = await new Request("http://localhost", { method: "POST", headers: { "content-type": req.headers["content-type"]! }, body: new Uint8Array(raw) }).formData();
        const file = form.get("file");
        if (!(file instanceof File)) return fail(res, "بارگذاری فایل انجام نشد.");
        const bytes = Buffer.from(await file.arrayBuffer());
        if (!/\.xlsx$/i.test(file.name) || bytes.subarray(0, 4).toString("binary") !== "PK\x03\x04") return fail(res, "فقط فایل اکسل با پسوند xlsx پذیرفته می‌شود.");
        data = { bytes, updatedAt: new Date().toISOString(), uploadedBy: me!.name || me!.phone };
        return json(res, { ok: true, updatedAt: data.updatedAt, uploadedBy: data.uploadedBy, size: bytes.length });
      }
      if (input.action === "source") {
        const next = String(input.url ?? "").trim();
        if (next && !/^https?:\/\/\S+$/i.test(next)) return fail(res, "آدرس باید با http:// یا https:// شروع شود.");
        remote = { url: next, bytes: null, fetchedAt: null };
        if (next) {
          const error = await fetchRemote(next);
          if (error) return fail(res, "آدرس ذخیره شد، اما " + error, 502);
        }
        return json(res, { ok: true });
      }
    }

    return fail(res, "درخواست نامعتبر است.");
  }

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!/\/api\/[^/]+\.php$/.test((req.url ?? "").split("?")[0])) return next();
    handle(req, res).catch((e) => fail(res, `mock error: ${e}`, 500));
  };

  return {
    name: "lubestation-api-mock",
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}
