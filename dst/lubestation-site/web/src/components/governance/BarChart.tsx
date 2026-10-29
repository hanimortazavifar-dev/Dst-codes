import type { Bar } from "../../data/dealers";
import { fa } from "../../lib/format";
import styles from "./Governance.module.css";

/** Rounds up to 2, 5 or 10 × a power of ten, for a clean y-axis top. */
function niceTop(v: number) {
  if (v <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / mag;
  return (f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

/** Dashboard-style vertical bar chart (same look as the weekly consumption chart). */
export default function BarChart({ data, label, unit = "لیتر", labelEvery = 1, highlightLast = false }: {
  data: Bar[];
  /** Accessible name of the chart. */
  label: string;
  unit?: string;
  /** Show every n-th x label (for dense charts such as 24 hours). */
  labelEvery?: number;
  highlightLast?: boolean;
}) {
  if (!data.length || data.every((d) => d.value === 0)) return <p className={styles.empty}>داده‌ای برای این نمودار ثبت نشده است.</p>;
  const W = 640, H = 240, PL = 48, PR = 12, PT = 18, PB = 38;
  const ymax = niceTop(Math.max(...data.map((d) => d.value)));
  const bw = (W - PL - PR) / data.length;
  const y = (v: number) => PT + ((ymax - v) / ymax) * (H - PT - PB);
  const peak = Math.max(...data.map((d) => d.value));

  return (
    // Time runs left to right, as on the management dashboard, even inside RTL pages.
    <svg className={styles.chart} style={{ direction: "ltr" }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, 1, 2, 3, 4].map((t) => {
        const v = (ymax * t) / 4;
        return (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#3A3435" />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end" fill="#A39B96" fontSize="11">
              {fa(v)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = PL + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const h = Math.max(0, (d.value / ymax) * (H - PT - PB));
        const top = H - PB - h;
        const strong = highlightLast ? i === data.length - 1 : d.value === peak;
        return (
          <g key={i}>
            <rect x={x} y={top} width={w} height={h} rx="3" fill={strong ? "#FDB913" : "#DDA73A"} opacity={strong ? 1 : 0.8}>
              <title>{`${d.title ?? d.label}: ${fa(d.value)} ${unit}`}</title>
            </rect>
            {strong && d.value > 0 && (
              <text x={x + w / 2} y={top - 6} textAnchor="middle" fill="#F3EFEA" fontSize="11" fontWeight="700">
                {fa(d.value)}
              </text>
            )}
            {i % labelEvery === 0 && (
              <text x={x + w / 2} y={H - PB + 16} textAnchor="middle" fill="#A39B96" fontSize="10.5">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
