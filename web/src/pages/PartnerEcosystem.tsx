import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import partakLogo from "../assets/partak-logo.png";
import { ArrowIcon } from "../components/icons";
import { ROUTES } from "../routes";
import slate from "../styles/slate.module.css";
import styles from "./PartnerEcosystem.module.css";

interface Dealer {
  name: string;
  city: string;
  /** Background of the round avatar. */
  avatarBg: string;
  avatar: ReactNode;
}

const stroke = { fill: "none", stroke: "#fff", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const DEALERS: Dealer[] = [
  {
    name: "پارتاک دیزل اصفهان",
    city: "اصفهان",
    avatarBg: "#fff",
    avatar: <img src={partakLogo} alt="پارتاک دیزل اصفهان" className={styles.logo} />,
  },
  {
    name: "آریا دیزل تهران",
    city: "تهران",
    avatarBg: "linear-gradient(145deg,#3b82f6,#1d4ed8)",
    avatar: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M4 20V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v14" />
        <path d="M4 11h9" />
        <path d="M15 9h2.2a1 1 0 0 1 .8.4l1.6 2.1a1 1 0 0 1 .2.6V17a1 1 0 0 1-1 1H15" />
        <circle cx="7.5" cy="20" r="1.4" />
        <circle cx="16.5" cy="20" r="1.4" />
      </svg>
    ),
  },
  {
    name: "کاویان روان تبریز",
    city: "تبریز",
    avatarBg: "linear-gradient(145deg,#fbbf24,#d97706)",
    avatar: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    ),
  },
  {
    name: "سپهر لوب شیراز",
    city: "شیراز",
    avatarBg: "linear-gradient(145deg,#10b981,#047857)",
    avatar: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="6" y="4" width="12" height="16" rx="2" />
        <path d="M6 9h12M6 15h12M9 4v2M15 4v2" />
      </svg>
    ),
  },
];

export default function PartnerEcosystem() {
  return (
    <div className={slate.page} dir="rtl" lang="fa">
      <div className={styles.wrap}>
        <div className={`${slate.header} ${styles.header}`}>
          <Link className={slate.back} to={ROUTES.home}>
            <ArrowIcon />
            بازگشت به صفحه اصلی
          </Link>
          <h1>انتخاب نمایندگی</h1>
          <p>یکی از نمایندگی‌ها را برای مشاهده گزارش مصرف روغن بالک انتخاب کنید</p>
        </div>

        <div className={styles.grid}>
          {DEALERS.map((d) => (
            <div key={d.name} className={styles.dealer}>
              <div className={styles.avatar} style={{ background: d.avatarBg }}>
                {d.avatar}
              </div>
              <h3>{d.name}</h3>
              <p className={styles.sub}>{d.city}</p>
              {/* Dealer reports are not wired up yet. */}
              <span className={styles.btn} aria-disabled="true">
                ورود به گزارش
                <ArrowIcon />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
