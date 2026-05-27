// Primary trigger for the daily social-post workflow. Fired by Vercel Cron.
//
// Why this exists: GitHub's hosted `schedule:` cron is unreliable at
// popular times — it skipped 2026-05-26 entirely and ran 3+ hours late
// on adjacent days. Vercel Cron does not have that problem, so we use
// it to fire the GH workflow via `workflow_dispatch`. The GH `schedule:`
// trigger remains as a later-in-the-day backup (see daily-social-post.yml).
//
// Idempotency: before dispatching, we check the daily lock at
// /api/internal/social-lock. If it's set, today is already done and we
// no-op. The posting script also sets the lock at the end of a
// successful run, which covers the case where the backup GH schedule
// runs after Vercel already triggered.
//
// Required env:
//   CRON_SECRET         — same value as other crons; verified on the request
//   GH_DISPATCH_TOKEN   — fine-grained PAT (actions: read+write) for the repo
//   GH_REPO             — "owner/name", e.g. "PJCoops/tessera"
//   GH_WORKFLOW_FILE    — workflow filename, e.g. "daily-social-post.yml"
//   GH_WORKFLOW_REF     — branch to dispatch on (default "main")
//   APP_URL             — origin of this deployment, used to call the lock route

import { NextRequest, NextResponse } from "next/server";
import { todayUtc } from "../../../lib/rng";

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

  const token = process.env.GH_DISPATCH_TOKEN;
  const repo = process.env.GH_REPO;
  const workflow = process.env.GH_WORKFLOW_FILE || "daily-social-post.yml";
  const ref = process.env.GH_WORKFLOW_REF || "main";
  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  if (!token || !repo) {
    return NextResponse.json(
      { ok: false, reason: "gh_dispatch_not_configured" },
      { status: 503 },
    );
  }

  const today = todayUtc();

  // Pre-check the daily lock so we don't fire the workflow when it
  // already ran. The workflow re-checks too — this is just to avoid
  // burning a GH Actions minute when there's nothing to do.
  try {
    const lockRes = await fetch(`${appUrl}/api/internal/social-lock`, {
      headers: { authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (lockRes.ok) {
      const { locked } = (await lockRes.json()) as { locked: boolean };
      if (locked) {
        return NextResponse.json({ ok: true, skipped: "already_posted", date: today });
      }
    }
  } catch (err) {
    // Lock check is best-effort. If it fails we still dispatch — the
    // workflow has its own idempotency.
    console.warn("[daily-social] lock pre-check failed:", err);
  }

  const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
  const ghRes = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref }),
  });

  if (!ghRes.ok) {
    const body = await ghRes.text();
    return NextResponse.json(
      { ok: false, reason: "dispatch_failed", status: ghRes.status, body },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, dispatched: true, repo, workflow, ref, date: today });
}
