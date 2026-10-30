import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import dstLogo from "../assets/dst-logo.webp";
import DataState from "../components/DataState";
import styles from "../components/governance/Governance.module.css";
import { ActionList, KpiSummary, MapPanel, Ranking, StationCard, WeeklyChart } from "../components/governance/panels";
import { HomeIcon, UsersIcon } from "../components/icons";
import { stationStatus, STATUS_LABEL, type Station } from "../data/stations";
import { useDashboard, type LoadedData } from "../data/useDashboard";
import { useAuth } from "../lib/auth";
import { fa, prefersReducedMotion } from "../lib/format";
import { formatJalaliDateTime } from "../lib/jalali";
import { ROUTES } from "../routes";
import { startOrbitBackground } from "../three/orbitBackground";

const STATUS_RANK = { alarm: 0, warn: 1, ok: 2, idle: 3 } as const;

export default function CorporateGovernance() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dashboard = useDashboard();
  const { state: auth } = useAuth();
  const isAdmin = auth.status === "signedIn" && auth.profile.role === "admin";

  useEffect(() => {
    if (!canvasRef.current || prefersReducedMotion()) return;
    return startOrbitBackground(canvasRef.current);
  }, []);

  // LTR page flow, as in the original dashboard layout; Persian text still renders RTL inline.
  return (
    <div className={styles.page} dir="ltr" lang="fa">
      <canvas ref={canvasRef} className={styles.background} aria-hidden="true" />

      <div className={styles.wrap}>
        <header className={styles.top}>
          <img className={styles.logo} src={dstLogo} alt="DST — Diesel Super Technology" />
          <div className={styles.ttl}>
            <h1>LUBESTATION</h1>
            <p>مدیریت ارشد</p>
          </div>
          <div className={styles.toprow}>
            {isAdmin ? (
              <Link className={styles.homelink} to={ROUTES.admin}>
                <UsersIcon />
                مدیریت سامانه
              </Link>
            ) : (
              <span />
            )}
            <Link className={styles.homelink} to={ROUTES.home}>
              <HomeIcon />
              HOME
            </Link>
          </div>
        </header>

        {dashboard.status === "ready" ? (
          <Dashboard data={dashboard.data} isAdmin={isAdmin} />
        ) : (
          <DataState state={dashboard} reload={dashboard.reload} classes={styles} />
        )}
      </div>
    </div>
  );
}

function Dashboard({ data, isAdmin }: { data: LoadedData; isAdmin: boolean }) {
  const { stations, weekly, settings } = data;
  const lead = settings.leadDays;

  // Selector order: stations needing attention first, so a manager lands on what matters.
  const ordered = useMemo(
    () => stations.map((s, i) => ({ s, i })).sort((a, b) => STATUS_RANK[stationStatus(a.s, lead)] - STATUS_RANK[stationStatus(b.s, lead)]),
    [stations, lead],
  );
  const [selected, setSelected] = useState(ordered[0]?.i ?? 0);
  const station: Station | undefined = stations[selected];
  const errors = data.issues.filter((i) => i.level === "error").length;

  return (
    <>
      {data.stale && <div className={styles.notice}>منبع آنلاین داده در دسترس نبود؛ آخرین نسخهٔ دریافت‌شده نمایش داده می‌شود.</div>}
      {isAdmin && data.issues.length > 0 && (
        <div className={styles.notice}>
          فایل داده {errors ? `${fa(errors)} خطا و ` : ""}
          {fa(data.issues.length - errors)} هشدار دارد. <Link to={ROUTES.admin}>مشاهده در صفحهٔ مدیریت</Link>
        </div>
      )}

      <section>
        <h2 className={styles.h}>نمای کلی کشور</h2>
        <KpiSummary stations={stations} leadDays={lead} />
      </section>

      {station && (
        <section>
          <h2 className={styles.h}>جایگاه‌ها</h2>
          <div className={styles.selrow}>
            <label htmlFor="stsel">جایگاه موردنظر را انتخاب کنید:</label>
            <select id="stsel" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
              {ordered.map(({ s, i }) => (
                <option key={i} value={i}>
                  {s.name}
                  {s.real ? "" : " (نمونه)"} — {STATUS_LABEL[stationStatus(s, lead)]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fourgrid}>
            {/* Keyed by station so the gauge needle re-animates on every selection. */}
            <StationCard key={selected} station={station} leadDays={lead} />
            <MapPanel station={station} stations={stations} />
            <div className={styles.p4}>
              <h3 className={`${styles.h} ${styles.hSmall}`}>مصرف کل کشور (هفتگی، لیتر)</h3>
              <WeeklyChart weekly={weekly} />
            </div>
            <div className={styles.p4}>
              <h3 className={`${styles.h} ${styles.hSmall}`}>رتبه‌بندی جایگاه‌ها بر اساس مصرف هفتگی</h3>
              <Ranking stations={stations} />
            </div>
          </div>
        </section>
      )}

      <section className={styles.panel}>
        <h3 className={`${styles.h} ${styles.hSmall}`}>فهرست اقدام مدیریتی</h3>
        <ActionList stations={stations} leadDays={lead} />
      </section>

      <div className={styles.foot}>
        «روز تا اتمام» با نرخ مصرف هفتگی و «نقطه سفارش» با زمان تأمین {fa(lead)} روزه محاسبه می‌شود؛ برای جایگاه‌هایی که فایل دستگاه دارند، «روز تا شارژ بعدی» از آخرین شارژ مخزن شمرده می‌شود.
        {data.updatedAt && <> آخرین به‌روزرسانی داده‌ها: {formatJalaliDateTime(data.updatedAt)}.</>}
      </div>
    </>
  );
}
