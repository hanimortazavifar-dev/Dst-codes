import iranMap from "../../assets/iran-map.webp";
import { daysLeft, fillPercent, reorderPoint, stationStatus, STATUS_LABEL, type Station } from "../../data/stations";
import type { WeekPoint } from "../../data/workbook";
import { fa } from "../../lib/format";
import { daysFromToday, formatJalali } from "../../lib/jalali";
import { WrenchIcon } from "../icons";
import { MiniGauge, TankGauge } from "./gauges";
import styles from "./Governance.module.css";

const SampleTag = ({ station }: { station: Station }) => (station.real ? null : <span className={styles.tagn}>نمونه</span>);

export function KpiSummary({ stations, leadDays }: { stations: Station[]; leadDays: number }) {
  // Totals cover real stations only: sample rows (نمونه) are placeholders, not tanks.
  const real = stations.filter((s) => s.real);
  const totalWeekly = real.reduce((a, s) => a + s.weekly, 0);
  const totalInv = real.reduce((a, s) => a + s.inv, 0);
  const totalCap = real.reduce((a, s) => a + s.cap, 0);
  const needCharge = stations.filter((s) => stationStatus(s, leadDays) === "warn").length;
  const realCount = real.length;
  const fillPct = totalCap ? Math.round((totalInv / totalCap) * 100) : 0;

  return (
    <div className={styles.sum}>
      <div className={styles.kpi}>
        <span>تعداد جایگاه</span>
        <b>
          {fa(stations.length)} <small>({fa(realCount)} واقعی)</small>
        </b>
      </div>
      <div className={styles.kpi}>
        <span>مصرف کل هفتگی</span>
        <b>
          {fa(totalWeekly)} <small>لیتر</small>
        </b>
      </div>
      <div className={styles.kpi}>
        <span>موجودی کل</span>
        <b>
          {fa(totalInv)} <small>از {fa(totalCap)}</small>
        </b>
      </div>
      <div className={styles.kpi}>
        <span>نیازمند شارژ</span>
        <b style={{ color: needCharge ? "var(--amber)" : "var(--fg)" }}>
          {fa(needCharge)} <small>جایگاه</small>
        </b>
      </div>
      <div className={`${styles.kpi} ${styles.kpiGauge}`}>
        <span>پرشدگی کل مخازن</span>
        <MiniGauge percent={fillPct} />
        <b>
          {fa(fillPct)}
          <small>٪</small>
        </b>
      </div>
    </div>
  );
}

/** "۱۴۰۵/۰۷/۱۱ (۱۸ روز پیش)" */
function relativeDate(d: Date) {
  const n = daysFromToday(d);
  const rel = n === 0 ? "امروز" : n < 0 ? `${fa(-n)} روز پیش` : `${fa(n)} روز دیگر`;
  return `${formatJalali(d)} (${rel})`;
}

export function StationCard({ station: s, leadDays }: { station: Station; leadDays: number }) {
  const status = stationStatus(s, leadDays);
  const remaining = daysLeft(s);
  const overdue = s.maint.next != null && daysFromToday(s.maint.next) < 0;

  return (
    <div className={`${styles.p4} ${styles.stcard} ${styles[status] ?? ""}`}>
      <div className={styles.hd}>
        <span className={styles.nm}>
          {s.name} <SampleTag station={s} />
          <small>{s.city}</small>
        </span>
        <span className={`${styles.chip} ${styles[status] ?? ""}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className={styles.gaugewrap}>
        <TankGauge inventory={s.inv} capacity={s.cap} />
        <div className={styles.gval}>
          {fa(s.inv)} <small>لیتر</small>
        </div>
        <div className={styles.gpct}>
          {fa(fillPercent(s))}٪ از ظرفیت {fa(s.cap)} لیتری
        </div>
      </div>

      <div className={styles.meta}>
        <div>
          مصرف هفتگی: <b>{fa(s.weekly)} لیتر</b>
        </div>
        <div>
          {s.charge ? "روز تا شارژ بعدی" : "روز تا اتمام"}: <b>{remaining != null ? `${fa(remaining)} روز` : "—"}</b>
        </div>
        {s.charge ? (
          <div>
            آخرین شارژ: <b>{formatJalali(s.charge.last)}</b> (دورهٔ {fa(s.charge.days)} روزه)
          </div>
        ) : (
          <div>
            نقطه سفارش (لید {fa(leadDays)} روزه): <b>{fa(reorderPoint(s, leadDays))} لیتر</b>
          </div>
        )}
        <div>
          هشدار فعال: <b style={{ color: s.alarms ? "var(--red)" : "var(--fg)" }}>{fa(s.alarms)}</b>
        </div>
      </div>

      <details className={styles.mnt}>
        <summary>
          <WrenchIcon />
          اطلاعات تعمیر و نگهداری
        </summary>
        <div className={styles.mntBody}>
          <div>
            آخرین سرویس: <b>{s.maint.last ? relativeDate(s.maint.last) : "—"}</b>
          </div>
          <div>
            سرویس بعدی: <b style={{ color: overdue ? "var(--red)" : "var(--fg)" }}>{s.maint.next ? relativeDate(s.maint.next) : "ثبت نشده"}</b>
          </div>
          <div>
            هشدار نگهداری باز: <b style={{ color: s.maint.open ? "var(--red)" : "var(--fg)" }}>{fa(s.maint.open)}</b>
          </div>
          {(s.maint.note || !s.real) && (
            <div className={styles.samplenote}>{s.maint.note || "این جایگاه هنوز نصب و برق‌دار نشده؛ داده‌ای برای تعمیر و نگهداری ثبت نشده است."}</div>
          )}
        </div>
      </details>
    </div>
  );
}

function MapPin({ station, active }: { station: Station; active: boolean }) {
  if (!station.pos) return null;
  const x = station.pos[0] * 100;
  const y = station.pos[1] * 100;
  if (!active) return <circle cx={x} cy={y} r="1.6" fill="#8a8482" stroke="#171415" strokeWidth=".4" />;
  return (
    <g>
      <circle className={styles.pinpulse} cx={x} cy={y} r="2.6" fill="var(--amber)" />
      <circle cx={x} cy={y} r="5" fill="none" stroke="var(--amber)" strokeWidth=".6" opacity=".55" />
      <circle cx={x} cy={y} r="2.6" fill="var(--amber)" stroke="#171415" strokeWidth=".6" />
      <text x={x} y={y - 6} textAnchor="middle" className={styles.mapLabel}>
        {station.city.split("·")[0].trim()}
      </text>
    </g>
  );
}

export function MapPanel({ station, stations }: { station: Station; stations: Station[] }) {
  return (
    <div className={`${styles.p4} ${styles.mapcard}`}>
      <h3 className={styles.h} style={{ fontSize: 13, margin: 0 }}>
        موقعیت جایگاه روی نقشه
      </h3>
      <div className={styles.mapWrap}>
        <img src={iranMap} alt="نقشهٔ ایران" loading="lazy" />
        <svg viewBox="0 0 100 100" role="img" aria-label={`موقعیت ${station.city} روی نقشهٔ ایران`}>
          {stations
            .filter((o) => o !== station)
            .map((o, i) => (
              <MapPin key={`${o.name}-${i}`} station={o} active={false} />
            ))}
          <MapPin station={station} active />
        </svg>
      </div>
      <div className={styles.mapnote}>
        نقطهٔ طلایی: {station.name} <SampleTag station={station} /> — {station.city}
        {!station.pos && " (محل این جایگاه مشخص نیست)"}
        <br />
        نقاط کم‌رنگ: سایر جایگاه‌ها · نقشه نمایشی و غیردقیق است
      </div>
    </div>
  );
}

/** Rounds up to 2, 5 or 10 × a power of ten, for a clean y-axis top. */
function niceTop(v: number) {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / mag;
  return (f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

/** Number of most recent weeks shown in the chart. */
const CHART_WEEKS = 10;

export function WeeklyChart({ weekly }: { weekly: WeekPoint[] }) {
  if (!weekly.length) return <p className={styles.empty}>هنوز داده‌ای برای مصرف هفتگی ثبت نشده است.</p>;
  const data = weekly.slice(-CHART_WEEKS);
  const W = 640, H = 250, PL = 48, PR = 12, PT = 14, PB = 38;
  const ymax = niceTop(Math.max(...data.map((d) => d.liters)));
  const bw = (W - PL - PR) / data.length;
  const y = (v: number) => PT + ((ymax - v) / ymax) * (H - PT - PB);

  return (
    <div>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="مصرف هفتگی کل کشور">
        {[0, 1, 2, 3, 4].map((t) => {
          const v = (ymax * t) / 4;
          return (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#3A3435" />
              <text x={PL - 8} y={y(v) + 4} textAnchor="end" fill="#A39B96" fontSize="11">
                {fa(v)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = PL + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const h = Math.max(0, (d.liters / ymax) * (H - PT - PB));
          const top = H - PB - h;
          const last = i === data.length - 1;
          return (
            <g key={i}>
              <rect x={x} y={top} width={w} height={h} rx="3" fill={last ? "#FDB913" : "#DDA73A"} opacity={last ? 1 : 0.8}>
                <title>{`${d.label}: ${fa(d.liters)} لیتر`}</title>
              </rect>
              {last && (
                <text x={x + w / 2} y={top - 6} textAnchor="middle" fill="#F3EFEA" fontSize="11" fontWeight="700">
                  {fa(d.liters)}
                </text>
              )}
              <text x={x + w / 2} y={H - PB + 16} textAnchor="middle" fill="#A39B96" fontSize="10.5">
                ه{fa(i + 1)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={styles.legend}>
        <span>
          <i style={{ background: "#FDB913" }} />
          آخرین هفته ({data[data.length - 1].label})
        </span>
        <span>روند {fa(data.length)} هفته اخیر (کل جایگاه‌ها)</span>
      </div>
    </div>
  );
}

export function Ranking({ stations }: { stations: Station[] }) {
  const sorted = [...stations].sort((a, b) => b.weekly - a.weekly);
  const max = sorted[0]?.weekly || 1;

  const row = (s: Station, i: number) => (
    <div key={`${s.name}-${i}`} className={styles.rk}>
      <span className={styles.rn}>{fa(i + 1)}</span>
      <div style={{ minWidth: 0 }}>
        <div className={styles.nm}>
          {s.name} <SampleTag station={s} />
        </div>
        <div className={styles.bar}>
          <i style={{ width: `${Math.round((s.weekly / max) * 100)}%` }} />
        </div>
      </div>
      <span className={styles.v}>{fa(s.weekly)} ل</span>
    </div>
  );

  const rest = sorted.slice(3);
  return (
    <div className={styles.rank}>
      {sorted.slice(0, 3).map(row)}
      {rest.length > 0 && (
        <details className={styles.more}>
          <summary>نمایش {fa(rest.length)} جایگاه دیگر</summary>
          <div className={styles.rank} style={{ marginTop: 10 }}>
            {rest.map((s, i) => row(s, i + 3))}
          </div>
        </details>
      )}
    </div>
  );
}

export function ActionList({ stations, leadDays }: { stations: Station[]; leadDays: number }) {
  const items: { tone: "red" | "warn"; title: string; sub: string }[] = [];
  for (const s of stations) {
    const status = stationStatus(s, leadDays);
    const sample = s.real ? "" : " (نمونه)";
    if (status === "alarm") {
      items.push({ tone: "red", title: s.name, sub: `${fa(s.alarms)} هشدار فعال — نیاز به بررسی${sample}` });
    } else if (status === "warn" && s.charge) {
      const remaining = daysLeft(s) ?? 0;
      const when = remaining > 0 ? `${fa(remaining)} روز تا موعد شارژ` : "موعد شارژ رسیده است";
      items.push({ tone: "warn", title: s.name, sub: `${when} (${fa(s.charge.days)} روز از شارژ ${formatJalali(s.charge.last)})${sample}` });
    } else if (status === "warn") {
      const remaining = daysLeft(s);
      const left = remaining != null ? ` — حدود ${fa(remaining)} روز تا اتمام` : "";
      items.push({ tone: "warn", title: s.name, sub: `موجودی زیر نقطه سفارش؛ با لید ${fa(leadDays)} روزه باید همین حالا سفارش ثبت شود${left}${sample}` });
    }
    if (s.maint.next && daysFromToday(s.maint.next) < 0) {
      items.push({ tone: "red", title: s.name, sub: `سرویس دوره‌ای از ${formatJalali(s.maint.next)} عقب افتاده است${sample}` });
    }
  }
  if (!items.length) items.push({ tone: "warn", title: "موردی برای اقدام فوری نیست", sub: "همهٔ جایگاه‌های فعال بالای نقطه سفارش‌اند و سرویس عقب‌افتاده‌ای ثبت نشده است." });

  return (
    <div className={styles.act}>
      {items.map((it, i) => (
        <div key={`${it.title}-${i}`} className={`${styles.ai} ${styles[it.tone]}`}>
          <span className={styles.dot} />
          <div>
            <b>{it.title}</b>
            <div className={styles.sub}>{it.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
