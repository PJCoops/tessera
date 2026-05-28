// Read-out for the social referral metrics. The dashboard hasn't been
// wired to the metrics dictionary yet, so this endpoint is the
// in-the-meantime way to look at how the daily social posts are
// performing. Both metrics are precomputed by the 09:30 UTC cron, so
// this route is a Redis read — no HogQL roundtrip on each call.
//
// Auth: same CRON_SECRET pattern as the rest of /api/internal. Returns
// a single JSON blob with both metrics, their refresh times, and
// staleness flags so consumers can spot a missed precompute run.

import { NextRequest, NextResponse } from "next/server";
import { getMetric } from "../../../lib/metrics";
import {
  socialReferralsLast7d,
  socialHourlyLast7d,
} from "../../../lib/metrics/definitions/social";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_secret_missing" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  if (auth !== `Bearer ${secret}` && queryKey !== secret) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const [referrals, hourly] = await Promise.all([
    getMetric(socialReferralsLast7d),
    getMetric(socialHourlyLast7d),
  ]);

  return NextResponse.json({
    ok: true,
    referrals: {
      refreshedAt: referrals.refreshedAt,
      stale: referrals.stale,
      rows: referrals.value,
    },
    hourly: {
      refreshedAt: hourly.refreshedAt,
      stale: hourly.stale,
      rows: hourly.value,
    },
  });
}
