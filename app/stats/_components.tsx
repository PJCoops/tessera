// Shared rendering components for every /stats page. Pulled out of
// the original monolith so per-section pages don't reimplement them.
// Pure server-render-friendly — no client hooks, no state.

import { TIER_COLORS } from "../lib/tier";

export type TierRow = { tier: string; solves: number };
export type CohortRow = {
  cohort_week: string;
  cohort_size: number;
  d1: number;
  d3: number;
  d7: number;
  d14: number;
  d30: number;
};

export const TIER_ORDER = ["Legendary", "Genius", "Wordsmith", "Persistent", "Tenacious"] as const;
export const TIER_BAR_COLORS: Record<(typeof TIER_ORDER)[number], string> = {
  Legendary: TIER_COLORS.legendary,
  Genius: TIER_COLORS.genius,
  Wordsmith: TIER_COLORS.wordsmith,
  Persistent: TIER_COLORS.persistent,
  Tenacious: TIER_COLORS.tenacious,
};
// HogQL fragment that turns a `properties.moves` count into a tier
// label. Mirrors the thresholds in lib/tier.ts; if those move, edit
// here too. Pasted into every tier-bucketing query as `${TIER_SQL}`.
export const TIER_SQL = `
  multiIf(
    toInt(toString(properties.moves)) <= 10, 'Legendary',
    toInt(toString(properties.moves)) <= 20, 'Genius',
    toInt(toString(properties.moves)) <= 35, 'Wordsmith',
    toInt(toString(properties.moves)) <= 60, 'Persistent',
    'Tenacious'
  )
`;

// Sort tier rows into the canonical order so the bars always read
// Legendary → Tenacious left to right, with empty buckets present.
export function sortTiers(rows: TierRow[]): TierRow[] {
  return TIER_ORDER.map((t) => rows.find((r) => r.tier === t) ?? { tier: t, solves: 0 });
}

export function fmt(n: number): string {
  return n.toLocaleString();
}

export type Freshness = "live" | "daily" | "static";

export function FreshnessChip({ kind }: { kind: Freshness }) {
  const label =
    kind === "live"
      ? "Live · 60s"
      : kind === "daily"
      ? "Daily · 09:30 UTC"
      : "Static";
  const title =
    kind === "live"
      ? "Cached on the server for up to 60 seconds. Hit Refresh to force a re-pull from PostHog."
      : kind === "daily"
      ? "Refreshed once a day at 09:30 UTC by the precompute cron. Won't change between then and the next run."
      : "Derived metadata. Doesn't change often.";
  return (
    <span
      title={title}
      className="text-[9px] uppercase tracking-wider text-[color:var(--color-muted)] border border-[color:var(--color-rule)] px-1.5 py-0.5 rounded"
    >
      {label}
    </span>
  );
}

export function Section({
  title,
  children,
  freshness,
}: {
  title: string;
  children: React.ReactNode;
  freshness?: Freshness;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {freshness && <FreshnessChip kind={freshness} />}
      </div>
      {children}
    </section>
  );
}

export function Hero({
  label,
  value,
  suffix,
  today,
}: {
  label: string;
  value: string;
  suffix?: string;
  // Optional "today" sub-stat in the top-right so the big number
  // stays the all-time figure but a glance still shows live activity.
  today?: string;
}) {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-lg p-6 bg-[color:var(--color-cream)]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</p>
        {today && (
          <p className="text-[10px] tabular-nums text-[color:var(--color-muted)]">
            <span className="text-[color:var(--color-ink)] font-medium">{today}</span> today
          </p>
        )}
      </div>
      <p className="text-5xl sm:text-6xl font-light tabular-nums mt-2 leading-none tracking-tight">
        {value}
      </p>
      {suffix && (
        <p className="text-[11px] text-[color:var(--color-muted)] mt-2">all time · {suffix}</p>
      )}
    </div>
  );
}

export function Big({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-md p-4">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</p>
      <p className="text-3xl font-light tabular-nums mt-1 leading-tight">{value}</p>
      {suffix && (
        <p className="text-[11px] text-[color:var(--color-muted)] mt-1">{suffix}</p>
      )}
    </div>
  );
}

export function Highlight({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border border-[color:var(--color-rule)] rounded-md p-4">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</p>
      <p className="text-xl font-light tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-[color:var(--color-muted)] mt-0.5">{sub}</p>}
    </div>
  );
}

export function BarCell({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 bg-[color:var(--color-cream)] rounded-sm overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right tabular-nums text-[color:var(--color-ink-soft)]">{value}</span>
    </div>
  );
}

export function TierBar({ rows, total }: { rows: TierRow[]; total: number }) {
  return (
    <div className="space-y-2">
      <div className="flex w-full h-6 rounded-md overflow-hidden border border-[color:var(--color-rule)]">
        {rows.map((r) => {
          const pct = total ? (r.solves / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={r.tier}
              title={`${r.tier}: ${r.solves} (${pct.toFixed(0)}%)`}
              style={{
                width: `${pct}%`,
                background: TIER_BAR_COLORS[r.tier as keyof typeof TIER_BAR_COLORS],
              }}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1 text-xs">
        {rows.map((r) => {
          const pct = total ? (r.solves / total) * 100 : 0;
          return (
            <div key={r.tier} className="flex items-center gap-1.5 tabular-nums">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ background: TIER_BAR_COLORS[r.tier as keyof typeof TIER_BAR_COLORS] }}
              />
              <span className="text-[color:var(--color-muted)]">{r.tier}</span>
              <span className="ml-auto">
                {r.solves} · {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

export function Empty() {
  return <p className="text-xs text-[color:var(--color-muted)] italic">No data yet</p>;
}

export function CohortTable({ rows }: { rows: CohortRow[] }) {
  if (rows.length === 0) return <Empty />;
  const cols: { key: keyof Omit<CohortRow, "cohort_week" | "cohort_size">; label: string }[] = [
    { key: "d1", label: "D1" },
    { key: "d3", label: "D3" },
    { key: "d7", label: "D7" },
    { key: "d14", label: "D14" },
    { key: "d30", label: "D30" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
            <th className="text-left font-normal py-1 pr-3">Cohort week</th>
            <th className="text-right font-normal py-1 px-2">Size</th>
            {cols.map((c) => (
              <th key={c.key} className="text-right font-normal py-1 px-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cohort_week} className="border-t border-[color:var(--color-rule)]">
              <td className="py-1.5 pr-3 text-[color:var(--color-muted)]">
                {r.cohort_week.slice(0, 10)}
              </td>
              <td className="py-1.5 px-2 text-right">{r.cohort_size}</td>
              {cols.map((c) => {
                const value = r[c.key];
                const pct = r.cohort_size > 0 ? (value / r.cohort_size) * 100 : 0;
                return (
                  <td key={c.key} className="py-1 px-2 text-right">
                    <CohortCell value={value} pct={pct} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CohortCell({ value, pct }: { value: number; pct: number }) {
  // Heatmap: deeper sage as retention rises. Empty cells render flat
  // so sparse cohorts don't pretend to have data.
  const intensity = Math.min(1, pct / 50); // 50% retention = full sage
  const bg = value === 0 ? "transparent" : `rgba(122, 144, 112, ${0.1 + intensity * 0.6})`;
  return (
    <span className="inline-block min-w-[3.5rem] px-2 py-1 rounded-sm" style={{ background: bg }}>
      {value === 0 ? (
        <span className="text-[color:var(--color-muted)]">—</span>
      ) : (
        <>
          <span>{pct.toFixed(0)}%</span>
          <span className="text-[10px] text-[color:var(--color-muted)] ml-1">({value})</span>
        </>
      )}
    </span>
  );
}
