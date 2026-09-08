import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountDeleteResponseSchema } from "../../../lib/api/v1-schema";

// Mock every dependency the route reaches for — this test is about the
// route's control flow (auth, freshness, idempotency), not the DB.
const authCtx = { value: null as null | { userId: string; email: string | null; authTimeMs: number | null } };
const softDelete = vi.fn();
const restore = vi.fn();
const accountState = vi.fn();
const loops = vi.fn();

vi.mock("../../../lib/db", () => ({ getDb: () => ({}) }));
vi.mock("../../../lib/rate-limit", () => ({ rateLimit: async () => ({ ok: true }) }));
vi.mock("../../../lib/auth-context", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/auth-context")>(
    "../../../lib/auth-context",
  );
  return { ...actual, getAuthContext: async () => authCtx.value };
});
vi.mock("../../../lib/account-store", () => ({
  getAccountState: (...a: unknown[]) => accountState(...a),
  softDeleteAccount: (...a: unknown[]) => softDelete(...a),
  restoreAccount: (...a: unknown[]) => restore(...a),
}));
vi.mock("../../../lib/loops", () => ({ sendLoopsEvent: (...a: unknown[]) => loops(...a) }));

import { DELETE, POST } from "./route";

const del = () =>
  DELETE(new Request("https://tesserapuzzle.com/api/v1/account", { method: "DELETE" }) as never);

const now = Date.now();

beforeEach(() => {
  authCtx.value = { userId: "u1", email: "a@b.com", authTimeMs: now };
  accountState.mockResolvedValue({ exists: true, deletedAt: null });
  softDelete.mockResolvedValue({ alreadyPending: false, permanentAt: new Date(now + 48 * 3600_000) });
  loops.mockResolvedValue({ ok: true, status: 200 });
});
afterEach(() => vi.clearAllMocks());

describe("DELETE /api/v1/account", () => {
  it("401s when unauthenticated", async () => {
    authCtx.value = null;
    expect((await del()).status).toBe(401);
  });

  it("requires a fresh re-auth", async () => {
    authCtx.value = { userId: "u1", email: "a@b.com", authTimeMs: now - 10 * 60_000 };
    const res = await del();
    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe("reauth_required");
    expect(softDelete).not.toHaveBeenCalled();
  });

  it("404s when there is no profile", async () => {
    accountState.mockResolvedValue({ exists: false, deletedAt: null });
    expect((await del()).status).toBe(404);
  });

  it("soft-deletes and sends the confirmation email when fresh", async () => {
    const res = await del();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(accountDeleteResponseSchema.parse(body)).toMatchObject({
      ok: true,
      status: "pending_deletion",
      alreadyPending: false,
    });
    expect(softDelete).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(loops).toHaveBeenCalledWith("a@b.com", "account_deletion_scheduled", expect.objectContaining({ permanent_at: expect.any(String) }));
  });

  it("is idempotent — a repeat request does not re-send the email", async () => {
    softDelete.mockResolvedValue({ alreadyPending: true, permanentAt: new Date(now + 3600_000) });
    const res = await del();
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyPending).toBe(true);
    expect(loops).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/account (restore)", () => {
  const post = (body: unknown) =>
    POST(
      new Request("https://tesserapuzzle.com/api/v1/account", {
        method: "POST",
        body: JSON.stringify(body),
      }) as never,
    );

  it("rejects a non-restore body", async () => {
    expect((await post({ action: "nope" })).status).toBe(400);
  });

  it("clears a pending deletion", async () => {
    restore.mockResolvedValue(true);
    const res = await post({ action: "restore" });
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ ok: true, restored: true });
  });
});
