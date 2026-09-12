import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();
const getUserId = vi.fn();
const getDb = vi.fn();
const exportAccountData = vi.fn();

vi.mock("../../../../lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("../../../../lib/supabase-server", () => ({
  getUserId: (...a: unknown[]) => getUserId(...a),
}));
vi.mock("../../../../lib/db", () => ({
  getDb: (...a: unknown[]) => getDb(...a),
}));
vi.mock("../../../../lib/account-store", () => ({
  exportAccountData: (...a: unknown[]) => exportAccountData(...a),
}));

import { GET } from "./route";

const req = (token?: string) =>
  new Request("https://tesserapuzzle.com/api/v1/account/export", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  }) as never;

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue("u1");
  getDb.mockReturnValue({});
  exportAccountData.mockResolvedValue({ profile: {}, results: [] });
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/v1/account/export", () => {
  it("passes the bearer request through to getUserId (regression: this used to call getUserId() with no args, so a mobile bearer token never authenticated)", async () => {
    await GET(req("jwt-abc"));
    expect(getUserId).toHaveBeenCalledWith(expect.anything());
  });

  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("429s when the IP limit trips", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const res = await GET(req());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("429s when the per-user limit trips", async () => {
    rateLimit.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, retryAfter: 60 });
    expect((await GET(req())).status).toBe(429);
    expect(exportAccountData).not.toHaveBeenCalled();
  });

  it("returns the export as a JSON attachment for an authed caller", async () => {
    const res = await GET(req("jwt-abc"));
    expect(exportAccountData).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
  });
});
