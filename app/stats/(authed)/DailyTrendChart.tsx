"use client";

// Interactive daily-trend chart for the Stats Overview.
// - Range pills: 7 (default), 30, 90 days. Slicing happens client-side
//   from a single 90-day fetch so switching is instant.
// - Vertical gridline per day; hovering anywhere over a day's column
//   highlights it and shows a tooltip with the date and all three
//   series values for that day.
// - Server passes data ascending by date.

import { useMemo, useRef, useState } from "react";

export type TrendPoint = {
  day: string;
  visitors: number;
  players: number;
  solvers: number;
};

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

type SeriesDef = {
  key: "visitors" | "players" | "solvers";
  label: string;
  color: string;
};

const SERIES: SeriesDef[] = [
  { key: "visitors", label: "Visitors", color: "var(--color-ink)" },
  { key: "players", label: "Engaged players", color: "#b88a3a" },
  { key: "solvers", label: "Solvers", color: "#7a9070" },
];

export function DailyTrendChart({ data }: { data: TrendPoint[] }) {
  const [range, setRange] = useState<Range>(7);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const view = useMemo(() => data.slice(-range), [data, range]);
  const n = view.length;

  // ViewBox layout. Width is arbitrary; the SVG is responsive via w-full.
  const W = 800;
  const H = 240;
  const PADL = 40;
  const PADR = 16;
  const PADT = 16;
  const PADB = 36;

  const max = Math.max(
    1,
    ...view.flatMap((p) => [p.visitors, p.players, p.solvers])
  );

  const xAt = (i: number) =>
    n === 1
      ? PADL + (W - PADL - PADR) / 2
      : PADL + (i * (W - PADL - PADR)) / (n - 1);
  const yAt = (v: number) =>
    H - PADB - (v / max) * (H - PADT - PADB);

  // Smart x-axis tick density.
  const tickEvery = n <= 7 ? 1 : n <= 14 ? 2 : n <= 30 ? 5 : 10;
  const xLabelIndices = view
    .map((_, i) => i)
    .filter((i) => i === 0 || i === n - 1 || i % tickEvery === 0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const xView = xRatio * W;
    if (n === 1) {
      setActiveIdx(0);
      return;
    }
    const i = Math.round(((xView - PADL) / (W - PADL - PADR)) * (n - 1));
    setActiveIdx(Math.max(0, Math.min(n - 1, i)));
  };

  const tooltipLeftPct = activeIdx != null ? (xAt(activeIdx) / W) * 100 : 0;
  const flipLeft = activeIdx != null && activeIdx > n / 2;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        {RANGES.map((r) => {
          const active = range === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRange(r);
                setActiveIdx(null);
              }}
              aria-pressed={active}
              className={
                active
                  ? "text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-cream)]"
                  : "text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-[color:var(--color-rule)] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
              }
            >
              {r}d
            </button>
          );
        })}
      </div>

      <div className="relative" ref={containerRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          role="img"
          aria-label={`Daily trend, last ${range} days`}
          onMouseMove={onMove}
          onMouseLeave={() => setActiveIdx(null)}
        >
          {/* Top gridline (max) */}
          <line
            x1={PADL}
            y1={PADT}
            x2={W - PADR}
            y2={PADT}
            stroke="var(--color-rule)"
            strokeWidth="0.5"
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
          {/* Baseline */}
          <line
            x1={PADL}
            y1={H - PADB}
            x2={W - PADR}
            y2={H - PADB}
            stroke="var(--color-rule)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          {/* Per-day vertical gridlines */}
          {view.map((_, i) => (
            <line
              key={i}
              x1={xAt(i)}
              y1={PADT}
              x2={xAt(i)}
              y2={H - PADB}
              stroke="var(--color-rule)"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Active-day highlight */}
          {activeIdx != null && (
            <line
              x1={xAt(activeIdx)}
              y1={PADT}
              x2={xAt(activeIdx)}
              y2={H - PADB}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.4"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Y-axis labels */}
          <text
            x={PADL - 6}
            y={H - PADB + 3}
            textAnchor="end"
            fontSize="10"
            fill="currentColor"
            opacity="0.55"
          >
            0
          </text>
          <text
            x={PADL - 6}
            y={PADT + 4}
            textAnchor="end"
            fontSize="10"
            fill="currentColor"
            opacity="0.55"
          >
            {max}
          </text>

          {/* X-axis labels */}
          {xLabelIndices.map((i) => {
            const isFirst = i === 0;
            const isLast = i === n - 1;
            return (
              <text
                key={i}
                x={xAt(i)}
                y={H - PADB + 14}
                textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                fontSize="10"
                fill="currentColor"
                opacity="0.55"
              >
                {view[i].day.slice(5)}
              </text>
            );
          })}

          {/* Series lines + dots */}
          {SERIES.map((s) => {
            const pts = view
              .map((p, i) => `${xAt(i)},${yAt(p[s.key])}`)
              .join(" ");
            return (
              <g key={s.key}>
                <polyline
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={pts}
                  vectorEffect="non-scaling-stroke"
                />
                {view.map((p, i) => (
                  <circle
                    key={i}
                    cx={xAt(i)}
                    cy={yAt(p[s.key])}
                    r={activeIdx === i ? 4 : 2.5}
                    fill={s.color}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {activeIdx != null && (
          <div
            className="pointer-events-none absolute z-10 px-2.5 py-2 rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-cream)] text-xs leading-tight shadow-sm"
            style={{
              left: `${tooltipLeftPct}%`,
              top: 0,
              transform: flipLeft
                ? "translate(calc(-100% - 8px), 0)"
                : "translate(8px, 0)",
              minWidth: "9rem",
            }}
          >
            <div className="font-medium mb-1 tabular-nums">
              {view[activeIdx].day}
            </div>
            {SERIES.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between gap-3 tabular-nums"
              >
                <span className="flex items-center gap-1.5 text-[color:var(--color-muted)]">
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
                <span>{view[activeIdx][s.key].toLocaleString()}</span>
              </div>
            ))}
            {view[activeIdx].players > 0 && (
              <div className="mt-1 pt-1 border-t border-[color:var(--color-rule)] flex items-center justify-between gap-3 tabular-nums">
                <span className="text-[color:var(--color-muted)]">
                  Solve rate
                </span>
                <span>
                  {Math.round(
                    (view[activeIdx].solvers / view[activeIdx].players) * 100
                  )}
                  %
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[color:var(--color-muted)]">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
