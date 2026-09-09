import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Route control flow only (IP + per-user rate limit, bearer auth,
// delegation). The import logic itself lives in app/lib/results-api.ts
// and is exercised via the shared handler / legacy route.
const rateLimit = vi.fn();
const getUserId = vi.fn();
const handleResultsImport = vi.fn();

vi.mock("../../../../lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("../../../../lib/supabase-server", () => ({
  getUserId: (...a: unknown[]) => getUserId(...a),
}));
vi.mock("../../../../lib/results-api", () => ({
  handleResultsImport: (...a: unknown[]) => handleResultsImport(...a),
}));

import { POST } from "./route";

const req = (token?: string) =>
  new Request("https://tesserapuzzle.com/api/v1/results/import", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ results: [] }),
  }) as never;

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue("u1");
  handleResultsImport.mockResolvedValue(
    Response.json({ ok: true, imported: 0, verified: 0 }),
  );
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/v1/results/import", () => {
  it("429s when the IP limit trips", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
  });

  it("429s when the per-user limit trips", async () => {
    rateLimit
      .mockResolvedValueOnce({ ok: true }) // IP
      .mockResolvedValueOnce({ ok: false, retryAfter: 60 }); // per-user
    expect((await POST(req())).status).toBe(429);
    expect(handleResultsImport).not.toHaveBeenCalled();
  });

  it("passes the bearer token through to getUserId and delegates", async () => {
    const res = await POST(req("jwt-abc"));
    expect(getUserId).toHaveBeenCalledWith(expect.any(Request));
    const passedReq = getUserId.mock.calls[0][0] as Request;
    expect(passedReq.headers.get("authorization")).toBe("Bearer jwt-abc");
    expect(handleResultsImport).toHaveBeenCalledWith(expect.any(Request), "u1");
    expect((await res.json())).toEqual({ ok: true, imported: 0, verified: 0 });
  });
});
