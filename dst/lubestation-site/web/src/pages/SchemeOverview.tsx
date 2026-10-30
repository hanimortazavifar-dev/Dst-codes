import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import certificates from "../assets/catalog/certificates.webp";
import maintenancePhoto from "../assets/catalog/maintenance.webp";
import nozzleMeter from "../assets/catalog/nozzle-meter.webp";
import safetyIcons from "../assets/catalog/safety-icons.webp";
import screenAuto from "../assets/catalog/screen-auto.webp";
import screenLoading from "../assets/catalog/screen-loading.webp";
import screenSales from "../assets/catalog/screen-sales.webp";
import screenSettings from "../assets/catalog/screen-settings.webp";
import smartController from "../assets/catalog/smart-controller.webp";
import tankProduct from "../assets/catalog/tank-product.webp";
import dstLogo from "../assets/dst-logo.webp";
import g from "../components/governance/Governance.module.css";
import { HomeIcon } from "../components/icons";
import { EMERGENCY, HIGHLIGHTS, INSTALL, MAINTENANCE, OIL_PATH, OPERATION, PARTS, POWER_PATH, SAFETY, SPECS, SUPPORT, TROUBLESHOOTING } from "../data/catalog";
import { prefersReducedMotion } from "../lib/format";
import { ROUTES } from "../routes";
import { startOrbitBackground } from "../three/orbitBackground";
import styles from "./SchemeOverview.module.css";

const faNum = (n: number) => n.toLocaleString("fa-IR");

/** The scheme in short (kept from the earlier version of this page). */
const SCHEME_STEPS: [string, string][] = [
  ["نصب مخزن پلمپ‌شده", "مخزن هوشمند در نمایندگی نصب و با سامانهٔ مرکزی متصل می‌شود؛ پلمپ فیزیکی جلوی دستکاری و افت کیفیت را می‌گیرد."],
  ["ثبت برداشت با کد خودرو", "هر برداشت روغن برای یک خودروی مشخص ثبت می‌شود؛ ردیابی کامل مصرف به تفکیک خودرو و تاریخ."],
  ["پایش لحظه‌ای مصرف و موجودی", "سطح مخزن، نرخ مصرف و زمان تقریبی اتمام موجودی به‌صورت آنلاین قابل مشاهده است."],
  ["نظارت سراسری مدیریت ارشد", "داشبورد مدیریت ارشد نمای کلی همهٔ جایگاه‌ها را در یک صفحه نشان می‌دهد."],
];

const SECTIONS = [
  ["scheme", "طرح روغن فله"],
  ["specs", "مشخصات فنی"],
  ["parts", "قطعات"],
  ["install", "نصب و راه‌اندازی"],
  ["operation", "روش استفاده"],
  ["schematic", "نقشهٔ شماتیک"],
  ["smart", "سیستم مدیریت هوشمند"],
  ["troubleshooting", "عیب‌یابی"],
  ["maintenance", "نگهداری دوره‌ای"],
  ["safety", "نکات ایمنی"],
  ["support", "پشتیبانی"],
] as const;

function Section({ id, title, children }: { id: (typeof SECTIONS)[number][0]; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={g.h}>{title}</h2>
      {children}
    </section>
  );
}

function Steps({ items }: { items: [string, string][] }) {
  return (
    <ol className={styles.steps}>
      {items.map(([title, text], i) => (
        <li key={title}>
          <span className={styles.num}>{faNum(i + 1)}</span>
          <div>
            <b>{title}</b>
            <p>{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Flow({ items, label }: { items: string[]; label: string }) {
  return (
    <div className={styles.flow} role="list" aria-label={label}>
      {items.map((item, i) => (
        <div key={item} className={styles.flowItem} role="listitem">
          <span className={styles.flowBox}>{item}</span>
          {i < items.length - 1 && (
            <span className={styles.flowArrow} aria-hidden="true">
              ←
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Product overview and user manual of the LUBESTATION tank (from the printed catalogue). */
export default function SchemeOverview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
            <p>معرفی طرح و راهنمای مخزن هوشمند روغن بالک</p>
          </div>
          <div className={g.toprow}>
            <Link className={g.homelink} to={ROUTES.home}>
              <HomeIcon />
              HOME
            </Link>
          </div>
        </header>

        <nav className={styles.toc} aria-label="فهرست">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

        <div className={`${g.panel} ${styles.hero}`}>
          <div className={styles.heroText}>
            <span className={styles.kicker}>DST LUBESTATION</span>
            <h2>مخزن هوشمند روغن بالک</h2>
            <p>
              LUBESTATION سامانهٔ مدیریت و پایش مخازن هوشمند و پلمپ‌شدهٔ روغن دیزل است که در نمایندگی‌های سراسر کشور نصب می‌شود. هر برداشت روغن با کد خودرو ثبت
              می‌شود، مصرف به‌صورت لحظه‌ای قابل پایش است و مدیریت ارشد DST نمای کلی همهٔ جایگاه‌ها را یکجا در اختیار دارد.
            </p>
            <div className={styles.highlights}>
              {HIGHLIGHTS.map((h) => (
                <div key={h.label}>
                  <b>
                    {h.value} {h.unit && <small>{h.unit}</small>}
                  </b>
                  <span>{h.label}</span>
                </div>
              ))}
            </div>
          </div>
          <img className={styles.heroImg} src={tankProduct} alt="مخزن LUBESTATION با برند DST" />
        </div>

        <p className={styles.warning}>پیش از نصب و بهره‌برداری، این راهنما را به‌طور کامل مطالعه کنید و الزامات ایمنی را رعایت نمایید.</p>

        <Section id="scheme" title="طرح روغن فله چطور کار می‌کند">
          <div className={g.panel}>
            <Steps items={SCHEME_STEPS} />
            <div className={styles.pilot}>
              <div>
                <span>نمایندگی پایلوت</span>
                <b>پارتاک دیزل سپهر (اصفهان)</b>
              </div>
              <div className={styles.roadmap}>
                <span>
                  <b>۱</b> فاز فعلی — پایلوت
                </span>
                <span>
                  <b>۵</b> فاز بعدی — توسعهٔ اولیه
                </span>
                <span>
                  <b>۱۰</b> هدف میان‌مدت
                </span>
              </div>
            </div>
          </div>
        </Section>

        <Section id="specs" title="مشخصات فنی محصول">
          <div className={g.panel}>
            <dl className={styles.specs}>
              {SPECS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>

        <Section id="parts" title="لیست قطعات">
          <div className={styles.split}>
            <div className={g.panel}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>شماره</th>
                    <th>نام قطعه</th>
                    <th>توضیحات</th>
                  </tr>
                </thead>
                <tbody>
                  {PARTS.map(([name, desc], i) => (
                    <tr key={name}>
                      <td className={styles.idx}>{faNum(i + 1)}</td>
                      <td>{name}</td>
                      <td>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <img className={styles.photo} src={nozzleMeter} alt="نازل برداشت روغن با لیترشمار دیجیتال و قرقرهٔ شلنگ" loading="lazy" />
          </div>
        </Section>

        <Section id="install" title="نصب و راه‌اندازی">
          <div className={g.panel}>
            <Steps items={INSTALL} />
          </div>
        </Section>

        <Section id="operation" title="روش استفاده">
          <div className={g.panel}>
            <Steps items={OPERATION} />
          </div>
        </Section>

        <Section id="schematic" title="نقشهٔ شماتیک">
          <div className={`${g.panel} ${styles.schematic}`}>
            <h3>دیاگرام هیدرولیک: مسیر روغن، فیلتر، پمپ و نازل</h3>
            <Flow items={OIL_PATH} label="مسیر روغن" />
            <h3>دیاگرام الکتریکی: اتصالات برق، فیوزها، کلید E-Stop و نمایشگر</h3>
            <Flow items={POWER_PATH} label="مسیر برق" />
          </div>
        </Section>

        <Section id="smart" title="راهنمای سیستم مدیریت هوشمند مخزن">
          <div className={`${g.panel} ${styles.smart}`}>
            <img className={styles.controller} src={smartController} alt="صفحهٔ کنترل هوشمند LUBESTATION" loading="lazy" />
            <div>
              <p className={styles.lead}>این راهنما برای آشنایی با نحوهٔ عملکرد، تنظیمات و ثبت گزارش‌های دستگاه تهیه شده است. صفحهٔ اصلی دستگاه سه گزینه دارد: تزریق دستی، تزریق اتوماتیک و تنظیمات؛ و یک دکمهٔ پشتیبانی.</p>
            </div>
          </div>

          <div className={styles.guide}>
            <div className={g.p4}>
              <img src={screenSettings} alt="صفحهٔ تنظیمات دستگاه" loading="lazy" />
              <h3>۱. ورود به تنظیمات سیستم</h3>
              <p>برای دسترسی به پیکربندی سیستم، ابتدا باید وارد حساب کاربری شوید. نام کاربری و رمز عبور اختصاصی سیستم را از پشتیبانی دریافت کنید، روی گزینهٔ «تنظیمات» بزنید، آن‌ها را وارد و کلید Enter را فشار دهید.</p>
            </div>
            <div className={g.p4}>
              <img src={screenLoading} alt="صفحهٔ تنظیم بارگیری مخزن" loading="lazy" />
              <h3>۲. تنظیم بارگیری مخزن</h3>
              <p>در این بخش مقدار کل روغن بارگیری‌شدهٔ مخزن را تعریف یا اصلاح می‌کنید.</p>
              <ul>
                <li>
                  <b>افزایش:</b> عدد را وارد کنید، Enter و سپس Set را بزنید.
                </li>
                <li>
                  <b>کاهش:</b> عدد را وارد کنید، کلید منفی (-) و سپس Enter را بزنید.
                </li>
              </ul>
              <p className={styles.note}>پس از وارد کردن عدد حتماً دکمهٔ Set را بزنید تا تنظیمات در حافظهٔ دستگاه ثبت شود.</p>
            </div>
            <div className={g.p4}>
              <img src={screenAuto} alt="صفحهٔ تزریق اتوماتیک" loading="lazy" />
              <h3>۳. فرایند تزریق اتوماتیک</h3>
              <ol>
                <li>
                  <b>ورود کد خودرو:</b> کد اختصاصی خودرو (تا ۸ رقم) را وارد کنید و Enter بزنید.
                </li>
                <li>
                  <b>مقدار تزریق:</b> لیتراژ موردنظر را (تا سقف ۵۵ لیتر) وارد کنید و Enter بزنید.
                </li>
                <li>
                  <b>شروع عملیات:</b> کلید Start را بزنید. دستگاه به‌صورت معکوس شمارش و تزریق می‌کند و پس از رسیدن به مقدار واردشده خودکار متوقف می‌شود.
                </li>
              </ol>
              <p className={styles.note}>اگر موتور در حین تزریق به هر دلیلی خاموش شود، مقدار تزریق‌شده (output) در گزارش ثبت می‌شود و باقی‌مانده (input − output) خودکار حساب و در تاریخچهٔ فروش ثبت می‌شود.</p>
            </div>
            <div className={g.p4}>
              <img src={screenSales} alt="صفحهٔ تاریخچهٔ فروش" loading="lazy" />
              <h3>۴. گزارش فروش</h3>
              <p>گزارش‌های دستگاه را می‌توانید برای تحلیل بیشتر روی فلش‌مموری کپی کنید.</p>
              <ul>
                <li>
                  <b>نحوهٔ کپی:</b> فلش را به پورت دستگاه وصل کنید، بازهٔ زمانی (یک روزه، یک هفته، یک ماهه، سه ماهه یا از ابتدا) را انتخاب و «بارگیری تاریخچهٔ فروش» را بزنید؛ کار حدود ۵ ثانیه طول می‌کشد.
                </li>
                <li>
                  <b>خروج ایمن:</b> پس از پایان، حتماً «خارج کردن USB» را بزنید و سپس فلش را جدا کنید.
                </li>
              </ul>
            </div>
          </div>
          <p className={styles.callout}>در صورت بروز هرگونه مشکل فنی، از دکمهٔ «پشتیبانی» روی دستگاه استفاده کنید؛ با فشردن آن، پیامکی حاوی درخواست کمک به مرکز پشتیبانی ارسال می‌شود.</p>
        </Section>

        <Section id="troubleshooting" title="عیب‌یابی">
          <div className={g.panel}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>مشکل</th>
                    <th>علت احتمالی</th>
                    <th>راه‌حل پیشنهادی</th>
                  </tr>
                </thead>
                <tbody>
                  {TROUBLESHOOTING.map(([problem, cause, fix]) => (
                    <tr key={problem}>
                      <td>
                        <b>{problem}</b>
                      </td>
                      <td>{cause}</td>
                      <td>{fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={`${g.panel} ${styles.emergency}`}>
            <h3>اقدامات اضطراری</h3>
            <ul>
              {EMERGENCY.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <p>
              <b>در همهٔ موارد بالا، پس از انجام اقدامات اضطراری فوراً با پشتیبانی شرکت DST تماس بگیرید.</b>
            </p>
          </div>
        </Section>

        <Section id="maintenance" title="نگهداری دوره‌ای">
          <div className={styles.split}>
            <div className={styles.periods}>
              {MAINTENANCE.map((m) => (
                <div key={m.period} className={g.p4}>
                  <h3>{m.period}</h3>
                  <ul>
                    {m.tasks.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <img className={styles.photo} src={maintenancePhoto} alt="سرویس فیلتر و پمپ دنده‌ای" loading="lazy" />
          </div>
        </Section>

        <Section id="safety" title="نکات ایمنی">
          <div className={g.panel}>
            <ul className={styles.bullets}>
              {SAFETY.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <img className={styles.icons} src={safetyIcons} alt="دستکش، عینک ایمنی، کفش کار، استعمال دخانیات ممنوع، دوری از شعله" loading="lazy" />
          </div>
        </Section>

        <Section id="support" title="گواهینامه‌ها، پشتیبانی و خدمات پس از فروش">
          <div className={`${g.panel} ${styles.certs}`}>
            <img src={certificates} alt="گواهینامه‌ها: CE، ISO 9001، ISO 14001، ISO 45001، IATF 16949، IQNet، ISO/IEC 17025، استاندارد ملی ایران" loading="lazy" />
          </div>
          <div className={`${g.panel} ${styles.support}`}>
            <p>کارشناسان ما همواره آمادهٔ پشتیبانی و پاسخ‌گویی به شما مشتریان و مصرف‌کنندگان محصولات حوزهٔ خودروهای دیزل هستند.</p>
            <div className={styles.contacts}>
              <a href={SUPPORT.phoneHref}>
                <span>تلفن پشتیبانی</span>
                <b dir="ltr">{SUPPORT.phone}</b>
              </a>
              <div>
                <span>شمارهٔ پیامک</span>
                <b dir="ltr">{SUPPORT.sms}</b>
              </div>
              <div>
                <span>اینستاگرام</span>
                <b dir="ltr">{SUPPORT.instagram}</b>
              </div>
            </div>
            <p className={styles.muted}>برای ارائهٔ خدمات بهتر، لطفاً نظرات و انتقادات سازندهٔ خود را با ما در میان بگذارید.</p>
          </div>
          <div className={styles.slogan}>
            <b>اولین برند تخصصی دیزل</b>
            <span>اولین برند حامی دیزل‌رانان</span>
          </div>
        </Section>
      </div>
    </div>
  );
}
