import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../routes";
import { HomeIcon } from "./icons";
import styles from "./InfoLayout.module.css";

const CYAN = "#22d3ee";
const GREEN = "#22c55e";

interface Props {
  /** Small uppercase label above the title. */
  kicker: string;
  title: ReactNode;
  lede: ReactNode;
  /** "cyan" or "green": the page's primary accent; the other one highlights the title. */
  accent: "cyan" | "green";
  note: ReactNode;
  children: ReactNode;
}

/** Shared shell of the dark, editorial content pages (Scheme Overview, Core Operations). */
export default function InfoLayout({ kicker, title, lede, accent, note, children }: Props) {
  const [primary, secondary] = accent === "cyan" ? [CYAN, GREEN] : [GREEN, CYAN];
  const vars = { "--accent": primary, "--accent-2": secondary } as CSSProperties;

  return (
    <div className={styles.page} style={vars} dir="rtl" lang="fa">
      <header className={styles.top}>
        <div className={styles.word}>
          DST · <b>Lubestation</b>
        </div>
        <Link className={styles.homeBtn} to={ROUTES.home}>
          <HomeIcon size={14} />
          خانه
        </Link>
      </header>

      <main className={styles.main}>
        <span className={styles.kicker}>
          <span className={styles.dot} />
          {kicker}
        </span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>{lede}</p>
        {children}
        <div className={styles.note}>
          <span>ⓘ</span>
          <div>{note}</div>
        </div>
      </main>
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className={styles.h}>{children}</h2>;
}
