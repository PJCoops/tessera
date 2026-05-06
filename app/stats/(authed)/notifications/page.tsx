// Email + push subscriber counts and the push funnel for today.
// Two backends: subscriber counts come from Upstash (HLEN/SCARD per
// locale); push_received / push_clicked come from PostHog.

import { hogql } from "../../../lib/posthog-api";
import { EXCLUDE } from "../../_lib";
import { Big, Section, fmt } from "../../_components";
import { subscriberCounts } from "../../../lib/subscribers";
import { pushSubscriberCount } from "../../../lib/push-subscribers";
import { LOCALES } from "../../../lib/i18n";

export const dynamic = "force-dynamic";

type PushFunnelRow = { received: number; clicked: number };

export default async function NotificationsStatsPage() {
  let pushFunnel: PushFunnelRow[] = [];
  let pushSubs = 0;
  let emailSubs = 0;
  let error: string | null = null;

  try {
    [pushFunnel] = await Promise.all([
      hogql<PushFunnelRow>(`
        SELECT
          toInt(countIf(event = 'push_received')) AS received,
          toInt(countIf(event = 'push_clicked')) AS clicked
        FROM events
        WHERE event IN ('push_received', 'push_clicked')
          AND toDate(timestamp) = today()${EXCLUDE}
      `),
    ]);

    // Subscriber counts (Redis HLEN/SCARD per locale, summed). Failure
    // here just leaves the counts at 0.
    try {
      const [emailByLocale, pushByLocale] = await Promise.all([
        subscriberCounts(),
        Promise.all(LOCALES.map((l) => pushSubscriberCount(l))),
      ]);
      emailSubs = Object.values(emailByLocale).reduce((s, n) => s + n, 0);
      pushSubs = pushByLocale.reduce((s, n) => s + n, 0);
    } catch (e) {
      console.error("[stats/notifications] subscriber counts:", e);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const pf = pushFunnel[0] ?? { received: 0, clicked: 0 };
  const pushClickRate = pf.received ? (pf.clicked / pf.received) * 100 : 0;

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-6">Notifications</h1>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Failed to load notification stats</p>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : (
        <Section title="Daily reminder reach + push funnel" freshness="live">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Big label="Email subscribers" value={fmt(emailSubs)} suffix="all locales" />
            <Big label="Push subscribers" value={fmt(pushSubs)} suffix="all locales" />
            <Big label="Push received today" value={fmt(pf.received)} />
            <Big
              label="Push clicks today"
              value={fmt(pf.clicked)}
              suffix={pf.received ? `${pushClickRate.toFixed(0)}% click-through` : undefined}
            />
          </div>
          <p className="mt-4 text-[10px] text-[color:var(--color-muted)] max-w-prose">
            Push events fire from the service worker via /api/events/push.
            Receives won't show until the 09:00 UTC daily cron has fired
            since the SW started tracking. Click-through is clicks ÷ receives,
            capped at 100%.
          </p>
        </Section>
      )}
    </div>
  );
}
