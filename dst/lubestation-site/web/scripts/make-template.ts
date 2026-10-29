/**
 * Builds public/lubestation-data-template.xlsx: the data workbook with every sheet, its column
 * headers (from src/data/schema.ts) and sample rows. Run with `npm run template` (Node 23+).
 */
import { writeFileSync } from "node:fs";
import { deflateRawSync, crc32 } from "node:zlib";
import { SETTING_KEYS, SHEETS } from "../src/data/schema.ts";

type Value = string | number | null;
interface SheetSpec {
  name: string;
  headers: readonly string[];
  rows: Value[][];
  /** Column widths (characters). */
  widths?: number[];
  /** Columns (0-based) formatted as text so "1405/07/11" stays as typed. */
  textCols?: number[];
}

const st = SHEETS.stations.columns;
const eq = SHEETS.equipment.columns;

/** Gregorian → Jalali "YYYY/MM/DD" (same algorithm as src/lib/jalali.ts, reversed). */
function jalali(d: Date) {
  const gy = d.getFullYear(), gm = d.getMonth() + 1, gd = d.getDate();
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.trunc((gy2 + 3) / 4) - Math.trunc((gy2 + 99) / 100) + Math.trunc((gy2 + 399) / 400) + gd + gdm[gm - 1];
  let jy = -1595 + 33 * Math.trunc(days / 12053);
  days %= 12053;
  jy += 4 * Math.trunc(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.trunc((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.trunc(days / 31) : 7 + Math.trunc((days - 186) / 30);
  const jd = days < 186 ? 1 + (days % 31) : 1 + ((days - 186) % 30);
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

/**
 * Sample dispensing log for the Partak dealer: eight weeks up to 28 Oct 2026, no Fridays, a few
 * injections a day from two devices. Deterministic so the template doesn't change between runs.
 */
function sampleWithdrawals(): Value[][] {
  let seed = 20261028;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const rows: Value[][] = [];
  const end = new Date(2026, 9, 28);
  for (let back = 55; back >= 0; back--) {
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - back);
    if (day.getDay() === 5) continue; // Friday
    const count = 1 + Math.floor(rnd() * 5);
    const times = Array.from({ length: count }, () => 7 * 60 + Math.floor(rnd() * 11 * 60)).sort((a, b) => a - b);
    for (const t of times) {
      const liters = Math.round((8 + rnd() * 42) * 10) / 10;
      const time = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
      rows.push(["پارتاک دیزل اصفهان", jalali(day), time, liters, rnd() < 0.55 ? "DST1" : "DST2"]);
    }
  }
  return rows;
}

const sheets: SheetSpec[] = [
  {
    name: "راهنما",
    headers: ["راهنمای پر کردن فایل داده LUBESTATION"],
    widths: [110],
    rows: [
      ["هر برگه یک بخش از سایت است. نام برگه‌ها و عنوان ستون‌ها را تغییر ندهید؛ ترتیب ستون‌ها مهم نیست."],
      ["ردیف اول هر برگه عنوان ستون‌هاست. داده‌ها را از ردیف دوم وارد کنید. ردیف‌های نمونه را با داده‌های واقعی جایگزین کنید."],
      ["تاریخ‌ها را شمسی و به شکل ۱۴۰۵/۰۷/۱۱ بنویسید (تاریخ میلادی اکسل هم پذیرفته می‌شود)."],
      ["اعداد را بدون واحد بنویسید (مثلاً 6000 نه «۶۰۰۰ لیتر»). ارقام فارسی هم خوانده می‌شوند."],
      ["برگهٔ «جایگاه‌ها»: «نوع» را «واقعی» یا «نمونه» بنویسید. جایگاه نمونه یا بدون مصرف، «غیرفعال» نمایش داده می‌شود."],
      ["محل جایگاه روی نقشه: اگر عرض و طول جغرافیایی خالی باشد، از روی نام مرکز استان در ستون «شهر» تعیین می‌شود."],
      ["وضعیت تجهیزات: «سالم»، «نیازمند بازدید» یا «فوری». اولویت هشدارها: «فوری» یا «نیازمند بازدید»."],
      ["برگهٔ «برداشت‌ها»: هر ردیف یک برداشت (تزریق) روغن در یک نمایندگی است. ساعت را به شکل 14:30 بنویسید. نام نمایندگی باید با برگهٔ «نمایندگی‌ها» یکی باشد."],
      ["برگهٔ «نمایندگی‌ها»: ظرفیت و موجودی فعلی مخزن هر نمایندگی برای صفحهٔ «گزارش نمایندگی»."],
      ["این برگه (راهنما) توسط سایت خوانده نمی‌شود."],
    ],
  },
  {
    name: SHEETS.stations.name,
    headers: Object.values(st),
    widths: [24, 22, 26, 16, 18, 18, 24, 18, 18, 18, 24, 48, 16, 16],
    textCols: [8, 9],
    rows: [
      ["پارتاک دیزل سپهر", "اصفهان · خ امیرکبیر", "اصفهان، خیابان امیرکبیر", "واقعی", 6000, 6000, 768, 0, "1405/07/11", null, 0, "قطع کلید فشار به دلیل خطای فشار بالا؛ سرویس بعدی هنوز زمان‌بندی نشده.", null, null],
      ["جایگاه نمونه مرکزی", "تهران", "", "نمونه", 4000, 0, 0, 0, null, null, 0, "", null, null],
      ["جایگاه نمونه شرق", "مشهد", "", "نمونه", 4000, 0, 0, 0, null, null, 0, "", null, null],
      ["جایگاه نمونه جنوب", "بندرعباس", "", "نمونه", 4000, 0, 0, 0, null, null, 0, "", null, null],
      ["جایگاه نمونه غرب", "تبریز", "", "نمونه", 4000, 0, 0, 0, null, null, 0, "", null, null],
      ["جایگاه نمونه معدن", "کرمان · مجتمع معدنی", "", "نمونه", 4000, 0, 0, 0, null, null, 0, "", null, null],
    ],
  },
  {
    name: SHEETS.weekly.name,
    headers: Object.values(SHEETS.weekly.columns),
    widths: [22, 18],
    textCols: [0],
    rows: [
      ["1405/04/06", 1226], ["1405/04/13", 710], ["1405/04/20", 892], ["1405/04/27", 1664], ["1405/05/03", 1127],
      ["1405/05/10", 504], ["1405/05/17", 58], ["1405/05/24", 878], ["1405/05/31", 84], ["1405/06/07", 85],
    ],
  },
  {
    name: SHEETS.tickets.name,
    headers: Object.values(SHEETS.tickets.columns),
    widths: [36, 50, 26],
    rows: [
      ["واحد ارتباطی — سپهر لوب شیراز", "قطع ارتباط از ۲ روز پیش · بدون داده موجودی مخزن", "فوری"],
      ["پمپ انتقال — آریا دیزل تهران", "فشار غیرعادی گزارش شده · ریسک توقف انتقال", "فوری"],
      ["سنسور سطح مخزن — کاویان روان تبریز", "نوسان غیرعادی در قرائت، نیازمند کالیبراسیون", "نیازمند بازدید"],
    ],
  },
  {
    name: SHEETS.equipment.name,
    headers: Object.values(eq),
    widths: [22, 20, 26, 16, 16, 18, 18],
    textCols: [6],
    rows: [
      ...["سنسور سطح مخزن", "پمپ انتقال", "واحد ارتباطی", "شیر کنترل"].map((e) => ["پارتاک دیزل اصفهان", e, "سالم", "", "متصل", "رضا کریمی", "09130000000"]),
      ...["سنسور سطح مخزن", "پمپ انتقال", "واحد ارتباطی", "شیر کنترل"].map((e) => ["آریا دیزل تهران", e, e === "پمپ انتقال" ? "فوری" : "سالم", "", "متصل", "حسین محمدی", "09120000000"]),
      ...["سنسور سطح مخزن", "پمپ انتقال", "واحد ارتباطی", "شیر کنترل"].map((e) => ["کاویان روان تبریز", e, e === "سنسور سطح مخزن" ? "نیازمند بازدید" : "سالم", "", "متصل", "علی احمدی", "09140000000"]),
      ...["سنسور سطح مخزن", "پمپ انتقال", "واحد ارتباطی", "شیر کنترل"].map((e) => ["سپهر لوب شیراز", e, "فوری", e === "واحد ارتباطی" ? "قطع" : "نامشخص", "قطع", "امیر رستمی", "09170000000"]),
    ],
  },
  {
    name: SHEETS.services.name,
    headers: Object.values(SHEETS.services.columns),
    widths: [20, 18, 20, 20],
    textCols: [2, 3],
    rows: [
      ["سنسور سطح مخزن", "اصفهان", "1405/07/25", "1405/09/25"],
      ["پمپ انتقال", "تهران", "1405/05/07", "1405/08/07"],
      ["شیر کنترل", "تبریز", "1405/06/07", "1405/08/22"],
      ["واحد ارتباطی", "شیراز", "1405/03/07", "1405/07/01"],
    ],
  },
  {
    name: SHEETS.parts.name,
    headers: Object.values(SHEETS.parts.columns),
    widths: [26, 14],
    rows: [["سنسور سطح مخزن", 4], ["پمپ انتقال", 1], ["واحد ارتباطی (مودم)", 0], ["شیر کنترل", 3]],
  },
  {
    name: SHEETS.dealers.name,
    headers: Object.values(SHEETS.dealers.columns),
    widths: [24, 14, 20, 20],
    rows: [
      ["پارتاک دیزل اصفهان", "اصفهان", 6000, 4210],
      ["آریا دیزل تهران", "تهران", 4000, 0],
      ["کاویان روان تبریز", "تبریز", 4000, 0],
      ["سپهر لوب شیراز", "شیراز", 4000, 0],
    ],
  },
  {
    name: SHEETS.withdrawals.name,
    headers: Object.values(SHEETS.withdrawals.columns),
    widths: [24, 14, 10, 14, 10],
    textCols: [1, 2],
    rows: sampleWithdrawals(),
  },
  {
    name: SHEETS.settings.name,
    headers: Object.values(SHEETS.settings.columns),
    widths: [34, 14],
    rows: [[SETTING_KEYS.leadDays, 21], [SETTING_KEYS.avgResolutionDays, 3.2]],
  },
];

// --- xlsx writing ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));

function cell(ref: string, v: Value, style: number) {
  const s = style ? ` s="${style}"` : "";
  if (v == null || v === "") return style ? `<c r="${ref}"${s}/>` : "";
  if (typeof v === "number") return `<c r="${ref}"${s}><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function sheetXml(spec: SheetSpec) {
  const text = new Set(spec.textCols ?? []);
  const cols = spec.headers
    .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${spec.widths?.[i] ?? 18}" customWidth="1"${text.has(i) ? ' style="2"' : ""}/>`)
    .join("");
  const rows = [
    `<row r="1">${spec.headers.map((h, i) => cell(`${colName(i)}1`, h, 1)).join("")}</row>`,
    ...spec.rows.map((r, ri) => `<row r="${ri + 2}">${r.map((v, i) => cell(`${colName(i)}${ri + 2}`, v, text.has(i) ? 2 : 0)).join("")}</row>`),
  ];
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols><sheetData>${rows.join("")}</sheetData></worksheet>`
  );
}

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;

const files: [string, string][] = [
  [
    "[Content_Types].xml",
    XML +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      `</Types>`,
  ],
  ["_rels/.rels", XML + `<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  [
    "xl/workbook.xml",
    XML +
      `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView activeTab="1"/></bookViews><sheets>` +
      sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      `</sheets></workbook>`,
  ],
  [
    "xl/_rels/workbook.xml.rels",
    XML +
      `<Relationships xmlns="${NS_PKG}">` +
      sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`,
  ],
  [
    "xl/styles.xml",
    XML +
      `<styleSheet xmlns="${NS_MAIN}">` +
      `<fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font></fonts>` +
      `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
      `<fill><patternFill patternType="solid"><fgColor rgb="FFFDB913"/><bgColor indexed="64"/></patternFill></fill></fills>` +
      `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
      `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
      `<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>` +
      `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  ],
  ...sheets.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
];

function zip(entries: [string, string][]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  // 1980-01-01 00:00 keeps the output byte-identical between runs.
  const time = 0;
  const date = (0 << 9) | (1 << 5) | 1;
  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const raw = Buffer.from(content, "utf8");
    const data = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const out = new URL("../public/lubestation-data-template.xlsx", import.meta.url);
writeFileSync(out, zip(files));
console.log("wrote", out.pathname);
