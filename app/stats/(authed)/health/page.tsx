// Health page. Currently shows the precompute manifest from the
// 09:30 UTC cron run. Later this is where audit logs and error
// streams will land.

import { readManifest } from "../../../lib/metrics";
import type { PrecomputeManifest } from "../../../lib/metrics/runtime";

export const dynamic = "force-dynamic";

export default async function HealthStatsPage() {
  const manifest = (await readManifest()) as PrecomputeManifest | null;

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-4">Health</h1>

      <section className="mb-10">
        <h2 className="text-sm font-medium mb-3">Precompute cron · last run</h2>
        {!manifest ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            No manifest yet. The 09:30 UTC cron writes one each morning, or
            trigger one manually with{" "}
            <code className="text-xs">
              curl &quot;.../api/cron/stats-precompute?key=$CRON_SECRET&quot;
            </code>
            .
          </p>
        ) : (
          <div className="rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-cream)] p-4 text-sm">
            <p>
              Run at <span className="tabular-nums">{manifest.runAt}</span>
              {" · "}
              <span className="tabular-nums">{manifest.durationMs} ms</span>
            </p>
            <table className="mt-4 w-full text-xs tabular-nums">
              <thead className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                <tr>
                  <th className="text-left pb-1">Metric</th>
                  <th className="text-right pb-1">ms</th>
                  <th className="text-right pb-1">bytes</th>
                  <th className="text-left pl-3 pb-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(manifest.metrics).map(([key, r]) => (
                  <tr key={key} className="border-t border-[color:var(--color-rule)]">
                    <td className="py-1 pr-2 font-mono text-[10px]">{key}</td>
                    <td className="text-right">{r.ms}</td>
                    <td className="text-right">{r.bytes}</td>
                    <td className="pl-3">
                      {r.ok ? (
                        <span className="text-[color:var(--color-muted)]">ok</span>
                      ) : (
                        <span className="text-red-700">{r.error || "fail"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
