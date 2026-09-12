import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.fn();
const getUserId = vi.fn();
const getDb = vi.fn();
const listMyLeagues = vi.fn();
const createLeague = vi.fn();

vi.mock("../../../lib/rate-limit", () => ({
  rateLimit: (...a: unknown[]) => rateLimit(...a),
}));
vi.mock("../../../lib/supabase-server", () => ({
  getUserId: (...a: unknown[]) => getUserId(...a),
}));
vi.mock("../../../lib/db", () => ({
  getDb: (...a: unknown[]) => getDb(...a),
}));
vi.mock("../../../lib/leagues-store", () => ({
  listMyLeagues: (...a: unknown[]) => listMyLeagues(...a),
  createLeague: (...a: unknown[]) => createLeague(...a),
}));

import { GET, POST } from "./route";

const getReq = () => new Request("https://tesserapuzzle.com/api/v1/leagues") as never;
const postReq = (body: unknown) =>
  new Request("https://tesserapuzzle.com/api/v1/leagues", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue("u1");
  getDb.mockReturnValue({});
  listMyLeagues.mockResolvedValue([]);
  createLeague.mockResolvedValue({ id: "l1", name: "Family", inviteCode: "ABC12345" });
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/v1/leagues", () => {
  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await GET(getReq())).status).toBe(401);
  });

  it("lists the caller's leagues", async () => {
    listMyLeagues.mockResolvedValue([{ id: "l1", name: "Family", inviteCode: "X", memberCount: 3 }]);
    const res = await GET(getReq());
    expect(listMyLeagues).toHaveBeenCalledWith(expect.anything(), "u1");
    const body = await res.json();
    expect(body.leagues).toHaveLength(1);
  });
});

describe("POST /api/v1/leagues", () => {
  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await POST(postReq({ name: "x" }))).status).toBe(401);
  });

  it("400s on bad input", async () => {
    expect((await POST(postReq({}))).status).toBe(400);
  });

  it("400s when the store rejects the name", async () => {
    createLeague.mockResolvedValue({ error: "bad_name" });
    expect((await POST(postReq({ name: "" }))).status).toBe(400);
  });

  it("creates a league for a valid name", async () => {
    const res = await POST(postReq({ name: "Family" }));
    expect(createLeague).toHaveBeenCalledWith(expect.anything(), "u1", "Family");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.league.inviteCode).toBe("ABC12345");
  });

  it("429s when the per-user create limit trips", async () => {
    rateLimit.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, retryAfter: 5 });
    const res = await POST(postReq({ name: "Family" }));
    expect(res.status).toBe(429);
    expect(createLeague).not.toHaveBeenCalled();
  });
});
