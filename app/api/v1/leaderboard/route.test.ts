import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const rateLimit = vi.fn();
const getUserId = vi.fn();
const getDb = vi.fn();
const getLeaderboard = vi.fn();

vi.mock("../../../lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("../../../lib/supabase-server", () => ({
  getUserId: (...a: unknown[]) => getUserId(...a),
}));
vi.mock("../../../lib/db", () => ({
  getDb: (...a: unknown[]) => getDb(...a),
}));
vi.mock("../../../lib/leaderboard-store", () => ({
  getLeaderboard: (...a: unknown[]) => getLeaderboard(...a),
}));

import { GET } from "./route";

const req = (qs: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://tesserapuzzle.com/api/v1/leaderboard${qs}`, { headers });

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue(null);
  getDb.mockReturnValue({});
  getLeaderboard.mockResolvedValue({
    global: [],
    country: [],
    me: { global: null, country: null },
    hasHandle: false,
  });
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/v1/leaderboard", () => {
  it("429s when rate limited", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 12 });
    const res = await GET(req("?mode=classic&num=1"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
  });

  it("503s when the DB isn't configured", async () => {
    getDb.mockReturnValueOnce(null);
    expect((await GET(req("?mode=classic&num=1"))).status).toBe(503);
  });

  it("400s on a missing/invalid num", async () => {
    expect((await GET(req("?mode=classic"))).status).toBe(400);
    expect((await GET(req("?mode=classic&num=0"))).status).toBe(400);
  });

  it("is public — no 401 for a signed-out / unauthenticated caller", async () => {
    getUserId.mockResolvedValue(null);
    const res = await GET(req("?mode=classic&num=5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signedIn).toBe(false);
  });

  it("passes the bearer request through to getUserId and reports signedIn", async () => {
    getUserId.mockResolvedValue("u1");
    const res = await GET(req("?mode=hard&num=5"));
    expect(getUserId).toHaveBeenCalledWith(expect.anything());
    expect(getLeaderboard).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mode: "hard", num: 5, userId: "u1" }),
    );
    const body = await res.json();
    expect(body.signedIn).toBe(true);
  });

  it("reads the country from x-vercel-ip-country, else null", async () => {
    const res = await GET(req("?mode=classic&num=5", { "x-vercel-ip-country": "GB" }));
    const body = await res.json();
    expect(body.country.code).toBe("GB");

    const res2 = await GET(req("?mode=classic&num=5"));
    const body2 = await res2.json();
    expect(body2.country.code).toBeNull();
  });
});
