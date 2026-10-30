import { useEffect, useRef, useState } from "react";
import schematic from "../assets/catalog/schematic.webp";
import { prefersReducedMotion } from "../lib/format";
import styles from "./SchematicDiagram.module.css";

/*
 * The schematic image with an animated SVG overlay drawn in the image's own pixel space (1600 × 1029):
 * oil flowing through the pipes, the pump fan turning, oil moving in the tank, drops at the nozzle,
 * current along the electrical lines, the meter signal, and live readings on both displays.
 */
const W = 1600;
const H = 1029;

/** Oil pipes (flow direction), drawn over the dotted orange lines of the image. */
const OIL_PIPES = ["M283 286H380", "M557 286H667", "M866 286H1214", "M1315 362V402"];
/** Electrical wiring, drawn over the black/yellow lines of the image. */
const POWER_LINES = [
  "M237 789H302",
  "M430 789H497",
  "M625 789H789",
  "M851 727V360",
  "M463 800V948H983V789H1034",
];
/** Pulse signal from the flow meter to the display (split around the label pill). */
const SIGNAL_LINES = ["M1393 286H1485V686H1407", "M1230 686H1097V714"];

/** Oil surface inside the tank: a repeating wave, wider than the glass so it can slide sideways. */
const WAVE = 46;
const OIL_TOP = 281;
const oilPath = (() => {
  let d = `M${149 - 2 * WAVE} ${OIL_TOP}`;
  for (let x = 149 - 2 * WAVE; x < 242 + WAVE; x += WAVE) {
    d += ` q${WAVE / 4} -5 ${WAVE / 2} 0 t${WAVE / 2} 0`;
  }
  return `${d} V350 H${149 - 2 * WAVE} Z`;
})();

const TANK_TICKS = [243, 264, 286, 308, 329];
const BUBBLES = [
  { x: 172, r: 3.5, delay: "0s" },
  { x: 204, r: 4.5, delay: "1.1s" },
  { x: 224, r: 3, delay: "2.3s" },
];

export default function SchematicDiagram() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const [dispensed, setDispensed] = useState(0);
  const [rate, setRate] = useState(12.5);

  // Animate only while the diagram is on screen, and never with reduced motion.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || prefersReducedMotion()) return;
    const io = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const next = 12.5 + (Math.random() - 0.5) * 0.4;
      setRate(next);
      setDispensed((v) => (v + next / 300 >= 100 ? 0 : v + next / 300));
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${running ? styles.running : ""}`}>
      <img
        className={styles.img}
        src={schematic}
        width={W}
        height={H}
        alt="نقشهٔ شماتیک دستگاه: مسیر هیدرولیک (مخزن، فیلتر، پمپ، لیترشمار، نازل) و مسیر الکتریکی (ورودی برق، فیوز، کلید E-Stop، کنتاکتور، نمایشگر)"
        loading="lazy"
      />
      <svg className={styles.overlay} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <clipPath id="sd-tank">
            <rect x="149" y="233" width="93" height="109" rx="11" />
          </clipPath>
          <linearGradient id="sd-oil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbb42a" />
            <stop offset="1" stopColor="#e2850f" />
          </linearGradient>
          <radialGradient id="sd-fan" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#fcc04a" />
            <stop offset="1" stopColor="#e8901a" />
          </radialGradient>
          <radialGradient id="sd-drop" cx="0.35" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#ffd27a" />
            <stop offset="1" stopColor="#d97a06" />
          </radialGradient>
        </defs>

        {/* tank: moving oil surface, rising bubbles, level marks redrawn on top */}
        <g clipPath="url(#sd-tank)">
          <rect x="149" y="233" width="93" height="109" fill="#fdffff" />
          <g className={styles.level}>
            <path className={styles.wave} d={oilPath} fill="url(#sd-oil)" />
            {BUBBLES.map((b) => (
              <circle
                key={b.x}
                className={styles.bubble}
                style={{ animationDelay: b.delay }}
                cx={b.x}
                cy="336"
                r={b.r}
                fill="#fff"
              />
            ))}
          </g>
        </g>
        {TANK_TICKS.map((y) => (
          <path key={y} d={`M232 ${y}H239`} stroke="#8a96a3" strokeWidth="2.5" strokeLinecap="round" />
        ))}

        {/* oil flowing through the pipes */}
        {OIL_PIPES.map((d) => (
          <path key={d} className={`${styles.flow} ${styles.oil}`} d={d} />
        ))}

        {/* pump fan */}
        <g transform="translate(814 283.5)">
          <circle r="27.5" fill="#bb6510" />
          <circle r="23.5" fill="url(#sd-fan)" />
          <g className={styles.fan}>
            {[20, 110, 200, 290].map((a) => (
              <path
                key={a}
                d="M0 0L13 0"
                transform={`rotate(${a})`}
                stroke="#6b3a06"
                strokeWidth={a % 180 === 20 ? 6 : 5}
                strokeLinecap="round"
              />
            ))}
            <circle r="4" fill="#6b3a06" />
          </g>
        </g>

        {/* flow meter: live flow rate and blinking status LED */}
        <rect x="1276" y="262" width="54" height="31" rx="3" fill="#102215" />
        <text className={styles.digits} x="1303" y="284.5">
          {rate.toFixed(1)}
        </text>
        <circle className={styles.led} cx="1344" cy="307" r="5" fill="#40ca70" />

        {/* nozzle: drops forming at the tip and falling */}
        <g transform="translate(1248 487)">
          <path className={styles.drop} d="M0 -5C3 -1 5 2 5 5A5 5 0 0 1 -5 5C-5 2 -3 -1 0 -5Z" fill="url(#sd-drop)" />
          <ellipse className={styles.splash} cx="0" cy="64" rx="12" ry="3" fill="#e68f16" />
        </g>

        {/* electrical current and the meter signal */}
        {POWER_LINES.map((d) => (
          <path key={d} className={`${styles.flow} ${styles.power}`} d={d} />
        ))}
        {SIGNAL_LINES.map((d) => (
          <path key={d} className={`${styles.flow} ${styles.signal}`} d={d} />
        ))}

        {/* display: litres dispensed */}
        <rect x="1063" y="762" width="69" height="37" rx="2" fill="#101916" />
        <text className={styles.digits} x="1097.5" y="789">
          {dispensed.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}
