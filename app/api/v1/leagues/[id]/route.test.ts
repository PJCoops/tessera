import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const rateLimit = vi.fn();
const getUserId = vi.fn();
const getDb = vi.fn();
const isMember = vi.fn();
const leagueStandings = vi.fn();

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
  isMember: (...a: unknown[]) => isMember(...a),
  leagueStandings: (...a: unknown[]) => leagueStandings(...a),
}));

import { GET } from "./route";

const req = (qs: string) => new NextRequest(`https://tesserapuzzle.com/api/v1/leagues/l1${qs}`);
const params = Promise.resolve({ id: "l1" });

beforeEach(() => {
  rateLimit.mockResolvedValue({ ok: true });
  getUserId.mockResolvedValue("u1");
  getDb.mockReturnValue({});
  isMember.mockResolvedValue(true);
  leagueStandings.mockResolvedValue({
    league: { id: "l1", name: "Family", inviteCode: "X" },
    board: [],
    tally: [],
    hasHandle: true,
  });
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/v1/leagues/[id]", () => {
  it("401s when unauthenticated", async () => {
    getUserId.mockResolvedValue(null);
    expect((await GET(req("?mode=classic&num=1"), { params })).status).toBe(401);
  });

  it("400s on a missing/invalid num", async () => {
    expect((await GET(req("?mode=classic"), { params })).status).toBe(400);
  });

  it("403s when the caller isn't a member", async () => {
    isMember.mockResolvedValue(false);
    const res = await GET(req("?mode=classic&num=5"), { params });
    expect(res.status).toBe(403);
    expect(leagueStandings).not.toHaveBeenCalled();
  });

  it("returns standings for a member", async () => {
    const res = await GET(req("?mode=hard&num=5"), { params });
    expect(leagueStandings).toHaveBeenCalledWith(expect.anything(), "l1", "hard", 5, "u1");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.league.name).toBe("Family");
  });
});
