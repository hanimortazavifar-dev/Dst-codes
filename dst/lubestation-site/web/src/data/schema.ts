/**
 * Layout of the data Excel file: sheet names and column headers. The site reads sheets and
 * columns by these titles (case, spaces, half-spaces and "(…)" hints are ignored), so the order
 * of columns does not matter. scripts/make-template.ts builds the downloadable template from this.
 */

export const SHEETS = {
  stations: {
    name: "جایگاه‌ها",
    columns: {
      name: "نام جایگاه",
      city: "شهر",
      address: "آدرس",
      kind: "نوع (واقعی/نمونه)",
      cap: "ظرفیت مخزن (لیتر)",
      inv: "موجودی فعلی (لیتر)",
      weekly: "میانگین مصرف هفتگی (لیتر)",
      alarms: "هشدار فعال (تعداد)",
      lastService: "تاریخ آخرین سرویس",
      nextService: "تاریخ سرویس بعدی",
      openMaint: "هشدار نگهداری باز (تعداد)",
      maintNote: "یادداشت نگهداری",
      lat: "عرض جغرافیایی",
      lon: "طول جغرافیایی",
    },
  },
  weekly: {
    name: "مصرف هفتگی",
    columns: { week: "هفته", liters: "مصرف کل (لیتر)" },
  },
  tickets: {
    name: "هشدارها",
    columns: { title: "عنوان", detail: "توضیح", severity: "اولویت (فوری/نیازمند بازدید)" },
  },
  equipment: {
    name: "تجهیزات",
    columns: {
      site: "نمایندگی",
      name: "تجهیز",
      severity: "وضعیت (سالم/نیازمند بازدید/فوری)",
      label: "توضیح وضعیت",
      connection: "ارتباط (متصل/قطع)",
      technician: "تکنسین",
      phone: "تلفن تکنسین",
    },
  },
  services: {
    name: "سرویس‌ها",
    columns: { equipment: "تجهیز", site: "نمایندگی", last: "تاریخ آخرین سرویس", next: "تاریخ سرویس بعدی" },
  },
  parts: {
    name: "قطعات یدکی",
    columns: { name: "قطعه", qty: "موجودی (عدد)" },
  },
  dealers: {
    name: "نمایندگی‌ها",
    columns: { name: "نمایندگی", city: "شهر", cap: "ظرفیت مخزن (لیتر)", inv: "موجودی فعلی (لیتر)" },
  },
  withdrawals: {
    name: "برداشت‌ها",
    columns: { dealer: "نمایندگی", date: "تاریخ", time: "ساعت", liters: "مقدار (لیتر)", device: "دستگاه" },
  },
  settings: {
    name: "تنظیمات",
    columns: { key: "عنوان", value: "مقدار" },
  },
} as const;

export const SETTING_KEYS = {
  leadDays: "زمان تأمین (روز)",
  avgResolutionDays: "میانگین زمان رفع مشکل (روز)",
} as const;

/** Normalizes a sheet/column title for matching: drops "(…)", spaces, half-spaces and Arabic letter variants. */
export function titleKey(s: string) {
  return s
    .replace(/\(.*?\)/g, "")
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\s‌‍‎‏ _\-–:.]/g, "")
    .toLowerCase();
}
