import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apply = vi.fn();
vi.mock("../../../../lib/db", () => ({ getDb: () => ({}) }));
vi.mock("../../../../lib/billing", () => ({
  applyRevenueCatEvent: (...a: unknown[]) => apply(...a),
}));

import { POST } from "./route";

const SECRET = "hook-secret";

function call(body: unknown, auth: string | null = SECRET) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth !== null) headers.authorization = auth;
  return POST(
    new Request("https://tesserapuzzle.com/api/v1/billing/revenuecat", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }) as never,
  );
}

const evt = (over: Record<string, unknown> = {}) => ({
  event: { id: "e1", type: "INITIAL_PURCHASE", app_user_id: "user-123", ...over },
});

beforeEach(() => {
  process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  apply.mockResolvedValue({ adsRemoved: true, duplicate: false });
});
afterEach(() => {
  delete process.env.REVENUECAT_WEBHOOK_SECRET;
  vi.clearAllMocks();
});

describe("POST /api/v1/billing/revenuecat", () => {
  it("503s when the shared secret is unset", async () => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    expect((await call(evt())).status).toBe(503);
  });

  it("401s on a wrong Authorization header", async () => {
    expect((await call(evt(), "nope")).status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });

  it("400s when id or app_user_id is missing", async () => {
    expect((await call(evt({ id: undefined }))).status).toBe(400);
    expect((await call(evt({ app_user_id: undefined }))).status).toBe(400);
  });

  it("accepts and ignores anonymous RevenueCat ids", async () => {
    const res = await call(evt({ app_user_id: "$RCAnonymousID:abc" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ignored).toBe("anonymous");
    expect(apply).not.toHaveBeenCalled();
  });

  it("re-verifies via applyRevenueCatEvent and returns the written value", async () => {
    const res = await call(evt());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, adsRemoved: true, duplicate: false });
    expect(apply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventId: "e1", eventType: "INITIAL_PURCHASE", appUserId: "user-123" }),
    );
  });

  it("reports a replayed event as a duplicate", async () => {
    apply.mockResolvedValue({ adsRemoved: true, duplicate: true });
    expect((await (await call(evt())).json()).duplicate).toBe(true);
  });
});
