import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import dstLogo from "../assets/dst-logo.webp";
import g from "../components/governance/Governance.module.css";
import { HomeIcon } from "../components/icons";
import { invalidateDashboard, useDashboard } from "../data/useDashboard";
import { parseWorkbook, type DashboardData, type Issue } from "../data/workbook";
import { ApiError, getJson, postForm, postJson } from "../lib/api";
import { isValidPhone, normalizePhone, ROLE_LABEL, useAuth, type Profile, type Role } from "../lib/auth";
import { fa } from "../lib/format";
import { formatJalaliDateTime } from "../lib/jalali";
import { XlsxError } from "../lib/xlsx";
import { ROUTES } from "../routes";
import styles from "./Admin.module.css";

const TEMPLATE_URL = `${import.meta.env.BASE_URL}lubestation-data-template.xlsx`;

interface Meta {
  source: "url" | "upload";
  url: string;
  updatedAt: string | null;
  uploadedBy: string | null;
  hasUpload: boolean;
  cacheMinutes: number;
}

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof XlsxError ? e.message : "خطای ناشناخته؛ دوباره تلاش کنید.");

function Feedback({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <div className={`${styles.msg} ${styles.bad}`} role="alert">{error}</div>;
  if (ok) return <div className={`${styles.msg} ${styles.good}`} role="status">{ok}</div>;
  return null;
}

function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return <p className={styles.okLine}>✓ فایل بدون خطا خوانده شد.</p>;
  return (
    <ul className={styles.issues}>
      {issues.map((i, n) => (
        <li key={n} className={i.level === "error" ? styles.bad : styles.warnText}>
          {i.level === "error" ? "خطا: " : "هشدار: "}
          {i.message}
        </li>
      ))}
    </ul>
  );
}

function summary(d: DashboardData) {
  return `${fa(d.stations.length)} جایگاه، ${fa(d.weekly.length)} هفته مصرف، ${fa(d.tickets.length)} هشدار، ${fa(d.sites.length)} نمایندگی، ${fa(d.services.length)} سرویس، ${fa(d.parts.length)} قطعه`;
}

export default function Admin() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState("");

  const loadMeta = useCallback(() => {
    getJson<Meta>("data.php?meta=1")
      .then((m) => {
        setMeta(m);
        setMetaError("");
      })
      .catch((e) => setMetaError(errorText(e)));
  }, []);
  useEffect(loadMeta, [loadMeta]);

  return (
    <div className={g.page} dir="rtl" lang="fa">
      <div className={g.wrap}>
        <header className={g.top}>
          <img className={g.logo} src={dstLogo} alt="DST — Diesel Super Technology" />
          <div className={g.ttl}>
            <h1>LUBESTATION</h1>
            <p>مدیریت سامانه</p>
          </div>
          <div className={g.toprow}>
            <Link className={g.homelink} to={ROUTES.governance}>
              داشبورد مدیریت ارشد
            </Link>
            <Link className={g.homelink} to={ROUTES.home}>
              <HomeIcon />
              HOME
            </Link>
          </div>
        </header>

        <DataSection meta={meta} metaError={metaError} onChanged={loadMeta} />
        <SourceSection meta={meta} onChanged={loadMeta} />
        <UsersSection />
        <PasswordSection />
      </div>
    </div>
  );
}

function DataSection({ meta, metaError, onChanged }: { meta: Meta | null; metaError: string; onChanged: () => void }) {
  const current = useDashboard();
  const [file, setFile] = useState<File | null>(null);
  const [checked, setChecked] = useState<DashboardData | null>(null);
  const [checkError, setCheckError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});

  async function choose(f: File | null) {
    setFile(f);
    setChecked(null);
    setCheckError("");
    setResult({});
    if (!f) return;
    try {
      setChecked(await parseWorkbook(await f.arrayBuffer()));
    } catch (e) {
      setCheckError(errorText(e));
    }
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setResult({});
    try {
      const form = new FormData();
      form.append("file", file);
      await postForm("data.php", form);
      invalidateDashboard();
      current.reload();
      onChanged();
      setResult({ ok: "فایل جدید روی سایت قرار گرفت و داشبوردها به‌روز شدند." });
      setFile(null);
      setChecked(null);
    } catch (e) {
      setResult({ error: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  const blocking = checked?.issues.some((i) => i.level === "error") ?? false;

  return (
    <section className={g.panel}>
      <h2 className={g.h}>فایل داده (اکسل)</h2>
      {metaError && <Feedback error={metaError} />}
      {meta && (
        <dl className={styles.facts}>
          <dt>منبع فعلی</dt>
          <dd>{meta.source === "url" ? `آدرس آنلاین (هر ${fa(meta.cacheMinutes)} دقیقه دوباره خوانده می‌شود)` : "فایل بارگذاری‌شده در همین سایت"}</dd>
          <dt>آخرین به‌روزرسانی</dt>
          <dd>{meta.updatedAt ? formatJalaliDateTime(new Date(meta.updatedAt)) : "—"}</dd>
          {meta.source === "upload" && (
            <>
              <dt>بارگذاری توسط</dt>
              <dd>{meta.uploadedBy ?? "—"}</dd>
            </>
          )}
        </dl>
      )}

      <h3 className={styles.sub}>وضعیت فایل فعلی</h3>
      {current.status === "loading" && <p className={styles.muted}>در حال بررسی…</p>}
      {(current.status === "empty" || current.status === "error") && <Feedback error={current.message} />}
      {current.status === "ready" && (
        <>
          <p className={styles.muted}>{summary(current.data)}</p>
          <IssueList issues={current.data.issues} />
        </>
      )}

      <h3 className={styles.sub}>بارگذاری فایل جدید</h3>
      <p className={styles.muted}>
        فایل را بر اساس <a href={TEMPLATE_URL} download>فایل نمونه (lubestation-data-template.xlsx)</a> پر کنید. قبل از بارگذاری، فایل همین‌جا بررسی می‌شود.
        {meta?.source === "url" && " توجه: تا وقتی آدرس آنلاین تنظیم است، سایت از آن آدرس می‌خواند نه از فایل بارگذاری‌شده."}
      </p>
      <input className={styles.file} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      {checkError && <Feedback error={checkError} />}
      {checked && (
        <div className={styles.check}>
          <p className={styles.muted}>{summary(checked)}</p>
          <IssueList issues={checked.issues} />
          <button type="button" className={g.btn} disabled={busy || blocking} onClick={upload}>
            {busy ? "در حال بارگذاری…" : "بارگذاری روی سایت"}
          </button>
          {blocking && <p className={styles.warnText}>ابتدا خطاهای فایل را برطرف کنید.</p>}
        </div>
      )}
      <Feedback {...result} />
    </section>
  );
}

function SourceSection({ meta, onChanged }: { meta: Meta | null; onChanged: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});

  useEffect(() => {
    if (meta) setUrl(meta.url);
  }, [meta]);

  async function save(value: string) {
    setBusy(true);
    setResult({});
    try {
      await postJson("data.php", { action: "source", url: value.trim() });
      setResult({ ok: value.trim() ? "آدرس ذخیره شد و فایل با موفقیت از آن دریافت شد." : "آدرس آنلاین حذف شد؛ سایت از فایل بارگذاری‌شده می‌خواند." });
      if (!value.trim()) setUrl("");
    } catch (e) {
      setResult({ error: errorText(e) });
    } finally {
      invalidateDashboard();
      onChanged();
      setBusy(false);
    }
  }

  return (
    <section className={g.panel}>
      <h2 className={g.h}>منبع آنلاین داده</h2>
      <p className={styles.muted}>
        اگر فایل اکسل جای دیگری (مثلاً فضای ابری یا سرور دیگر) قرار می‌گیرد، آدرس مستقیم فایل را اینجا وارد کنید. سرور سایت فایل را خودش دریافت می‌کند و فقط
        به کاربران واردشده نشان می‌دهد. برای استفاده از فایل بارگذاری‌شده، آدرس را خالی کنید.
      </p>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          save(url);
        }}
      >
        <input className={styles.input} type="url" dir="ltr" placeholder="https://example.com/data.xlsx" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="submit" className={g.btn} disabled={busy}>
          {busy ? "در حال بررسی…" : "ذخیره"}
        </button>
        {meta?.url && (
          <button type="button" className={`${g.btn} ${g.btnGhost}`} disabled={busy} onClick={() => save("")}>
            حذف آدرس
          </button>
        )}
      </form>
      <Feedback {...result} />
    </section>
  );
}

function UsersSection() {
  const { state } = useAuth();
  const me = state.status === "signedIn" ? state.profile : null;
  const [users, setUsers] = useState<Profile[]>([]);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});
  const [form, setForm] = useState({ name: "", phone: "", role: "viewer" as Role, password: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJson<{ users: Profile[] }>("users.php")
      .then((r) => setUsers(r.users))
      .catch((e) => setResult({ error: errorText(e) }));
  }, []);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setResult({});
    try {
      const r = await postJson<{ users: Profile[] }>("users.php", body);
      setUsers(r.users);
      setResult({ ok });
      return true;
    } catch (e) {
      setResult({ error: errorText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!isValidPhone(form.phone)) return setResult({ error: "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود." });
    if (form.password.length < 8) return setResult({ error: "رمز عبور باید دست‌کم ۸ کاراکتر باشد." });
    if (await act({ action: "create", ...form, phone: normalizePhone(form.phone) }, "کاربر ساخته شد.")) setForm({ name: "", phone: "", role: "viewer", password: "" });
  }

  function resetPassword(u: Profile) {
    const password = window.prompt(`رمز جدید برای ${u.name || u.phone} (دست‌کم ۸ کاراکتر):`);
    if (password == null) return;
    if (password.length < 8) return setResult({ error: "رمز عبور باید دست‌کم ۸ کاراکتر باشد." });
    act({ action: "update", id: u.id, password }, "رمز عبور تغییر کرد.");
  }

  function remove(u: Profile) {
    if (window.confirm(`کاربر «${u.name || u.phone}» حذف شود؟`)) act({ action: "delete", id: u.id }, "کاربر حذف شد.");
  }

  return (
    <section className={g.panel}>
      <h2 className={g.h}>کاربران</h2>
      <p className={styles.muted}>«کاربر» داشبوردها را می‌بیند. «مدیر سیستم» علاوه بر آن به همین صفحه (فایل داده و کاربران) دسترسی دارد.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>نام</th>
              <th>شماره موبایل</th>
              <th>نقش</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name || "—"}</td>
                <td dir="ltr">{u.phone}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={busy || u.id === me?.id}
                    aria-label={`نقش ${u.name || u.phone}`}
                    onChange={(e) => act({ action: "update", id: u.id, role: e.target.value }, "نقش کاربر تغییر کرد.")}
                  >
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={styles.actions}>
                  <button type="button" disabled={busy} onClick={() => resetPassword(u)}>
                    تغییر رمز
                  </button>
                  {u.id !== me?.id && (
                    <button type="button" disabled={busy} className={styles.danger} onClick={() => remove(u)}>
                      حذف
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={styles.sub}>افزودن کاربر</h3>
      <form className={styles.grid} onSubmit={create} noValidate>
        <input className={styles.input} placeholder="نام و نام خانوادگی" aria-label="نام و نام خانوادگی" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={styles.input} type="tel" inputMode="numeric" dir="ltr" placeholder="09xxxxxxxxx" aria-label="شماره موبایل" maxLength={11} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <select className={styles.input} aria-label="نقش" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <input className={styles.input} type="password" autoComplete="new-password" placeholder="رمز عبور (دست‌کم ۸ کاراکتر)" aria-label="رمز عبور" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit" className={g.btn} disabled={busy}>
          افزودن
        </button>
      </form>
      <Feedback {...result} />
    </section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setResult({ error: "رمز جدید باید دست‌کم ۸ کاراکتر باشد." });
    setBusy(true);
    setResult({});
    try {
      await postJson("auth.php", { action: "password", current, next });
      setResult({ ok: "رمز عبور شما تغییر کرد." });
      setCurrent("");
      setNext("");
    } catch (err) {
      setResult({ error: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={g.panel}>
      <h2 className={g.h}>تغییر رمز عبور من</h2>
      <form className={styles.grid} onSubmit={submit} noValidate>
        <input className={styles.input} type="password" autoComplete="current-password" placeholder="رمز فعلی" aria-label="رمز فعلی" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input className={styles.input} type="password" autoComplete="new-password" placeholder="رمز جدید" aria-label="رمز جدید" value={next} onChange={(e) => setNext(e.target.value)} />
        <button type="submit" className={g.btn} disabled={busy}>
          تغییر رمز
        </button>
      </form>
      <Feedback {...result} />
    </section>
  );
}
