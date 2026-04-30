// Server-side PostHog Query API helper. Personal API keys must never reach
// the client — this module only runs in server components / route handlers.
import { unstable_cache } from "next/cache";

// Ingestion runs through eu.i.posthog.com but the Query API lives on the
// non-`i.` host. Derive the API host from the public ingestion host so we
// keep one source of truth.
const INGEST_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
const API_HOST = INGEST_HOST.replace("eu.i.posthog.com", "eu.posthog.com").replace(
  "us.i.posthog.com",
  "us.posthog.com"
);

type QueryResponse = {
  columns?: string[];
  results?: unknown[][];
};

async function rawQuery<T>(query: string): Promise<T[]> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!key || !projectId) {
    throw new Error("PostHog API not configured (missing POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID)");
  }
  const res = await fetch(`${API_HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    throw new Error(`PostHog query failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as QueryResponse;
  const cols = data.columns ?? [];
  const rows = data.results ?? [];
  return rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])) as T);
}

// Cache each distinct query for 5 minutes so refreshing the dashboard doesn't
// hammer PostHog's quota.
export const hogql = unstable_cache(rawQuery, ["hogql"], { revalidate: 300 });
