import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/unbounded/600.css";
import "@fontsource/unbounded/700.css";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import logoOutline from "../assets/dst-logo-outline.png";
import gaugeMonitor from "../assets/gauge-monitor.png";
import iranNetwork from "../assets/iran-network.jpg";
import lubestationBox from "../assets/dst-lubestation.jpg";
import truck from "../assets/truck.jpg";
import { SECTION_NAV } from "../routes";
import { MAX_STAGE, startParticleHero, type StageImage } from "../three/particleHero";
import styles from "./Home.module.css";

interface Stage {
  code: string;
  label: string;
  title: [string, string];
  caption: string;
  /** Render the label at a smaller size (long labels). */
  compactLabel?: boolean;
}

const STAGES: Stage[] = [
  {
    code: "01",
    label: "Brand Identity",
    title: ["Corporate", "Essence"],
    caption: "Setting the standard in smart lubrication infrastructure and industrial fluid management.",
  },
  {
    code: "02",
    label: "Fluid Storage",
    title: ["Advanced", "Containment"],
    caption: "Heavy-duty storage systems engineered for maximum compliance, security, and containment integrity.",
  },
  {
    code: "03",
    label: "Transit & Logistics",
    title: ["Logistics", "Network"],
    caption: "Optimized supply chain pathways ensuring secure and efficient bulk fuel distribution across regional corridors.",
    compactLabel: true,
  },
  {
    code: "04",
    label: "Smart Dispensing & Control",
    title: ["Intelligent", "Metering"],
    caption: "Integrated smart control systems delivering absolute precision in volume metering and real-time consumption tracking.",
  },
  // Final stage: the national network map.
  {
    code: "05",
    label: "National Coverage",
    title: ["Nationwide", "Reach"],
    caption: "A connected network of smart tanks across Iran, monitored in real time from a single command center.",
  },
];

const STAGE_IMAGES: StageImage[] = [
  // Logo: 30% bigger then −10%, and 20% fewer distinct points so it doesn't merge on mobile.
  { url: logoOutline, trace: { scale: 3.2 * 1.3 * 0.9, density: 0.8 } },
  { url: lubestationBox },
  { url: truck },
  { url: gaugeMonitor },
  // Bright lines on a dark background, +20% size, radiating lines get their own colour travel.
  { url: iranNetwork, trace: { scale: 3.2 * 1.2, invert: true, withLineMask: true } },
];

/**
 * Most of each stage's scroll range holds the shape still (HOLD_FRAC); only the tail morphs to
 * the next shape, so every stage visibly "lands".
 */
const HOLD_FRAC = 0.55;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Linear scroll position (0..MAX_STAGE) → shape progress with holds. */
function stagedProgress(p: number) {
  const clamped = Math.min(MAX_STAGE, Math.max(0, p));
  if (clamped >= MAX_STAGE) return MAX_STAGE;
  const i = Math.floor(clamped);
  const f = clamped - i;
  return i + smoothstep(f < HOLD_FRAC ? 0 : (f - HOLD_FRAC) / (1 - HOLD_FRAC));
}

/** The stage whose copy should show: switches once the morph toward the next one starts. */
function visibleStage(p: number) {
  const clamped = Math.min(MAX_STAGE, Math.max(0, p));
  const i = Math.floor(clamped);
  return clamped - i < HOLD_FRAC ? i : Math.min(MAX_STAGE, i + 1);
}

export default function Home() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stageIx, setStageIx] = useState(0);
  // The copy on screen lags stageIx by a frame so the old text can drop out before the new fades in.
  const [shownIx, setShownIx] = useState(0);
  const [copyVisible, setCopyVisible] = useState(false);

  // Particle field + scroll tracking.
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const hero = startParticleHero(canvas, STAGE_IMAGES);

    const linearProgress = () => {
      const max = section.offsetHeight - window.innerHeight;
      return Math.min(Math.max(-section.getBoundingClientRect().top / max, 0), 1) * MAX_STAGE;
    };

    // If scrolling stops mid-morph, finish the move to the next clear shape.
    let snapTimer = 0;
    const trySnap = () => {
      const p = linearProgress();
      if (p <= 0 || p >= MAX_STAGE) return;
      const i = Math.floor(p);
      if (p - i >= HOLD_FRAC) {
        const max = section.offsetHeight - window.innerHeight;
        window.scrollTo({ top: section.offsetTop + ((i + 1) / MAX_STAGE) * max, behavior: "smooth" });
      }
    };

    const onScroll = () => {
      const p = linearProgress();
      hero.setProgress(stagedProgress(p));
      setStageIx(visibleStage(p));
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(trySnap, 160);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(snapTimer);
      hero.dispose();
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Swap the copy: hide, change text next frame, then fade it back in.
  useEffect(() => {
    setCopyVisible(false);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      setShownIx(stageIx);
      inner = requestAnimationFrame(() => setCopyVisible(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [stageIx]);

  const stage = STAGES[shownIx];
  const navLinks = (className: string) =>
    SECTION_NAV.map((item) => (
      <Link key={item.to} to={item.to} className={className} onClick={() => setMenuOpen(false)}>
        <span>{item.label}</span>
        <span className={styles.navDot} />
      </Link>
    ));

  return (
    <div className={styles.page} dir="ltr" lang="en">
      <header className={styles.header}>
        <span className={styles.wordmark}>LUBESTATION</span>
      </header>

      <button
        type="button"
        className={`${styles.navToggle} ${menuOpen ? styles.open : ""}`}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="mobileNav"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>
      <nav id="mobileNav" className={`${styles.mobileNav} ${menuOpen ? styles.open : ""}`}>
        {navLinks(styles.mobileLink)}
      </nav>

      <main>
        <section ref={sectionRef} className={styles.hero}>
          <div className={styles.sticky}>
            <div className={styles.vignette} />
            <canvas ref={canvasRef} className={styles.field} />

            <nav className={`${styles.sideNav} ${ready ? styles.show : ""}`}>{navLinks(styles.sideLink)}</nav>

            <div className={styles.bottomLeft}>
              <span className={`${styles.kicker} ${ready ? styles.show : ""}`}>
                <span className={styles.kickerDot} />
                Stage {stage.code} — <span className={stage.compactLabel ? styles.compactLabel : undefined}>{stage.label}</span>
              </span>

              <div className={styles.titleWrap}>
                <h1 className={`${styles.title} ${copyVisible ? styles.show : ""}`}>
                  {stage.title[0]}
                  <br />
                  {stage.title[1]}
                </h1>
              </div>

              <div className={styles.caption}>
                <p className={copyVisible ? styles.show : undefined}>{stage.caption}</p>
              </div>
            </div>

            <div className={styles.scrollCue} style={{ opacity: stageIx === MAX_STAGE ? 0 : 0.7 }}>
              <span>Scroll to synthesize</span>
              <span className={styles.cueDot} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
