/** Jalali (Persian) calendar helpers for dates typed into the Excel file. */

const div = (a: number, b: number) => Math.trunc(a / b);

/** Jalali y/m/d → Gregorian [y, m (1-12), d]. */
export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  jy += 1595;
  let days = -355668 + 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && gd > monthDays[gm]) gd -= monthDays[gm++];
  return [gy, gm + 1, gd];
}

/** Converts Persian/Arabic digits to ASCII. */
export const toAsciiDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** Local midnight of a calendar day. */
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

/**
 * Reads a date cell: a "1405/07/11" Jalali string (or "2026-10-03" Gregorian), or an Excel date
 * serial number. Returns null when empty or unreadable.
 */
export function parseDateCell(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Excel serial: days since 1899-12-30 (accounts for Excel's 1900 leap-year bug).
    const ms = Math.round((value - 25569) * 86400000);
    const d = new Date(ms);
    return day(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const m = toAsciiDigits(value.trim()).match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (y < 1700) {
    const [gy, gm, gd] = jalaliToGregorian(y, mo, d);
    return day(gy, gm, gd);
  }
  return day(y, mo, d);
}

const jalaliFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" });
const jalaliLong = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "long", timeStyle: "short" });

export const formatJalali = (d: Date) => jalaliFormat.format(d);
export const formatJalaliDateTime = (d: Date) => jalaliLong.format(d);

/** Whole days from today to `d` (negative = in the past). */
export function daysFromToday(d: Date, today = new Date()) {
  const t = day(today.getFullYear(), today.getMonth() + 1, today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
