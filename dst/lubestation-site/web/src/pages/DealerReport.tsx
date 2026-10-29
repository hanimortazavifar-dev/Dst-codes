import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import dstLogo from "../assets/dst-logo.webp";
import DataState from "../components/DataState";
import BarChart from "../components/governance/BarChart";
import { TankGauge } from "../components/governance/gauges";
import g from "../components/governance/Governance.module.css";
import { HomeIcon } from "../components/icons";
import { byHour, bySize, byWeekday, dailyAverage, DEALERS, inDays, monthly, sameDealer, weekly, type Dealer } from "../data/dealers";
import { useDashboard, type LoadedData } from "../data/useDashboard";
import type { Withdrawal } from "../data/workbook";
import { fa, prefersReducedMotion } from "../lib/format";
import { parseDateCell } from "../lib/jalali";
import { ROUTES } from "../routes";
import { startOrbitBackground } from "../three/orbitBackground";
import styles from "./DealerReport.module.css";

const faDec = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const whenFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long" });
const timeFormat = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false });
const longDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric" });
const inputDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" });

const zoneColor = (f: number) => (f < 0.25 ? "var(--red)" : f < 0.5 ? "var(--amber)" : "var(--green)");

/** Reference period for colouring "days left" (30 days = full ring). */
const RUNWAY_REF_DAYS = 30;

export default function DealerReport() {
  const { slug } = useParams();
  const dealer = DEALERS.find((d) => d.slug === slug);
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
            <p>گزارش مصرف روغن بالک{dealer ? ` — ${dealer.name}` : ""}</p>
          </div>
          <div className={g.toprow}>
            <Link className={g.homelink} to={ROUTES.home}>
              <HomeIcon />
              HOME
            </Link>
            <Link className={g.homelink} to={ROUTES.partners}>
              بازگشت به انتخاب نمایندگی
            </Link>
          </div>
        </header>

        {!dealer ? (
          <div className={g.state} role="alert">
            <p>این نمایندگی پیدا نشد.</p>
            <Link className={g.btn} to={ROUTES.partners}>
              انتخاب نمایندگی
            </Link>
          </div>
        ) : dashboard.status === "ready" ? (
          <Report dealer={dealer} data={dashboard.data} />
        ) : (
          <DataState state={dashboard} reload={dashboard.reload} classes={g} />
        )}
      </div>
    </div>
  );
}

function Report({ dealer, data }: { dealer: Dealer; data: LoadedData }) {
  const ws = useMemo(() => data.withdrawals.filter((w) => sameDealer(w.dealer, dealer.name)), [data.withdrawals, dealer.name]);
  const tank = data.dealers.find((d) => sameDealer(d.name, dealer.name));

  return (
    <>
      {data.stale && <div className={g.notice}>منبع آنلاین داده در دسترس نبود؛ آخرین نسخهٔ دریافت‌شده نمایش داده می‌شود.</div>}
      {ws.length > 0 && (
        <p className={styles.span}>
          داده‌ها از {longDate.format(ws[0].at)} تا {longDate.format(ws[ws.length - 1].at)}؛ {fa(ws.length)} برداشت ثبت‌شده
        </p>
      )}

      <div className={g.fourgrid}>
        <div className={g.p4}>
          <h2 className={`${g.h} ${g.hSmall}`}>موجودی فعلی مخزن</h2>
          {tank && tank.cap > 0 ? (
            <div className={g.gaugewrap}>
              <TankGauge inventory={tank.inv} capacity={tank.cap} />
              <div className={g.gval}>
                {fa(tank.inv)} <small>لیتر</small>
              </div>
              <div className={g.gpct}>
                {fa((tank.inv / tank.cap) * 100)}٪ از ظرفیت {fa(tank.cap)} لیتری
              </div>
            </div>
          ) : (
            <p className={g.empty}>ظرفیت و موجودی مخزن این نمایندگی در برگهٔ «نمایندگی‌ها» ثبت نشده است.</p>
          )}
        </div>
        <Runway ws={ws} inv={tank?.inv ?? null} cap={tank?.cap ?? 0} />
      </div>

      <ControlPanel />
      <RangeTable ws={ws} />

      <div className={g.fourgrid}>
        <div className={g.p4}>
          <h3 className={`${g.h} ${g.hSmall}`}>مصرف ماهانه (لیتر)</h3>
          <BarChart data={monthly(ws)} label="مصرف ماهانه" highlightLast />
        </div>
        <div className={g.p4}>
          <h3 className={`${g.h} ${g.hSmall}`}>مصرف هفتگی (لیتر)</h3>
          <BarChart data={weekly(ws)} label="مصرف هفتگی" highlightLast labelEvery={2} />
        </div>
        <div className={g.p4}>
          <h3 className={`${g.h} ${g.hSmall}`}>مصرف بر اساس روز هفته (لیتر)</h3>
          <BarChart data={byWeekday(ws)} label="مصرف بر اساس روز هفته" />
        </div>
        <div className={g.p4}>
          <h3 className={`${g.h} ${g.hSmall}`}>مصرف بر اساس ساعت (لیتر)</h3>
          <BarChart data={byHour(ws)} label="مصرف بر اساس ساعت" labelEvery={2} />
        </div>
      </div>
      <section className={g.panel}>
        <h3 className={`${g.h} ${g.hSmall}`}>تعداد برداشت بر اساس مقدار هر تزریق (لیتر)</h3>
        <div className={styles.wideChart}>
          <BarChart data={bySize(ws)} label="تعداد برداشت بر اساس مقدار هر تزریق" unit="برداشت" />
        </div>
      </section>
    </>
  );
}

function Ring({ fraction, color, value, caption }: { fraction: number; color: string; value: string; caption: string }) {
  const R = 46, C = 2 * Math.PI * R;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="11" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${C * f} ${C}`} transform="rotate(-90 60 60)" />
      </svg>
      <div className={styles.ringVal}>
        <b>{value}</b>
        <span>{caption}</span>
      </div>
    </div>
  );
}

/** Oil remaining (%) and estimated days left at the last 30 days' rate. */
function Runway({ ws, inv, cap }: { ws: Withdrawal[]; inv: number | null; cap: number }) {
  const daily = dailyAverage(ws);
  const pct = inv != null && cap > 0 ? inv / cap : null;
  const days = inv != null && daily > 0 ? inv / daily : null;
  return (
    <div className={g.p4}>
      <h2 className={`${g.h} ${g.hSmall}`}>وضعیت مصرف</h2>
      <div className={styles.rings}>
        <div>
          <h3>موجودی روغن</h3>
          {pct != null ? <Ring fraction={pct} color={zoneColor(pct)} value={fa(pct * 100)} caption="درصد باقیمانده" /> : <p className={g.empty}>ثبت نشده</p>}
        </div>
        <div>
          <h3>زمان باقیمانده</h3>
          {days != null ? (
            <Ring fraction={days / RUNWAY_REF_DAYS} color={zoneColor(days / RUNWAY_REF_DAYS)} value={fa(days)} caption="روز باقیمانده" />
          ) : (
            <p className={g.empty}>{inv == null ? "ثبت نشده" : "مصرفی در ۳۰ روز اخیر ثبت نشده"}</p>
          )}
        </div>
      </div>
      <div className={g.meta}>
        <div>
          میانگین مصرف روزانه (۳۰ روز اخیر): <b>{faDec.format(daily)} لیتر</b>
        </div>
        <div>
          میانگین مصرف هفتگی: <b>{fa(daily * 7)} لیتر</b>
        </div>
      </div>
    </div>
  );
}

// Laid out left to right like the device: 7 8 9 / 4 5 6 / 1 2 3 / C . Enter.
const KEYS = ["۷", "۸", "۹", "۴", "۵", "۶", "۱", "۲", "۳", "C", ".", "Enter"];

/**
 * Visual copy of the dispenser's injection panel. It is not connected to the device yet, so the
 * keypad only edits the number on screen and START/STOP send nothing.
 */
function ControlPanel() {
  const [locked, setLocked] = useState(true);
  const [entry, setEntry] = useState("");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");

  function press(k: string) {
    setNote("");
    if (k === "C") return setEntry("");
    if (k === "Enter") {
      setTarget(entry);
      return setEntry("");
    }
    if (k === "." && entry.includes(".")) return;
    if (entry.replace(".", "").length >= 4) return;
    setEntry(entry + (k === "." ? "." : String("۰۱۲۳۴۵۶۷۸۹".indexOf(k))));
  }

  const shown = (v: string) => (v ? v.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]).replace(".", "٫") : "۰۰");

  return (
    <section className={g.panel}>
      <h2 className={`${g.h} ${g.hSmall}`}>پنل کنترل تزریق اتوماتیک</h2>
      <div className={styles.panel}>
        <div className={styles.col}>
          <div className={styles.card}>
            <div className={`${styles.cardHead} ${styles.warnHead}`} aria-hidden="true">
              <svg width="28" height="25" viewBox="0 0 34 30">
                <path d="M17 2 L32 28 L2 28 Z" fill="#dc2626" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                <rect x="15.3" y="11" width="3.4" height="9" rx="1.5" fill="#fff" />
                <circle cx="17" cy="23" r="1.9" fill="#fff" />
              </svg>
            </div>
            <div className={styles.cardBody}>قفل سیستم: {locked ? "فعال" : "غیرفعال"}</div>
          </div>
          <div className={styles.pair}>
            <button type="button" className={`${styles.stop} ${locked ? styles.on : ""}`} aria-pressed={locked} onClick={() => setLocked(true)}>
              فعال
            </button>
            <button type="button" className={`${styles.start} ${!locked ? styles.on : ""}`} aria-pressed={!locked} onClick={() => setLocked(false)}>
              غیرفعال
            </button>
          </div>
        </div>

        <div className={styles.keypad} dir="ltr">
          {KEYS.map((k) => (
            <button key={k} type="button" className={k === "Enter" ? styles.enter : k === "C" ? styles.clear : undefined} disabled={locked} onClick={() => press(k)}>
              {k}
            </button>
          ))}
        </div>

        <div className={styles.col}>
          <div className={styles.card}>
            <div className={styles.cardHead}>مقدار (لیتر)</div>
            <div className={`${styles.cardBody} ${styles.amount}`} dir="ltr">
              <span>{shown(entry)}</span>
              <em>/</em>
              <span>{shown(target)}</span>
            </div>
          </div>
          <div className={styles.pair}>
            <button type="button" className={styles.stop} onClick={() => setNote("این پنل هنوز به دستگاه وصل نیست؛ فرمان STOP ارسال نشد.")}>
              STOP
            </button>
            <button type="button" className={styles.start} disabled={locked || !target} onClick={() => setNote("این پنل هنوز به دستگاه وصل نیست؛ فرمان START ارسال نشد.")}>
              START
            </button>
          </div>
        </div>
      </div>
      <p className={styles.panelNote} role="status">
        {note || (locked ? "برای وارد کردن مقدار، قفل سیستم را غیرفعال کنید. این پنل فعلاً نمایشی است و به دستگاه فرمان نمی‌فرستد." : "مقدار را وارد کنید و Enter بزنید. این پنل فعلاً نمایشی است و به دستگاه فرمان نمی‌فرستد.")}
      </p>
    </section>
  );
}

const startOfToday = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};
const daysAgo = (n: number) => {
  const t = startOfToday();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - n);
};

const PRESETS = [
  { label: "امروز", back: 0 },
  { label: "دیروز و امروز", back: 1 },
  { label: "۷ روز گذشته", back: 6 },
];

function RangeTable({ ws }: { ws: Withdrawal[] }) {
  const [range, setRange] = useState<{ from: Date; to: Date; preset: number | null }>({ from: daysAgo(6), to: startOfToday(), preset: 6 });
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [error, setError] = useState("");

  const rows = useMemo(() => inDays(ws, range.from, range.to).reverse(), [ws, range]);
  const total = rows.reduce((a, w) => a + w.liters, 0);

  function preset(back: number) {
    setError("");
    setRange({ from: daysAgo(back), to: startOfToday(), preset: back });
  }

  function custom() {
    const from = parseDateCell(fromText);
    const to = parseDateCell(toText || fromText);
    if (!from || !to) return setError("تاریخ را به شکل ۱۴۰۵/۰۸/۰۱ وارد کنید.");
    if (from > to) return setError("تاریخ «از» باید قبل از «تا» باشد.");
    setError("");
    setRange({ from, to, preset: null });
  }

  return (
    <section className={g.panel}>
      <h2 className={`${g.h} ${g.hSmall}`}>برداشت‌های بازهٔ انتخابی</h2>
      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault();
          custom();
        }}
      >
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button key={p.back} type="button" className={range.preset === p.back ? styles.active : undefined} onClick={() => preset(p.back)}>
              {p.label}
            </button>
          ))}
        </div>
        <label>
          از
          <input type="text" inputMode="numeric" dir="ltr" placeholder={inputDate.format(daysAgo(6))} value={fromText} onChange={(e) => setFromText(e.target.value)} />
        </label>
        <label>
          تا
          <input type="text" inputMode="numeric" dir="ltr" placeholder={inputDate.format(startOfToday())} value={toText} onChange={(e) => setToText(e.target.value)} />
        </label>
        <button type="submit" className={styles.show}>
          نمایش
        </button>
      </form>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.sum}>
        <span>
          <b>{fa(rows.length)}</b> برداشت
        </span>
        <span>
          <b>{faDec.format(total)}</b> لیتر مجموع
        </span>
        <span className={styles.rangeLabel}>
          {longDate.format(range.from)}
          {range.to.getTime() !== range.from.getTime() && ` تا ${longDate.format(range.to)}`}
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>زمان</th>
              <th>مقدار (لیتر)</th>
              <th>دستگاه</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((w, i) => (
                <tr key={i}>
                  <td>
                    {whenFormat.format(w.at)} ساعت {timeFormat.format(w.at)}
                  </td>
                  <td>{faDec.format(w.liters)}</td>
                  <td>{w.device ? <span className={styles.device}>{w.device}</span> : "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className={styles.none}>
                  برداشتی در این بازه ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
