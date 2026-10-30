import { daysFromToday } from "../lib/jalali";
import type { ChargeCycle } from "./workbook";

/** Tank stations shown on the senior-management dashboard (rows of the "جایگاه‌ها" sheet). */
export interface Station {
  name: string;
  city: string;
  address: string;
  /** false for sample stations that are not installed/powered yet. */
  real: boolean;
  /** Tank capacity (L). */
  cap: number;
  /** Current inventory (L). */
  inv: number;
  /** Mean weekly consumption (L). */
  weekly: number;
  alarms: number;
  /** Normalized [x, y] position on the Iran province map image, or null when unknown. */
  pos: [number, number] | null;
  maint: { last: Date | null; next: Date | null; open: number; note: string };
  /** From the device file: "days left" counts down to the next planned refill instead of using consumption. */
  charge?: ChargeCycle | null;
}

/** A refill-cycle station needs charging once this few days are left. */
const CHARGE_WARN_DAYS = 5;

/** Whole days until the next planned refill (0 once it is due or overdue). */
export function daysToCharge(c: ChargeCycle) {
  return Math.max(0, daysFromToday(c.due));
}

export type StationStatus = "ok" | "warn" | "alarm" | "idle";

export const STATUS_LABEL: Record<StationStatus, string> = {
  ok: "عادی",
  warn: "نیاز به شارژ",
  alarm: "هشدار فعال",
  idle: "غیرفعال",
};

export const fillPercent = (s: Station) => (s.cap > 0 ? Math.max(0, Math.min(100, Math.round((s.inv / s.cap) * 100))) : 0);

const perDay = (s: Station) => s.weekly / 7;

export function daysLeft(s: Station): number | null {
  if (s.charge) return daysToCharge(s.charge);
  const rate = perDay(s);
  return rate > 0 ? Math.round(s.inv / rate) : null;
}

/** Reorder level (L): what the station burns during one supply lead time. */
export const reorderPoint = (s: Station, leadDays: number) => Math.round(perDay(s) * leadDays);

export function stationStatus(s: Station, leadDays: number): StationStatus {
  if (s.alarms > 0) return "alarm";
  if (s.real && s.charge) return daysToCharge(s.charge) <= CHARGE_WARN_DAYS ? "warn" : "ok";
  // Without consumption the reorder point is 0, and an empty tank would always read as "warn".
  if (!s.real || s.weekly <= 0) return "idle";
  if (s.inv <= reorderPoint(s, leadDays)) return "warn";
  return "ok";
}

/** Approximate map positions of province capitals, used when a row has no coordinates. */
const CITY_COORDS: Record<string, [number, number]> = {
  تهران: [35.69, 51.39], مشهد: [36.3, 59.6], اصفهان: [32.65, 51.67], شیراز: [29.59, 52.58], تبریز: [38.08, 46.29],
  کرج: [35.84, 50.94], اهواز: [31.32, 48.67], قم: [34.64, 50.88], کرمانشاه: [34.31, 47.07], ارومیه: [37.55, 45.08],
  رشت: [37.28, 49.58], زاهدان: [29.5, 60.86], کرمان: [30.28, 57.08], همدان: [34.8, 48.51], یزد: [31.9, 54.36],
  اردبیل: [38.25, 48.3], بندرعباس: [27.18, 56.27], اراک: [34.09, 49.69], زنجان: [36.68, 48.48], سنندج: [35.31, 47.0],
  قزوین: [36.27, 50.0], خرمآباد: [33.49, 48.36], گرگان: [36.84, 54.43], ساری: [36.56, 53.06], بیرجند: [32.87, 59.22],
  بجنورد: [37.47, 57.33], بوشهر: [28.97, 50.84], ایلام: [33.64, 46.42], شهرکرد: [32.33, 50.86], یاسوج: [30.67, 51.59],
  سمنان: [35.58, 53.39],
};

/** Lat/lon → position on the map image (linear fit to the map artwork; it is only illustrative). */
export function mapPosition(lat: number | null, lon: number | null, city: string): [number, number] | null {
  if (lat == null || lon == null) {
    const key = city.split("·")[0].replace(/[\s‌]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");
    const known = CITY_COORDS[key];
    if (!known) return null;
    [lat, lon] = known;
  }
  const x = 0.0507 * lon - 2.211;
  const y = 0.4317 - 0.06489 * (lat - 33.363);
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return [x, y];
}
