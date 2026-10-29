import InfoLayout, { SectionHeading } from "../components/InfoLayout";
import styles from "./CoreOperations.module.css";

const PRODUCTS = [
  { title: "روغن موتور دیزل", text: "فرمولاسیون‌های اختصاصی برای موتورهای سنگین دیزلی، مطابق با استانداردهای بین‌المللی مصرف سوخت و عمر موتور." },
  { title: "روغن گیربکس و دیفرانسیل", text: "روانکارهای صنعتی برای سیستم‌های انتقال قدرت در ناوگان‌های تجاری و معدنی." },
  { title: "روغن هیدرولیک", text: "برای تجهیزات سنگین، ماشین‌آلات راه‌سازی و معدنی با شرایط کاری سخت." },
  { title: "مایعات خنک‌کننده و ضدیخ", text: "محافظت از سیستم خنک‌کاری موتور در شرایط اقلیمی متنوع کشور." },
];

const AUDIENCES = [
  { title: "تولیدکنندگان خودرو", text: "همکاری در تأمین روانکار استاندارد خطوط تولید." },
  { title: "نمایندگی‌های خودرو", text: "تأمین مستقیم و فله برای کاهش هزینه و قطع‌شدگی موجودی." },
  { title: "معادن و واحدهای ترابری", text: "روانکار مقیاس‌پذیر برای ناوگان سنگین." },
  { title: "شرکت‌های حمل‌ونقل و لجستیک", text: "دولتی و خصوصی، با نیاز مستمر به روانکار دیزل." },
];

const STATS = [
  { value: "۱", label: "پایلوت فعال (پارتاک دیزل سپهر)" },
  { value: "۵", label: "هدف فاز بعدی" },
  { value: "۱۰", label: "هدف بلندمدت مخازن" },
];

export default function CoreOperations() {
  return (
    <InfoLayout
      accent="green"
      kicker="Core Operations"
      title={
        <>
          DST — <span>اولین برند تخصصی دیزل</span> در ایران
        </>
      }
      lede="DST زیرمجموعه گروه صنعتی تاش است و تمرکز اصلی آن تولید و تأمین انواع روانکارهای مورد نیاز موتورهای دیزل — از روغن موتور و گیربکس تا روغن هیدرولیک و ضد یخ — برای ناوگان‌های سنگین، معادن، واحدهای حمل‌ونقل و نمایندگی‌های خودرو است. LUBESTATION بازوی توزیع هوشمند همین محصولات به‌صورت فله (بالک) در نمایندگی‌های سراسر کشور است."
      note={
        <>
          برای شرح کامل طرح مخازن هوشمند و نحوه کار سامانه LUBESTATION، به بخش <b>Scheme Overview</b> مراجعه کنید.
        </>
      }
    >
      <SectionHeading>محصولات</SectionHeading>
      <div className={styles.grid}>
        {PRODUCTS.map((p, i) => (
          <div key={p.title} className={styles.card}>
            <div className={styles.n}>{String(i + 1).padStart(2, "0")}</div>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
          </div>
        ))}
      </div>

      <SectionHeading>مخاطبان</SectionHeading>
      <div className={styles.grid}>
        {AUDIENCES.map((a) => (
          <div key={a.title} className={styles.card}>
            <h3>{a.title}</h3>
            <p>{a.text}</p>
          </div>
        ))}
      </div>

      <SectionHeading>طرح فله در یک نگاه</SectionHeading>
      <div className={styles.stats}>
        {STATS.map((s) => (
          <div key={s.label} className={styles.stat}>
            <b>{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </InfoLayout>
  );
}
