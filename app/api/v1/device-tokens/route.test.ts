import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();
const getUserId = vi.fn();
const getDb = vi.fn();
const registerDeviceToken = vi.fn();
const deregisterDeviceToken = vi.fn();

vi.mock("../../../lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("../../../lib/supabase-server", () => ({
  getUserId: (...a: unknown[]) => getUserId(...a),
}));
vi.mock("../../../lib/db", () => ({
  getDb: (...a: unknown[]) => getDb(...a),
}));
vi.mock("../../../lib/device-tokens-store", () => ({
  isDevicePlatform: (v: unknown) => v === "ios" || v === "android",
  registerDeviceToken: (...a: unknown[]) => registerDeviceToken(...a),
  deregisterDeviceToken: (...a: unknown[]) => deregisterDeviceToken(...a),
}));

import { DELETE, POST } from "./route";

const req = (method: "POST" | "DELETE", body: unknown) =>
  new Request("https://tesserapuzzle.com/api/v1/device-tokens", {
    method,
    body: JSON.stringify(body),
  }) as never;

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue("u1");
  getDb.mockReturnValue({});
  registerDeviceToken.mockResolvedValue(undefined);
  deregisterDeviceToken.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/v1/device-tokens", () => {
  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await POST(req("POST", { platform: "ios", token: "t", tzOffset: 0 }))).status).toBe(401);
  });

  it("429s when the IP limit trips", async () => {
    rateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const res = await POST(req("POST", { platform: "ios", token: "t", tzOffset: 0 }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("429s when the per-user limit trips", async () => {
    rateLimit
      .mockResolvedValueOnce({ ok: true }) // IP
      .mockResolvedValueOnce({ ok: false, retryAfter: 60 }); // per-user
    expect((await POST(req("POST", { platform: "ios", token: "t", tzOffset: 0 }))).status).toBe(429);
    expect(registerDeviceToken).not.toHaveBeenCalled();
  });

  it("400s on an unknown platform", async () => {
    expect((await POST(req("POST", { platform: "windows", token: "t", tzOffset: 0 }))).status).toBe(400);
  });

  it("400s on a missing token", async () => {
    expect((await POST(req("POST", { platform: "ios", tzOffset: 0 }))).status).toBe(400);
  });

  it("400s on an out-of-range tzOffset", async () => {
    expect(
      (await POST(req("POST", { platform: "ios", token: "t", tzOffset: 10_000 }))).status,
    ).toBe(400);
  });

  it("registers a valid token", async () => {
    const res = await POST(req("POST", { platform: "android", token: "tok-1", tzOffset: -120 }));
    expect(registerDeviceToken).toHaveBeenCalledWith(expect.anything(), "u1", "android", "tok-1", -120);
    expect((await res.json())).toEqual({ ok: true });
  });
});

describe("DELETE /api/v1/device-tokens", () => {
  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await DELETE(req("DELETE", { token: "t" }))).status).toBe(401);
  });

  it("400s on a missing token", async () => {
    expect((await DELETE(req("DELETE", {}))).status).toBe(400);
  });

  it("deregisters the token", async () => {
    const res = await DELETE(req("DELETE", { token: "tok-1" }));
    expect(deregisterDeviceToken).toHaveBeenCalledWith(expect.anything(), "u1", "tok-1");
    expect((await res.json())).toEqual({ ok: true });
  });
});
