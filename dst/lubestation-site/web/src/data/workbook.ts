import { parseDateCell, toAsciiDigits } from "../lib/jalali";
import { readXlsx, type Cell, type Sheet } from "../lib/xlsx";
import { SETTING_KEYS, SHEETS, titleKey } from "./schema";
import { mapPosition, type Station } from "./stations";

export type Severity = "ok" | "warn" | "crit";

export const SEVERITY_LABEL: Record<Severity, string> = { ok: "سالم", warn: "نیازمند بازدید", crit: "فوری" };

export interface Ticket {
  title: string;
  detail: string;
  severity: Exclude<Severity, "ok">;
}

export interface SiteEquipment {
  site: string;
  connected: boolean;
  technician: string;
  equipment: { name: string; severity: Severity; label: string }[];
}

export interface ServiceRow {
  equipment: string;
  site: string;
  last: Date | null;
  next: Date | null;
}

export interface WeekPoint {
  label: string;
  liters: number;
}

/** Last refill of a tank and the date the next one is due (refill + the dealer's cycle). */
export interface ChargeCycle {
  last: Date;
  due: Date;
  days: number;
}

/** A dealer's bulk-oil tank (rows of the "نمایندگی‌ها" sheet). */
export interface DealerTank {
  name: string;
  city: string;
  cap: number;
  inv: number;
  /** Set when the inventory comes from the dispenser's sales file (see tankLog.ts). */
  log?: { tank: string; updatedAt: string; charge: ChargeCycle | null };
}

/** One dispensing event at a dealer (rows of the "برداشت‌ها" sheet, or of the dispenser's sales file). */
export interface Withdrawal {
  dealer: string;
  at: Date;
  liters: number;
  device: string;
  /** Code the dispenser recorded with the sale. */
  code?: string;
}

export interface Issue {
  level: "error" | "warning";
  message: string;
}

export interface DashboardData {
  stations: Station[];
  weekly: WeekPoint[];
  tickets: Ticket[];
  sites: SiteEquipment[];
  services: ServiceRow[];
  parts: { name: string; qty: number }[];
  dealers: DealerTank[];
  /** Sorted oldest first. */
  withdrawals: Withdrawal[];
  settings: { leadDays: number; avgResolutionDays: number | null };
  issues: Issue[];
}

const DEFAULT_LEAD_DAYS = 21;

type SheetDef = { name: string; columns: Record<string, string> };

/** Row accessor keyed by schema column ids, plus the 1-based Excel row number for messages. */
type Row<K extends string> = { get: (col: K) => Cell; line: number };

function readSheet<K extends string>(
  book: Map<string, Sheet>,
  def: { name: string; columns: Record<K, string> },
  issues: Issue[],
  required: NoInfer<K>[],
): Row<K>[] | null {
  const want = titleKey(def.name);
  const entry = [...book.entries()].find(([name]) => titleKey(name) === want);
  if (!entry) return null;
  const rows = entry[1];

  const headerAt = rows.findIndex((r) => r.some((c) => c != null && String(c).trim() !== ""));
  if (headerAt < 0) return [];
  const header = rows[headerAt].map((c) => (c == null ? "" : titleKey(String(c))));
  const index = {} as Record<K, number>;
  for (const [id, title] of Object.entries(def.columns) as [K, string][]) index[id] = header.indexOf(titleKey(title));

  const missing = required.filter((id) => index[id] < 0);
  if (missing.length) {
    const cols = missing.map((id) => `«${(def.columns as Record<K, string>)[id]}»`).join("، ");
    issues.push({ level: "error", message: `برگه «${def.name}»: ستون ${cols} پیدا نشد.` });
    return [];
  }

  const out: Row<K>[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some((c) => c != null && String(c).trim() !== "")) continue;
    out.push({ get: (col) => (index[col] >= 0 ? (r[index[col]] ?? null) : null), line: i + 1 });
  }
  return out;
}

const text = (c: Cell) => (c == null ? "" : String(c).trim());

function num(c: Cell, issues: Issue[], where: string): number | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") return c;
  const n = Number(toAsciiDigits(String(c)).replace(/[,٬،\s]/g, "").replace("٫", "."));
  if (Number.isFinite(n)) return n;
  issues.push({ level: "warning", message: `${where}: «${c}» عدد نیست و صفر در نظر گرفته شد.` });
  return null;
}

function date(c: Cell, issues: Issue[], where: string): Date | null {
  if (c == null || c === "") return null;
  const d = parseDateCell(c);
  if (!d) issues.push({ level: "warning", message: `${where}: تاریخ «${c}» قابل خواندن نیست (نمونهٔ درست: ۱۴۰۵/۰۷/۱۱).` });
  return d;
}

/** "14:30", "14:30:05", or an Excel time (fraction of a day, possibly with a date part). */
function timeOfDay(c: Cell): [number, number] | null {
  if (typeof c === "number" && Number.isFinite(c)) {
    const minutes = Math.round((c - Math.floor(c)) * 1440) % 1440;
    return [Math.floor(minutes / 60), minutes % 60];
  }
  const m = toAsciiDigits(text(c)).match(/^(\d{1,2})[:٫.](\d{2})/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return [Number(m[1]), Number(m[2])];
}

function severity(c: Cell): Severity {
  const t = titleKey(text(c));
  if (t.includes("فوری") || t.includes("بحرانی") || t === "crit") return "crit";
  if (t.includes("بازدید") || t.includes("هشدار") || t === "warn") return "warn";
  return "ok";
}

const yes = (c: Cell, noWords: string[]) => !noWords.some((w) => titleKey(text(c)).includes(w));

export function parseWorkbookSheets(book: Map<string, Sheet>): DashboardData {
  const issues: Issue[] = [];
  const S = SHEETS;
  const missingSheet = (def: SheetDef) => issues.push({ level: "warning", message: `برگه «${def.name}» در فایل نیست؛ این بخش خالی نمایش داده می‌شود.` });

  // Settings first: the lead time feeds station status.
  const settings = { leadDays: DEFAULT_LEAD_DAYS, avgResolutionDays: null as number | null };
  const settingRows = readSheet(book, S.settings, issues, ["key", "value"]);
  if (settingRows) {
    for (const r of settingRows) {
      const key = titleKey(text(r.get("key")));
      const where = `برگه «${S.settings.name}» ردیف ${r.line}`;
      if (key === titleKey(SETTING_KEYS.leadDays)) settings.leadDays = num(r.get("value"), issues, where) ?? DEFAULT_LEAD_DAYS;
      else if (key === titleKey(SETTING_KEYS.avgResolutionDays)) settings.avgResolutionDays = num(r.get("value"), issues, where);
    }
  }

  const stations: Station[] = [];
  const stationRows = readSheet(book, S.stations, issues, ["name", "cap"]);
  if (!stationRows) issues.push({ level: "error", message: `برگه «${S.stations.name}» در فایل نیست.` });
  for (const r of stationRows ?? []) {
    const where = `برگه «${S.stations.name}» ردیف ${r.line}`;
    const name = text(r.get("name"));
    if (!name) {
      issues.push({ level: "warning", message: `${where}: نام جایگاه خالی است؛ این ردیف نادیده گرفته شد.` });
      continue;
    }
    const cap = num(r.get("cap"), issues, where) ?? 0;
    const inv = num(r.get("inv"), issues, where) ?? 0;
    if (cap <= 0) issues.push({ level: "warning", message: `${where}: ظرفیت مخزن «${name}» وارد نشده است.` });
    if (cap > 0 && inv > cap) issues.push({ level: "warning", message: `${where}: موجودی «${name}» از ظرفیت مخزن بیشتر است.` });
    const city = text(r.get("city"));
    stations.push({
      name,
      city,
      address: text(r.get("address")),
      real: !titleKey(text(r.get("kind"))).includes("نمونه"),
      cap,
      inv,
      weekly: num(r.get("weekly"), issues, where) ?? 0,
      alarms: num(r.get("alarms"), issues, where) ?? 0,
      pos: mapPosition(num(r.get("lat"), issues, where), num(r.get("lon"), issues, where), city),
      maint: {
        last: date(r.get("lastService"), issues, where),
        next: date(r.get("nextService"), issues, where),
        open: num(r.get("openMaint"), issues, where) ?? 0,
        note: text(r.get("maintNote")),
      },
    });
  }
  if (stationRows && !stations.length) issues.push({ level: "error", message: `برگه «${S.stations.name}» هیچ جایگاهی ندارد.` });

  const weeklyRows = readSheet(book, S.weekly, issues, ["liters"]);
  if (!weeklyRows) missingSheet(S.weekly);
  const weekly = (weeklyRows ?? []).map((r, i) => ({
    label: text(r.get("week")) || `هفته ${i + 1}`,
    liters: num(r.get("liters"), issues, `برگه «${S.weekly.name}» ردیف ${r.line}`) ?? 0,
  }));

  const ticketRows = readSheet(book, S.tickets, issues, ["title"]);
  if (!ticketRows) missingSheet(S.tickets);
  const tickets: Ticket[] = (ticketRows ?? [])
    .filter((r) => text(r.get("title")))
    .map((r): Ticket => {
      const sev = severity(r.get("severity"));
      return { title: text(r.get("title")), detail: text(r.get("detail")), severity: sev === "crit" ? "crit" : "warn" };
    })
    // Most urgent first.
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "crit" ? -1 : 1));

  const equipmentRows = readSheet(book, S.equipment, issues, ["site", "name"]);
  if (!equipmentRows) missingSheet(S.equipment);
  const sites: SiteEquipment[] = [];
  for (const r of equipmentRows ?? []) {
    const siteName = text(r.get("site"));
    const name = text(r.get("name"));
    if (!siteName || !name) continue;
    let site = sites.find((s) => s.site === siteName);
    if (!site) {
      const tech = [text(r.get("technician")), text(r.get("phone"))].filter(Boolean).join(" — ");
      site = { site: siteName, connected: yes(r.get("connection"), ["قطع", "خیر", "no"]), technician: tech, equipment: [] };
      sites.push(site);
    }
    const sev = severity(r.get("severity"));
    site.equipment.push({ name, severity: sev, label: text(r.get("label")) || SEVERITY_LABEL[sev] });
  }

  const serviceRows = readSheet(book, S.services, issues, ["equipment"]);
  if (!serviceRows) missingSheet(S.services);
  const services = (serviceRows ?? [])
    .filter((r) => text(r.get("equipment")))
    .map((r) => {
      const where = `برگه «${S.services.name}» ردیف ${r.line}`;
      return { equipment: text(r.get("equipment")), site: text(r.get("site")), last: date(r.get("last"), issues, where), next: date(r.get("next"), issues, where) };
    });

  const partRows = readSheet(book, S.parts, issues, ["name"]);
  if (!partRows) missingSheet(S.parts);
  const parts = (partRows ?? [])
    .filter((r) => text(r.get("name")))
    .map((r) => ({ name: text(r.get("name")), qty: num(r.get("qty"), issues, `برگه «${S.parts.name}» ردیف ${r.line}`) ?? 0 }));

  const dealerRows = readSheet(book, S.dealers, issues, ["name"]);
  if (!dealerRows) missingSheet(S.dealers);
  const dealers = (dealerRows ?? [])
    .filter((r) => text(r.get("name")))
    .map((r) => {
      const where = `برگه «${S.dealers.name}» ردیف ${r.line}`;
      return { name: text(r.get("name")), city: text(r.get("city")), cap: num(r.get("cap"), issues, where) ?? 0, inv: num(r.get("inv"), issues, where) ?? 0 };
    });

  const withdrawalRows = readSheet(book, S.withdrawals, issues, ["dealer", "date", "liters"]);
  if (!withdrawalRows) missingSheet(S.withdrawals);
  const withdrawals: Withdrawal[] = [];
  let badDates = 0;
  for (const r of withdrawalRows ?? []) {
    const dealer = text(r.get("dealer"));
    if (!dealer) continue;
    const day = parseDateCell(r.get("date"));
    if (!day) {
      badDates++;
      continue;
    }
    // A date cell holding an Excel date+time also carries the time when the time column is empty.
    const hm = timeOfDay(r.get("time")) ?? (typeof r.get("date") === "number" ? timeOfDay(r.get("date")) : null) ?? [0, 0];
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hm[0], hm[1]);
    withdrawals.push({ dealer, at, liters: num(r.get("liters"), issues, `برگه «${S.withdrawals.name}» ردیف ${r.line}`) ?? 0, device: text(r.get("device")) });
  }
  // One summary line instead of hundreds when a whole column is in the wrong format.
  if (badDates) issues.push({ level: "warning", message: `برگه «${S.withdrawals.name}»: تاریخ ${badDates} ردیف قابل خواندن نیست و آن ردیف‌ها نادیده گرفته شدند (نمونهٔ درست: ۱۴۰۵/۰۷/۱۱).` });
  withdrawals.sort((a, b) => a.at.getTime() - b.at.getTime());

  return { stations, weekly, tickets, sites, services, parts, dealers, withdrawals, settings, issues };
}

/** Data when no Excel file has been uploaded yet (only the dispenser files feed the site). */
export function emptyData(): DashboardData {
  return {
    stations: [],
    weekly: [],
    tickets: [],
    sites: [],
    services: [],
    parts: [],
    dealers: [],
    withdrawals: [],
    settings: { leadDays: DEFAULT_LEAD_DAYS, avgResolutionDays: null },
    issues: [{ level: "warning", message: "هنوز فایل اکسل بارگذاری نشده است؛ فقط داده‌های فایل‌های دستگاه نمایش داده می‌شود." }],
  };
}

/** Reads and validates the data workbook. Throws XlsxError when the file is not a readable xlsx. */
export async function parseWorkbook(buf: ArrayBuffer): Promise<DashboardData> {
  return parseWorkbookSheets(await readXlsx(buf));
}
