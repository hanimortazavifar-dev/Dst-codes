/**
 * In-memory stand-in for public/api/*.php, used by `npm run dev` and `vite preview` so the site can
 * be exercised without PHP. Same endpoints, payloads and error shapes; nothing is persisted, and
 * it starts with no users (so the first-admin setup screen shows) and the sample template as data.
 * Production always uses the PHP files.
 */
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import type { Plugin } from "vite";

interface User {
  id: string;
  phone: string;
  name: string;
  role: "admin" | "viewer";
  password: string;
}

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function apiMock(templatePath: string): Plugin {
  const users: User[] = [];
  const sessions = new Map<string, string>();
  let data: { bytes: Buffer; updatedAt: string; uploadedBy: string } = { bytes: readFileSync(templatePath), updatedAt: new Date().toISOString(), uploadedBy: "نمونه" };
  let remote: { url: string; bytes: Buffer | null; fetchedAt: string | null } = { url: "", bytes: null, fetchedAt: null };

  const pub = (u: User) => ({ id: u.id, phone: u.phone, name: u.name, role: u.role });

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
    const needUser = (role: "viewer" | "admin" = "viewer") => {
      if (!me) return fail(res, "ابتدا وارد سامانه شوید.", 401), false;
      if (role === "admin" && me.role !== "admin") return fail(res, "شما مجوز این کار را ندارید.", 403), false;
      return true;
    };

    if (endpoint === "auth.php") {
      if (method === "GET") return json(res, { user: me ? pub(me) : null, setupNeeded: users.length === 0 });
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
        const u: User = { id: randomBytes(8).toString("hex"), phone: String(input.phone), name: String(input.name ?? ""), role: "admin", password: String(input.password) };
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
      const list = () => json(res, { users: users.map(pub) });
      if (method === "GET") return list();
      if (input.action === "create") {
        if (!/^09\d{9}$/.test(String(input.phone))) return fail(res, "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.");
        if (users.some((u) => u.phone === input.phone)) return fail(res, "کاربری با این شماره موبایل وجود دارد.", 409);
        if (String(input.password ?? "").length < 8) return fail(res, "رمز عبور باید دست‌کم ۸ کاراکتر باشد.");
        users.push({ id: randomBytes(8).toString("hex"), phone: String(input.phone), name: String(input.name ?? ""), role: input.role === "admin" ? "admin" : "viewer", password: String(input.password) });
        return list();
      }
      const u = users.find((x) => x.id === input.id);
      if (!u) return fail(res, "کاربر پیدا نشد.", 404);
      const admins = users.filter((x) => x.role === "admin").length;
      if (input.action === "update") {
        if (input.role && input.role !== "admin" && u.role === "admin" && admins <= 1) return fail(res, "سامانه باید دست‌کم یک مدیر داشته باشد.");
        if (input.role) u.role = input.role === "admin" ? "admin" : "viewer";
        if (input.password) u.password = String(input.password);
        return list();
      }
      if (input.action === "delete") {
        if (u.id === me!.id) return fail(res, "نمی‌توانید حساب خودتان را حذف کنید.");
        users.splice(users.indexOf(u), 1);
        return list();
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
        if (!needUser()) return;
        let stale = false;
        if (remote.url) stale = (await fetchRemote(remote.url)) !== null;
        const bytes = remote.url ? remote.bytes : data.bytes;
        if (!bytes) return fail(res, "فایل آنلاین هنوز دریافت نشده است.", 502);
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
