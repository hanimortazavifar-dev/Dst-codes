import { Link } from "react-router-dom";
import DataState from "../components/DataState";
import { ArrowIcon } from "../components/icons";
import { useDashboard, type LoadedData } from "../data/useDashboard";
import { SEVERITY_LABEL, type Severity } from "../data/workbook";
import { fa } from "../lib/format";
import { daysFromToday, formatJalali } from "../lib/jalali";
import { ROUTES } from "../routes";
import slate from "../styles/slate.module.css";
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

export default function TechnicalSupport() {
  const dashboard = useDashboard();

  return (
    <div className={slate.page} dir="rtl" lang="fa">
      <div className={styles.wrap}>
        <Link className={slate.back} to={ROUTES.home}>
          <ArrowIcon />
          بازگشت به صفحه اصلی
        </Link>
        <div className={slate.header}>
          <h1>پشتیبانی فنی — تعمیر و نگهداری</h1>
          <p>وضعیت تجهیزات، هشدارهای باز، تاریخچه سرویس و موجودی قطعات یدکی همه نمایندگی‌ها</p>
        </div>

        {dashboard.status === "ready" ? <Support data={dashboard.data} /> : <DataState state={dashboard} reload={dashboard.reload} classes={styles} />}
      </div>
    </div>
  );
}

function Support({ data }: { data: LoadedData }) {
  const { tickets, sites, services, parts, settings } = data;
  const equipment = sites.flatMap((s) => s.equipment);
  const health = equipment.length ? Math.round((equipment.filter((e) => e.severity === "ok").length / equipment.length) * 100) : null;
  const kpis: { value: string; label: string; tone?: "warn" | "good" }[] = [
    { value: fa(tickets.filter((t) => t.severity === "crit").length), label: "هشدار فوری", tone: "warn" },
    { value: fa(tickets.filter((t) => t.severity === "warn").length), label: "نیازمند بازدید" },
    { value: health == null ? "—" : `٪${fa(health)}`, label: "سلامت کلی تجهیزات", tone: "good" },
    { value: settings.avgResolutionDays == null ? "—" : `${new Intl.NumberFormat("fa-IR").format(settings.avgResolutionDays)} روز`, label: "میانگین زمان رفع مشکل" },
  ];

  return (
    <>
      {data.stale && <div className={styles.notice}>منبع آنلاین داده در دسترس نبود؛ آخرین نسخهٔ دریافت‌شده نمایش داده می‌شود.</div>}

      <div className={styles.kpis}>
        {kpis.map((k) => (
          <div key={k.label} className={`${styles.kpi} ${k.tone ? styles[k.tone] : ""}`}>
            <b>{k.value}</b>
            <span>{k.label}</span>
          </div>
        ))}
      </div>

      <section className={styles.sec}>
        <h2>هشدارهای باز (اولویت‌بندی‌شده)</h2>
        <div className={slate.card}>
          {tickets.length ? (
            <div className={styles.tickets}>
              {tickets.map((t, i) => (
                <div key={`${t.title}-${i}`} className={`${styles.ticket} ${styles[t.severity]}`}>
                  <div className={styles.ticketName}>
                    <b>{t.title}</b>
                    {t.detail && <span>{t.detail}</span>}
                  </div>
                  <Badge severity={t.severity} />
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.none}>هشدار بازی ثبت نشده است.</p>
          )}
        </div>
      </section>

      {sites.length > 0 && (
        <section className={styles.sec}>
          <h2>تجهیزات و وضعیت به تفکیک نمایندگی</h2>
          <div className={styles.sites}>
            {sites.map((s) => (
              <div key={s.site} className={`${slate.card} ${styles.site}`}>
                <h3>
                  {s.site}
                  <span className={`${styles.conn} ${s.connected ? styles.on : styles.off}`}>● {s.connected ? "متصل" : "قطع"}</span>
                </h3>
                <ul>
                  {s.equipment.map((e, i) => (
                    <li key={`${e.name}-${i}`}>
                      {e.name} <Badge severity={e.severity} label={e.label} />
                    </li>
                  ))}
                </ul>
                {s.technician && <div className={styles.contact}>تکنسین محلی: {s.technician}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={`${styles.two} ${styles.sec}`}>
        <div className={slate.card}>
          <h2 className={styles.cardTitle}>تاریخچه سرویس</h2>
          {services.length ? (
            <div className={styles.tableWrap}>
              <table>
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
            <p className={styles.none}>سابقهٔ سرویسی ثبت نشده است.</p>
          )}
        </div>
        <div className={slate.card}>
          <h2 className={styles.cardTitle}>موجودی قطعات یدکی</h2>
          {parts.length ? (
            parts.map((p, i) => (
              <div key={`${p.name}-${i}`} className={styles.part}>
                <span>{p.name}</span>
                <span className={`${styles.qty} ${p.qty === 0 ? styles.red : ""}`}>{fa(p.qty)} عدد</span>
              </div>
            ))
          ) : (
            <p className={styles.none}>قطعه‌ای ثبت نشده است.</p>
          )}
        </div>
      </div>
    </>
  );
}
