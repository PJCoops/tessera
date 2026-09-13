import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();
const getUserId = vi.fn();
const getDb = vi.fn();
const setColourBlind = vi.fn();
const ensureProfile = vi.fn();

vi.mock("../../../lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("../../../lib/supabase-server", () => ({
  getUserId: (...a: unknown[]) => getUserId(...a),
}));
vi.mock("../../../lib/db", () => ({
  getDb: (...a: unknown[]) => getDb(...a),
}));
vi.mock("../../../lib/account-store", () => ({
  setColourBlind: (...a: unknown[]) => setColourBlind(...a),
}));
vi.mock("../../../lib/results-store", () => ({
  ensureProfile: (...a: unknown[]) => ensureProfile(...a),
}));

import { POST } from "./route";

const req = (body: unknown) =>
  new Request("https://tesserapuzzle.com/api/v1/settings", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue("u1");
  getDb.mockReturnValue({});
  setColourBlind.mockResolvedValue(undefined);
  ensureProfile.mockResolvedValue(true);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/v1/settings", () => {
  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await POST(req({ colourBlind: true }))).status).toBe(401);
  });

  it("429s when the IP limit trips", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 15 });
    const res = await POST(req({ colourBlind: true }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("15");
  });

  it("400s on a non-boolean colourBlind", async () => {
    expect((await POST(req({ colourBlind: "yes" }))).status).toBe(400);
  });

  it("400s on missing colourBlind", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("ensures the profile exists, then persists the value", async () => {
    const res = await POST(req({ colourBlind: true }));
    expect(ensureProfile).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(setColourBlind).toHaveBeenCalledWith(expect.anything(), "u1", true);
    expect(await res.json()).toEqual({ ok: true });
  });
});
