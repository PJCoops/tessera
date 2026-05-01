// Server-side PostHog Query API helper. Personal API keys must never reach
// the client — this module only runs in server components / route handlers.
//
// No caching layer: the /stats page is force-dynamic and only hit a handful
// of times a day. Adding a cache (Next's unstable_cache or otherwise) just
// hides freshness bugs. Every page render = a fresh PostHog query.

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

export async function hogql<T>(query: string): Promise<T[]> {
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
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PostHog query failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as QueryResponse;
  const cols = data.columns ?? [];
  const rows = data.results ?? [];
  return rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])) as T);
}
