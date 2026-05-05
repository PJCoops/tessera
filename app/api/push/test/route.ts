// Push-only test endpoint. Fans out push notifications to every push
// subscriber, identical payload to the daily-reminder cron, but
// touches NO email subscribers. Use this for device testing instead
// of hitting /api/cron/daily-reminder.
//
// Auth: same `?key=$CRON_SECRET` (or Bearer header) as the cron, so
// the route isn't a free spam button on the public internet.
//
// On 404/410 from web-push, the corresponding subscription is dropped
// from Upstash — same behaviour as the real cron.

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import {
  listPushSubscribers,
  removePushSubscriberFromAll,
} from "../../../lib/push-subscribers";
import { LOCALES, getDictionary, t } from "../../../lib/i18n";
import { puzzleNumber, todayUtc } from "../../../lib/rng";
import { EPOCH } from "../../../lib/epoch";

const CONCURRENCY = 8;

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

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:hello@tesserapuzzle.com";
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ ok: false, reason: "vapid_not_configured" }, { status: 503 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const todayNum = puzzleNumber(todayUtc(), EPOCH);
  const perLocale: Record<
    string,
    { attempted: number; succeeded: number; failed: number; expired: number }
  > = {};

  for (const locale of LOCALES) {
    const subs = await listPushSubscribers(locale);
    perLocale[locale] = { attempted: subs.length, succeeded: 0, failed: 0, expired: 0 };
    if (subs.length === 0) continue;

    const dict = getDictionary(locale);
    const localePath = locale === "en" ? "/" : `/${locale}`;
    const payload = JSON.stringify({
      title: t(dict, "push.dailyTitle"),
      body: t(dict, "push.dailyBody", { num: todayNum }),
      url: localePath,
      tag: "tessera-daily-test",
    });

    const queue = [...subs];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const sub = queue.shift();
        if (!sub) break;
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload,
            { TTL: 60 * 60 }
          );
          perLocale[locale].succeeded++;
        } catch (e: unknown) {
          const err = e as { statusCode?: number };
          if (err.statusCode === 404 || err.statusCode === 410) {
            perLocale[locale].expired++;
            removePushSubscriberFromAll(sub.endpoint, LOCALES).catch(() => {});
          } else {
            perLocale[locale].failed++;
          }
        }
      }
    });
    await Promise.all(workers);
  }

  return NextResponse.json({ ok: true, todayNum, perLocale, note: "push only — no email touched" });
}
