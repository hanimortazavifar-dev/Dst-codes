/**
 * Sales log exported by a tank's dispenser ("لیست فروش LUBESTATION"): a CSV (often UTF-16,
 * tab-separated) with a few title lines, then Time / Date / Liter / Code columns. One file per tank;
 * the server merges every upload into one history per dealer (api/logs.php).
 */
import { parseDateCell, toAsciiDigits } from "../lib/jalali";
import { dailyAverage, DEALERS, DEFAULT_CHARGE_CYCLE_DAYS, isDealer, weekly } from "./dealers";
import { titleKey } from "./schema";
import { mapPosition, type Station } from "./stations";
import type { ChargeCycle, DashboardData, DealerTank, Issue, Withdrawal } from "./workbook";

/** Code the dispenser writes for oil put into the tank (a refill; negative values correct it). */
export const CHARGE_CODE = "99999999";

/** Tank capacity used when the Excel file has no row for the dealer (catalogue: 6,000 L). */
const DEFAULT_CAP = 6000;

/** One log line as stored on the server: [yyyy-mm-dd, hh:mm:ss, litres, code]. */
export type LogRow = [string, string, number, string];

/** A dealer's merged history, as returned by api/logs.php. */
export interface TankLog {
  dealer: string;
  tank: string;
  updatedAt: string;
  uploadedBy: string;
  rows: LogRow[];
}

export interface ParsedLog {
  title: string;
  tank: string;
  rows: LogRow[];
  issues: Issue[];
}

function decode(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
  // UTF-16 without a byte-order mark: every other byte of the ASCII text is zero.
  if (b.length > 3 && b[1] === 0 && b[3] === 0) return new TextDecoder("utf-16le").decode(b);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return new TextDecoder("windows-1256").decode(b);
  }
}

const COLUMNS = {
  time: ["time", "ساعت", "زمان"],
  date: ["date", "تاریخ"],
  liters: ["liter", "liters", "litre", "لیتر", "مقدار"],
  code: ["code", "کد"],
} as const;

type Col = keyof typeof COLUMNS;

const pad = (n: number) => String(n).padStart(2, "0");

/** "06/13/2026" (month first, as the dispenser writes it), "13/06/2026", "2026-06-13" or a Jalali "1405/03/23". */
function isoDate(raw: string): string | null {
  const s = toAsciiDigits(raw.trim());
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (m > 12 && d <= 12) [m, d] = [d, m];
  } else if ((match = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 1700) {
      const g = parseDateCell(s);
      if (!g) return null;
      [y, m, d] = [g.getFullYear(), g.getMonth() + 1, g.getDate()];
    }
  } else return null;
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function clock(raw: string): string | null {
  const m = toAsciiDigits(raw.trim()).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[3] ?? 0) > 59) return null;
  return `${pad(Number(m[1]))}:${m[2]}:${m[3] ?? "00"}`;
}

function litres(raw: string): number | null {
  const s = toAsciiDigits(raw.trim()).replace(/[,٬\s]/g, "").replace("٫", ".");
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Reads a dispenser CSV. Never throws: problems come back as issues (an "error" means nothing usable). */
export function parseTankLog(buf: ArrayBuffer): ParsedLog {
  const issues: Issue[] = [];
  const lines = decode(buf).split(/\r\n|\n|\r/);
  const delimiter = (line: string) => (line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",");
  const cells = (line: string) => line.split(delimiter(line)).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());

  let headerAt = -1;
  const index = {} as Record<Col, number>;
  for (let i = 0; i < lines.length && headerAt < 0; i++) {
    const header = cells(lines[i]).map(titleKey);
    const found = (Object.keys(COLUMNS) as Col[]).every((col) => (index[col] = header.findIndex((h) => (COLUMNS[col] as readonly string[]).includes(h))) >= 0);
    if (found) headerAt = i;
  }
  const before = lines.slice(0, Math.max(headerAt, 0)).map((l) => cells(l).join(" ").trim()).filter(Boolean);
  const title = before[0] ?? "";
  const tank = before.find((l) => l.includes("مخزن")) ?? before[1] ?? "";
  if (headerAt < 0) {
    issues.push({ level: "error", message: "ستون‌های Time، Date، Liter و Code در فایل پیدا نشد. فایل باید خروجی فروش دستگاه باشد." });
    return { title, tank, rows: [], issues };
  }

  const rows: LogRow[] = [];
  const bad: number[] = [];
  for (let i = headerAt + 1; i < lines.length; i++) {
    const c = cells(lines[i]);
    if (!c.some(Boolean)) continue;
    const d = isoDate(c[index.date] ?? "");
    const t = clock(c[index.time] ?? "");
    const l = litres(c[index.liters] ?? "");
    const code = (c[index.code] ?? "").trim();
    if (!d || !t || l == null) {
      bad.push(i + 1);
      continue;
    }
    rows.push([d, t, l, code]);
  }
  if (bad.length) {
    const shown = bad.slice(0, 5).join("، ") + (bad.length > 5 ? "، …" : "");
    issues.push({ level: "warning", message: `${bad.length} ردیف قابل خواندن نبود و نادیده گرفته شد (سطر ${shown}).` });
  }
  if (!rows.length) issues.push({ level: "error", message: "فایل هیچ ردیف فروشی ندارد." });
  rows.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  return { title, tank, rows, issues };
}

export const isCharge = (r: LogRow) => r[3] === CHARGE_CODE;

export function rowDate(r: LogRow) {
  const [y, m, d] = r[0].split("-").map(Number);
  const [hh, mm, ss] = r[1].split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, ss || 0);
}

/** Totals shown before and after an upload. */
export function logSummary(rows: LogRow[]) {
  const sales = rows.filter((r) => !isCharge(r) && r[2] > 0);
  const charges = rows.filter(isCharge);
  return {
    sales: sales.length,
    salesLiters: sales.reduce((a, r) => a + r[2], 0),
    charges: charges.length,
    chargeLiters: charges.reduce((a, r) => a + r[2], 0),
    from: rows.length ? rowDate(rows[0]) : null,
    to: rows.length ? rowDate(rows[rows.length - 1]) : null,
  };
}

/**
 * Oil in the tank: everything charged since the first refill in the log, minus what was sold after
 * it. Null when the log has no refill yet (the starting level is unknown).
 */
export function inventoryFromLog(rows: LogRow[]): number | null {
  const first = rows.findIndex(isCharge);
  if (first < 0) return null;
  let inv = 0;
  for (const r of rows.slice(first)) inv += isCharge(r) ? r[2] : -Math.max(0, r[2]);
  return inv;
}

/** The last refill (a positive charge row) and when the next is due, `days` later (counted from its day). */
export function chargeCycle(rows: LogRow[], days: number): ChargeCycle | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!isCharge(rows[i]) || rows[i][2] <= 0) continue;
    const last = rowDate(rows[i]);
    return { last, due: new Date(last.getFullYear(), last.getMonth(), last.getDate() + days), days };
  }
  return null;
}

/**
 * Puts the dispenser logs into the dashboard data: a dealer with a log gets its sales from the log
 * (replacing the Excel "برداشت‌ها" rows for that dealer) and its inventory from the refills. The
 * management dashboard gets the same tank as a station (updating the Excel row of the same name),
 * and, when the Excel file has no weekly figures, weekly consumption summed from the logs.
 */
export function applyTankLogs(data: DashboardData, logs: TankLog[]): DashboardData {
  if (!logs.length) return data;
  let withdrawals = data.withdrawals;
  const dealers: DealerTank[] = [...data.dealers];
  const stations: Station[] = [...data.stations];
  const logSales: Withdrawal[] = [];
  const issues = [...data.issues];

  for (const log of logs) {
    const dealer = DEALERS.find((d) => d.slug === log.dealer);
    if (!dealer) continue;
    const sales: Withdrawal[] = log.rows
      .filter((r) => !isCharge(r) && r[2] > 0)
      .map((r) => ({ dealer: dealer.name, at: rowDate(r), liters: r[2], device: "", code: r[3] }));
    withdrawals = withdrawals.filter((w) => !isDealer(dealer, w.dealer)).concat(sales);
    logSales.push(...sales);

    const at = dealers.findIndex((d) => isDealer(dealer, d.name));
    const excel = at >= 0 ? dealers[at] : null;
    const cap = excel?.cap || DEFAULT_CAP;
    let inv = inventoryFromLog(log.rows);
    if (inv != null && inv < 0) {
      issues.push({ level: "warning", message: `${dealer.name}: موجودی محاسبه‌شده از فایل دستگاه منفی شد؛ شارژهای مخزن (کد ${CHARGE_CODE}) را بررسی کنید.` });
      inv = 0;
    } else if (inv != null && inv > cap) {
      issues.push({ level: "warning", message: `${dealer.name}: موجودی محاسبه‌شده از فایل دستگاه (${Math.round(inv)} لیتر) از ظرفیت مخزن (${cap} لیتر) بیشتر است.` });
    }
    inv ??= excel?.inv ?? null;
    if (inv == null) continue;
    const charge = chargeCycle(log.rows, dealer.chargeCycleDays ?? DEFAULT_CHARGE_CYCLE_DAYS);
    const tank: DealerTank = { name: dealer.name, city: excel?.city || dealer.city, cap, inv, log: { tank: log.tank, updatedAt: log.updatedAt, charge } };
    if (at >= 0) dealers[at] = tank;
    else dealers.push(tank);

    const weeklyLiters = Math.round(dailyAverage(sales) * 7);
    const s = stations.findIndex((st) => isDealer(dealer, st.name));
    if (s >= 0) {
      stations[s] = { ...stations[s], name: dealer.name, cap, inv, weekly: weeklyLiters, real: true, charge };
    } else {
      stations.push({
        name: dealer.name,
        city: tank.city,
        address: "",
        real: true,
        cap,
        inv,
        weekly: weeklyLiters,
        alarms: 0,
        pos: mapPosition(null, null, tank.city),
        maint: { last: null, next: null, open: 0, note: "" },
        charge,
      });
    }
  }

  const weeklySeries = data.weekly.length ? data.weekly : weekly(logSales).map((b) => ({ label: b.label, liters: Math.round(b.value) }));
  withdrawals = [...withdrawals].sort((a, b) => a.at.getTime() - b.at.getTime());
  return { ...data, withdrawals, dealers, stations, weekly: weeklySeries, issues };
}
