import InfoLayout, { SectionHeading } from "../components/InfoLayout";
import styles from "./SchemeOverview.module.css";

const STEPS = [
  { title: "نصب مخزن پلمپ‌شده", text: "مخزن هوشمند در نمایندگی نصب و با سامانه مرکزی متصل می‌شود؛ پلمپ فیزیکی جلوی دستکاری و افت کیفیت را می‌گیرد." },
  { title: "ثبت برداشت با کد خودرو", text: "هر برداشت روغن برای یک خودروی مشخص ثبت می‌شود؛ ردیابی کامل مصرف به تفکیک خودرو و تاریخ." },
  { title: "پایش لحظه‌ای مصرف و موجودی", text: "سطح مخزن، نرخ مصرف و زمان تقریبی اتمام موجودی به‌صورت آنلاین قابل مشاهده است." },
  { title: "نظارت سراسری مدیریت ارشد", text: "داشبورد Corporate Governance نمای کلی همه جایگاه‌ها را در یک صفحه نشان می‌دهد." },
];

const ROADMAP = [
  { count: "۱", label: "فاز فعلی — پایلوت" },
  { count: "۵", label: "فاز بعدی — توسعه اولیه" },
  { count: "۱۰", label: "هدف میان‌مدت" },
];

export default function SchemeOverview() {
  return (
    <InfoLayout
      accent="cyan"
      kicker="Scheme Overview"
      title={
        <>
          طرح <span>روغن فله</span> LUBESTATION
        </>
      }
      lede="LUBESTATION سامانه مدیریت و پایش مخازن هوشمند و پلمپ‌شده‌ی روغن دیزل است که در نمایندگی‌های سراسر کشور نصب می‌شود. هر برداشت روغن با کد خودرو ثبت می‌شود، مصرف به‌صورت لحظه‌ای قابل پایش است و مدیریت ارشد DST نمای کلی همه‌ی جایگاه‌ها را به‌صورت یکپارچه در اختیار دارد."
      note={
        <>
          برای مشاهده‌ی عملیاتی سامانه (ورود نمایندگی، داشبورد مخازن، ثبت برداشت)، به بخش <b>Partner Ecosystem</b> یا مستقیماً به اپ عملیاتی LUBESTATION بروید.
        </>
      }
    >
      <SectionHeading>طرح چطور کار می‌کند</SectionHeading>
      <div className={styles.flow}>
        {STEPS.map((step, i) => (
          <div key={step.title} className={styles.step}>
            <div className={styles.num}>{(i + 1).toLocaleString("fa-IR")}</div>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionHeading>پایلوت فعال</SectionHeading>
      <div className={styles.pilot}>
        <div>
          <div className={styles.label}>نمایندگی پایلوت</div>
          <div className={styles.name}>پارتاک دیزل سپهر (Mammut)</div>
        </div>
        <span className={styles.badge}>داده واقعی فعال</span>
      </div>

      <SectionHeading>نقشه راه توسعه</SectionHeading>
      <div className={styles.roadmap}>
        {ROADMAP.map((r) => (
          <div key={r.label} className={styles.rcard}>
            <b>{r.count}</b>
            <span>{r.label}</span>
          </div>
        ))}
      </div>
    </InfoLayout>
  );
}
