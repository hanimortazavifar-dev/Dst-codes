import { titleKey } from "./schema";
import type { Withdrawal } from "./workbook";

/** Dealers shown on the dealer-selection page; `name` matches the "نمایندگی" column of the workbook. */
export interface Dealer {
  slug: string;
  name: string;
  city: string;
  /** Days a refill is planned to last; "days left" counts down from the last refill in the device file. */
  chargeCycleDays?: number;
  /** Other names the same dealer has in the Excel file (rows under any of them belong to this dealer). */
  aliases?: string[];
}

/** Refill cycle for dealers without their own `chargeCycleDays`. */
export const DEFAULT_CHARGE_CYCLE_DAYS = 21;

export const DEALERS: Dealer[] = [
  // The slug stays as it was: the device-file history on the server is stored under it.
  { slug: "partak-isfahan", name: "پارتاک دیزل سپهر-اصفهان", city: "اصفهان", chargeCycleDays: 21, aliases: ["پارتاک دیزل سپهر", "پارتاک دیزل اصفهان"] },
  { slug: "aria-tehran", name: "آریا دیزل تهران", city: "تهران" },
  { slug: "kavian-tabriz", name: "کاویان روان تبریز", city: "تبریز" },
  { slug: "sepehr-shiraz", name: "سپهر لوب شیراز", city: "شیراز" },
];

export const sameDealer = (a: string, b: string) => titleKey(a) === titleKey(b);

/** Whether a name from the Excel file means this dealer (its name or one of its aliases). */
export const isDealer = (dealer: Dealer, name: string) => [dealer.name, ...(dealer.aliases ?? [])].some((n) => sameDealer(n, name));

export interface Bar {
  label: string;
  value: number;
  /** Tooltip text. */
  title?: string;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sum = (ws: Withdrawal[]) => ws.reduce((a, w) => a + w.liters, 0);

/** Withdrawals from the start of `from` to the end of `to` (inclusive days). */
export const inDays = (ws: Withdrawal[], from: Date, to: Date) => {
  const a = dayStart(from).getTime();
  const b = addDays(dayStart(to), 1).getTime();
  return ws.filter((w) => w.at.getTime() >= a && w.at.getTime() < b);
};

/** Mean daily consumption over the 30 days up to today (L/day). */
export function dailyAverage(ws: Withdrawal[], today = new Date()) {
  return sum(inDays(ws, addDays(today, -29), today)) / 30;
}

const persianNumeric = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric" });
const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long" });
const shortDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "2-digit", day: "2-digit" });

function jalaliParts(d: Date) {
  const parts = Object.fromEntries(persianNumeric.formatToParts(d).map((p) => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month) };
}

/** Litres per Jalali month, for the last `count` months that have any data span. */
export function monthly(ws: Withdrawal[], count = 12): Bar[] {
  const map = new Map<string, Bar>();
  for (const w of ws) {
    const { y, m } = jalaliParts(w.at);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const bar = map.get(key) ?? { label: monthName.format(w.at), value: 0, title: `${monthName.format(w.at)} ${new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(y)}` };
    bar.value += w.liters;
    map.set(key, bar);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-count).map(([, b]) => b);
}

/** Litres per week (Saturday to Friday) for the last `count` weeks up to today, empty weeks included. */
export function weekly(ws: Withdrawal[], count = 12, today = new Date()): Bar[] {
  const t = dayStart(today);
  const weekStart = addDays(t, -((t.getDay() + 1) % 7)); // Saturday
  const bars: Bar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const from = addDays(weekStart, -7 * i);
    const total = sum(inDays(ws, from, addDays(from, 6)));
    bars.push({ label: shortDate.format(from), value: total, title: `هفتهٔ ${shortDate.format(from)}` });
  }
  return bars;
}

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** Litres per day of the week, Saturday first. */
export function byWeekday(ws: Withdrawal[]): Bar[] {
  const totals = new Array(7).fill(0);
  for (const w of ws) totals[(w.at.getDay() + 1) % 7] += w.liters;
  return WEEKDAYS.map((label, i) => ({ label, value: totals[i] }));
}

/** Litres per hour of the working day: one bar per hour from `from` to `to`, both included. */
export function byHour(ws: Withdrawal[], from = 6, to = 20): Bar[] {
  const totals = new Array(to - from + 1).fill(0);
  for (const w of ws) {
    const h = w.at.getHours();
    if (h >= from && h <= to) totals[h - from] += w.liters;
  }
  const fa = new Intl.NumberFormat("fa-IR");
  return totals.map((value, i) => ({ label: fa.format(from + i), value, title: `ساعت ${fa.format(from + i)} تا ${fa.format(from + i + 1)}` }));
}

const BUCKETS: [number, number, string][] = [
  [0, 10, "تا ۱۰"],
  [10, 20, "۱۰–۲۰"],
  [20, 30, "۲۰–۳۰"],
  [30, 40, "۳۰–۴۰"],
  [40, 45, "۴۰–۴۵"],
  [45, 50.0001, "۴۵–۵۰"],
  [50.0001, Infinity, "بیش از ۵۰"],
];

/** Number of withdrawals per size band (L). The last band only shows when used. */
export function bySize(ws: Withdrawal[]): Bar[] {
  const bars = BUCKETS.map(([lo, hi, label]) => ({ label, value: ws.filter((w) => w.liters >= lo && w.liters < hi).length }));
  return bars[bars.length - 1].value ? bars : bars.slice(0, -1);
}
