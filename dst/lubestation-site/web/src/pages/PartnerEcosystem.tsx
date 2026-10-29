import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import dstLogo from "../assets/dst-logo.webp";
import partakLogo from "../assets/partak-logo.png";
import g from "../components/governance/Governance.module.css";
import { ArrowIcon, HomeIcon } from "../components/icons";
import { DEALERS } from "../data/dealers";
import { prefersReducedMotion } from "../lib/format";
import { ROUTES } from "../routes";
import { startOrbitBackground } from "../three/orbitBackground";
import styles from "./PartnerEcosystem.module.css";

const stroke = { fill: "none", stroke: "#fff", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Round avatar per dealer slug: background and logo/icon. */
const AVATARS: Record<string, { bg: string; icon: ReactNode }> = {
  "partak-isfahan": {
    bg: "#fff",
    icon: <img src={partakLogo} alt="پارتاک دیزل اصفهان" className={styles.logo} />,
  },
  "aria-tehran": {
    bg: "linear-gradient(145deg,#3b82f6,#1d4ed8)",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M4 20V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v14" />
        <path d="M4 11h9" />
        <path d="M15 9h2.2a1 1 0 0 1 .8.4l1.6 2.1a1 1 0 0 1 .2.6V17a1 1 0 0 1-1 1H15" />
        <circle cx="7.5" cy="20" r="1.4" />
        <circle cx="16.5" cy="20" r="1.4" />
      </svg>
    ),
  },
  "kavian-tabriz": {
    bg: "linear-gradient(145deg,#fbbf24,#d97706)",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    ),
  },
  "sepehr-shiraz": {
    bg: "linear-gradient(145deg,#10b981,#047857)",
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <rect x="6" y="4" width="12" height="16" rx="2" />
        <path d="M6 9h12M6 15h12M9 4v2M15 4v2" />
      </svg>
    ),
  },
};

/** Dealer picker, in the management pages' dark/amber theme with the orbit background. */
export default function PartnerEcosystem() {
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
            <p>انتخاب نمایندگی</p>
          </div>
          <div className={g.toprow}>
            <Link className={g.homelink} to={ROUTES.home}>
              <HomeIcon />
              HOME
            </Link>
          </div>
        </header>

        <section aria-label="نمایندگی‌ها">
          <div className={styles.grid}>
            {DEALERS.map((d) => (
              <Link key={d.slug} className={`${g.p4} ${styles.dealer}`} to={`${ROUTES.dealerReport}/${d.slug}`}>
                <div className={styles.avatar} style={{ background: AVATARS[d.slug]?.bg }}>
                  {AVATARS[d.slug]?.icon}
                </div>
                <h3>{d.name}</h3>
                <p className={styles.sub}>{d.city}</p>
                <span className={styles.btn}>
                  ورود به گزارش
                  <ArrowIcon />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
