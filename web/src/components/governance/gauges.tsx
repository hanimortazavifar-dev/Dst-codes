import { useEffect, useState } from "react";
import { fa, prefersReducedMotion } from "../../lib/format";
import styles from "./Governance.module.css";

type Point = [number, number];

/** Point on a semicircle: f=0 is the left end, f=1 the right end. */
const polar = (cx: number, cy: number, f: number, r: number): Point => {
  const a = Math.PI * (1 - f);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
};

/** Animates a needle angle (0–180°) from 0 to `target` with an ease-out over 1.1 s. */
function useNeedleAngle(target: number) {
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setAngle(target);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1100);
      setAngle(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return angle;
}

const clampPct = (p: number) => Math.max(0, Math.min(100, p));

/** Small semicircle gauge for the goal-achievement KPI. */
export function MiniGauge({ percent }: { percent: number }) {
  const p = clampPct(percent);
  const CX = 60, CY = 52, R = 42, T = 9;
  const arc = (f1: number, f2: number) => `M${polar(CX, CY, f1, R)} A${R} ${R} 0 0 1 ${polar(CX, CY, f2, R)}`;
  const color = p >= 80 ? "#3DBE6A" : p >= 50 ? "#FDB913" : "#E5484D";
  const angle = useNeedleAngle((180 * p) / 100);

  return (
    <svg viewBox="0 0 120 64" className={styles.minigauge} role="img" aria-label={`درصد تحقق اهداف ${fa(p)} درصد`}>
      <path d={arc(0.003, 0.997)} fill="none" stroke="#3A3435" strokeWidth={T} strokeLinecap="round" />
      {p > 0.3 && <path d={arc(0.003, Math.max(0.003, p / 100 - 0.003))} fill="none" stroke={color} strokeWidth={T} strokeLinecap="round" />}
      <g transform={`rotate(${angle} ${CX} ${CY})`}>
        <polygon points={`${CX - R + 10},${CY} ${CX},${CY - 3} ${CX},${CY + 3}`} fill="#F3EFEA" />
      </g>
      <circle cx={CX} cy={CY} r="6" fill="#F3EFEA" />
      <circle cx={CX} cy={CY} r="2.4" fill="#231F20" />
    </svg>
  );
}

const ZONES: [number, number, string, string][] = [
  [0, 0.25, "#E5484D", "کم"],
  [0.25, 0.5, "#FDB913", "متوسط"],
  [0.5, 1, "#3DBE6A", "مناسب"],
];

/** Graduated tank-inventory gauge: coloured zones, ticks every 250 L, labels every 1000 L. */
export function TankGauge({ inventory, capacity }: { inventory: number; capacity: number }) {
  const p = clampPct((inventory / capacity) * 100);
  const CX = 170, CY = 165, R = 122, T = 36;
  const pt = (f: number, r: number) => polar(CX, CY, f, r);
  const segment = (f1: number, f2: number, r0: number, r1: number) =>
    `M${pt(f1, r1)} A${r1} ${r1} 0 0 1 ${pt(f2, r1)} L${pt(f2, r0)} A${r0} ${r0} 0 0 0 ${pt(f1, r0)} Z`;
  const angle = useNeedleAngle((180 * p) / 100);

  const ticks = [];
  for (let v = 0; v <= capacity; v += 250) {
    const f = v / capacity;
    const major = v % 1000 === 0;
    const [x1, y1] = pt(f, R + 3);
    const [x2, y2] = pt(f, R + (major ? 13 : 8));
    ticks.push(<line key={`t${v}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8a94a8" strokeWidth={major ? 2 : 1} />);
    if (major) {
      const [qx, qy] = pt(f, R + 26);
      ticks.push(
        <text key={`l${v}`} x={qx} y={qy + 3} textAnchor="middle" fontSize="10" fill="#A39B96">
          {fa(v)}
        </text>,
      );
    }
  }

  return (
    <svg viewBox="0 0 340 200" className={styles.gaugesvg} role="img" aria-label={`موجودی مخزن ${fa(p)} درصد`}>
      {ZONES.map(([f1, f2, color, label]) => {
        const [mx, my] = pt((f1 + f2) / 2, R - T / 2);
        return (
          <g key={label}>
            <path d={segment(f1 + 0.003, f2 - 0.003, R - T, R)} fill={color} opacity=".92" />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#101010">
              {label}
            </text>
          </g>
        );
      })}
      {ticks}
      <g transform={`rotate(${angle} ${CX} ${CY})`}>
        <polygon points={`${CX - R + 8},${CY} ${CX},${CY - 4} ${CX},${CY + 4}`} fill="#F3EFEA" />
      </g>
      <circle cx={CX} cy={CY} r="12" fill="#F3EFEA" />
      <circle cx={CX} cy={CY} r="4.5" fill="#231F20" />
    </svg>
  );
}
