import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import dstLogo from "../assets/dst-logo.webp";
import DataState from "../components/DataState";
import g from "../components/governance/Governance.module.css";
import { HomeIcon, WrenchIcon } from "../components/icons";
import { useDashboard, type LoadedData } from "../data/useDashboard";
import { SEVERITY_LABEL, type Severity } from "../data/workbook";
import { fa, prefersReducedMotion } from "../lib/format";
import { daysFromToday, formatJalali } from "../lib/jalali";
import { ROUTES } from "../routes";
import { startOrbitBackground } from "../three/orbitBackground";
import styles from "./TechnicalSupport.module.css";

function Badge({ severity, label }: { severity: Severity; label?: string }) {
  return <span className={`${styles.badge} ${styles[severity]}`}>{label ?? SEVERITY_LABEL[severity]}</span>;
}

function ago(d: Date | null) {
  if (!d) return "—";
  const n = -daysFromToday(d);
  if (n <= 0) return "امروز";
  if (n < 60) return `${fa(n)} روز پیش`;
  return `${fa(n / 30)} ماه پیش`;
}

function until(d: Date | null): { text: string; overdue: boolean } {
  if (!d) return { text: "ثبت نشده", overdue: false };
  const n = daysFromToday(d);
  if (n < 0) return { text: `معوق (${formatJalali(d)})`, overdue: true };
  if (n === 0) return { text: "امروز", overdue: true };
  return { text: `${fa(n)} روز دیگر`, overdue: false };
}

/** Maintenance and support overview, in the management pages' dark/amber theme. */
export default function TechnicalSupport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dashboard = useDashboard();

  useEffect(() => {
    if (!canvasRef.current || prefersReducedMotion()) return;
    return startOrbitBackground(canvasRef.current);
  }, []);

  return (
    <div className={g.page} dir="rtl" lang="fa">
      <canvas ref={canvasRef} className={g.background} aria-hidden="true" />
      <div className={g.wrap}>
        <header className={g.top}>
          <img className={g.logo} src={dstLogo} alt="DST — Diesel Super Technology" />
          <div className={g.ttl}>
            <h1>LUBESTATION</h1>
            <p>پشتیبانی فنی — تعمیر و نگهداری</p>
          </div>
          <div className={g.toprow}>
            <Link className={g.homelink} to={ROUTES.home}>
              <HomeIcon />
              HOME
            </Link>
          </div>
        </header>

        {dashboard.status === "ready" ? <Support data={dashboard.data} /> : <DataState state={dashboard} reload={dashboard.reload} classes={g} />}
      </div>
    </div>
  );
}

function Support({ data }: { data: LoadedData }) {
  const { tickets, sites, services, parts, settings } = data;
  const equipment = sites.flatMap((s) => s.equipment);
  const health = equipment.length ? Math.round((equipment.filter((e) => e.severity === "ok").length / equipment.length) * 100) : null;
  const urgent = tickets.filter((t) => t.severity === "crit").length;
  const visit = tickets.filter((t) => t.severity === "warn").length;

  return (
    <>
      {data.stale && <div className={g.notice}>منبع آنلاین داده در دسترس نبود؛ آخرین نسخهٔ دریافت‌شده نمایش داده می‌شود.</div>}

      <section>
        <h2 className={g.h}>نمای کلی</h2>
        <div className={g.sum}>
          <div className={g.kpi}>
            <span>هشدار فوری</span>
            <b style={{ color: urgent ? "var(--red)" : "var(--fg)" }}>{fa(urgent)}</b>
          </div>
          <div className={g.kpi}>
            <span>نیازمند بازدید</span>
            <b style={{ color: visit ? "var(--amber)" : "var(--fg)" }}>{fa(visit)}</b>
          </div>
          <div className={g.kpi}>
            <span>سلامت کلی تجهیزات</span>
            <b style={{ color: "var(--green)" }}>{health == null ? "—" : `٪${fa(health)}`}</b>
          </div>
          <div className={g.kpi}>
            <span>میانگین زمان رفع مشکل</span>
            <b>
              {settings.avgResolutionDays == null ? "—" : new Intl.NumberFormat("fa-IR").format(settings.avgResolutionDays)} <small>روز</small>
            </b>
          </div>
        </div>
      </section>

      <section>
        <h2 className={g.h}>هشدارهای باز (اولویت‌بندی‌شده)</h2>
        <div className={g.panel}>
          {tickets.length ? (
            <div className={`${g.act} ${styles.tickets}`}>
              {tickets.map((t, i) => (
                <div key={`${t.title}-${i}`} className={`${g.ai} ${t.severity === "crit" ? g.red : g.warn}`}>
                  <span className={g.dot} />
                  <div className={styles.ticketText}>
                    <b>{t.title}</b>
                    {t.detail && <div className={g.sub}>{t.detail}</div>}
                  </div>
                  <Badge severity={t.severity} />
                </div>
              ))}
            </div>
          ) : (
            <p className={g.empty}>هشدار بازی ثبت نشده است.</p>
          )}
        </div>
      </section>

      {sites.length > 0 && (
        <section>
          <h2 className={g.h}>تجهیزات و وضعیت به تفکیک نمایندگی</h2>
          <div className={styles.sites}>
            {sites.map((s) => (
              <div key={s.site} className={`${g.p4} ${styles.site} ${s.connected ? "" : styles.offline}`}>
                <div className={g.hd}>
                  <span className={g.nm}>{s.site}</span>
                  <span className={`${g.chip} ${s.connected ? g.ok : g.alarm}`}>● {s.connected ? "متصل" : "قطع"}</span>
                </div>
                <ul>
                  {s.equipment.map((e, i) => (
                    <li key={`${e.name}-${i}`}>
                      <span>{e.name}</span>
                      <Badge severity={e.severity} label={e.label} />
                    </li>
                  ))}
                </ul>
                {s.technician && (
                  <div className={styles.contact}>
                    <WrenchIcon />
                    تکنسین محلی: {s.technician}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={styles.two}>
        <section>
          <h2 className={g.h}>تاریخچه سرویس</h2>
          <div className={g.p4}>
            {services.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>تجهیز</th>
                      <th>نمایندگی</th>
                      <th>آخرین سرویس</th>
                      <th>سرویس بعدی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((row, i) => {
                      const next = until(row.next);
                      return (
                        <tr key={i}>
                          <td>{row.equipment}</td>
                          <td>{row.site}</td>
                          <td>{ago(row.last)}</td>
                          <td>{next.overdue ? <b className={styles.red}>{next.text}</b> : next.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={g.empty}>سابقهٔ سرویسی ثبت نشده است.</p>
            )}
          </div>
        </section>
        <section>
          <h2 className={g.h}>موجودی قطعات یدکی</h2>
          <div className={g.p4}>
            {parts.length ? (
              <div>
                {parts.map((p, i) => (
                  <div key={`${p.name}-${i}`} className={styles.part}>
                    <span>{p.name}</span>
                    <span className={`${styles.qty} ${p.qty === 0 ? styles.red : ""}`}>{p.qty === 0 ? "ناموجود" : `${fa(p.qty)} عدد`}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={g.empty}>قطعه‌ای ثبت نشده است.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
