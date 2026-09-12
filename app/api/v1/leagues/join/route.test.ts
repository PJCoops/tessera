import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();
const getUserId = vi.fn();
const getDb = vi.fn();
const joinByCode = vi.fn();

vi.mock("../../../../lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("../../../../lib/supabase-server", () => ({
  getUserId: (...a: unknown[]) => getUserId(...a),
}));
vi.mock("../../../../lib/db", () => ({
  getDb: (...a: unknown[]) => getDb(...a),
}));
vi.mock("../../../../lib/leagues-store", () => ({
  joinByCode: (...a: unknown[]) => joinByCode(...a),
}));

import { POST } from "./route";

const req = (body: unknown, token?: string) =>
  new Request("https://tesserapuzzle.com/api/v1/leagues/join", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  }) as never;

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue("u1");
  getDb.mockReturnValue({});
  joinByCode.mockResolvedValue({ ok: true, league: { id: "l1", name: "Family" } });
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/v1/leagues/join", () => {
  it("passes the bearer request through to getUserId (regression: this used to call getUserId() with no args, so a mobile bearer token never authenticated)", async () => {
    await POST(req({ code: "ABC12345" }, "jwt-abc"));
    expect(getUserId).toHaveBeenCalledWith(expect.anything());
  });

  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await POST(req({ code: "ABC12345" }))).status).toBe(401);
  });

  it("400s on missing code", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("404s with the same reason for a wrong code as a no-such-league (no enumeration)", async () => {
    joinByCode.mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await POST(req({ code: "ZZZZZZZZ" }));
    expect(res.status).toBe(404);
    expect((await res.json()).reason).toBe("not_found");
  });

  it("joins on a valid code", async () => {
    const res = await POST(req({ code: "ABC12345" }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.league.name).toBe("Family");
  });
});
