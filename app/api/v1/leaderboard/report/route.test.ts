import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();
const getUserId = vi.fn();
const getDb = vi.fn();
const reportScore = vi.fn();

vi.mock("../../../../lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("../../../../lib/supabase-server", () => ({
  getUserId: (...a: unknown[]) => getUserId(...a),
}));
vi.mock("../../../../lib/db", () => ({
  getDb: (...a: unknown[]) => getDb(...a),
}));
vi.mock("../../../../lib/leaderboard-store", () => ({
  reportScore: (...a: unknown[]) => reportScore(...a),
}));

import { POST } from "./route";

const req = (body: unknown) =>
  new Request("https://tesserapuzzle.com/api/v1/leaderboard/report", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue("u1");
  getDb.mockReturnValue({});
  reportScore.mockResolvedValue({ ok: true });
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/v1/leaderboard/report", () => {
  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await POST(req({ mode: "classic", num: 1, handle: "x" }))).status).toBe(401);
  });

  it("429s when the per-user daily cap trips", async () => {
    rateLimit.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, retryAfter: 3600 });
    const res = await POST(req({ mode: "classic", num: 1, handle: "x" }));
    expect(res.status).toBe(429);
    expect(reportScore).not.toHaveBeenCalled();
  });

  it("400s on bad input", async () => {
    expect((await POST(req({ mode: "bogus", num: 1, handle: "x" }))).status).toBe(400);
    expect((await POST(req({ mode: "classic", num: 0, handle: "x" }))).status).toBe(400);
    expect((await POST(req({ mode: "classic", num: 1 }))).status).toBe(400);
  });

  it("404s on an unknown handle / no verified row", async () => {
    reportScore.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await POST(req({ mode: "classic", num: 5, handle: "nobody" }));
    expect(res.status).toBe(404);
    expect((await res.json()).reason).toBe("not_found");
  });

  it("400s when reporting yourself", async () => {
    reportScore.mockResolvedValue({ ok: false, reason: "self" });
    const res = await POST(req({ mode: "classic", num: 5, handle: "me" }));
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("self");
  });

  it("resolves the report by (mode, num, handle) — never a user id from the client", async () => {
    const res = await POST(req({ mode: "hard", num: 42, handle: "Alice" }));
    expect(reportScore).toHaveBeenCalledWith(expect.anything(), "u1", "hard", 42, "Alice");
    expect((await res.json()).ok).toBe(true);
  });
});
