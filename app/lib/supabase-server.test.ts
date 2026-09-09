import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

import { bearerToken, getUserId } from "./supabase-server";

const OLD_ENV = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.clearAllMocks();
});

describe("bearerToken", () => {
  it("pulls the token from a Bearer header, case-insensitively", () => {
    const r = (v: string) => new Request("https://x", { headers: { authorization: v } });
    expect(bearerToken(r("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
    expect(bearerToken(r("bearer xyz"))).toBe("xyz");
    expect(bearerToken(r("Basic abc"))).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });
});

describe("getUserId", () => {
  it("validates a bearer token when one is present", async () => {
    const req = new Request("https://x", { headers: { authorization: "Bearer jwt-1" } });
    expect(await getUserId(req)).toBe("u1");
    expect(getUser).toHaveBeenCalledWith("jwt-1");
  });

  it("falls back to cookie session when no bearer header", async () => {
    expect(await getUserId(new Request("https://x"))).toBe("u1");
    expect(getUser).toHaveBeenCalledWith();
  });

  it("returns null on an auth error", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    expect(await getUserId(new Request("https://x", { headers: { authorization: "Bearer bad" } }))).toBeNull();
  });
});
