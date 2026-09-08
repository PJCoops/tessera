import { describe, expect, it } from "vitest";
import { CODE_RE, genCode, joinByCode } from "./leagues-store";

describe("invite code generation", () => {
  it("produces 8 chars from the read-aloud alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const c = genCode();
      expect(c).toHaveLength(8);
      expect(CODE_RE.test(c)).toBe(true);
    }
  });

  it("draws roughly uniformly across the alphabet (no modulo bias)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 5000; i++) {
      for (const ch of genCode()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    const freqs = [...counts.values()];
    const mean = freqs.reduce((a, b) => a + b, 0) / freqs.length;
    // The first 16 letters would be ~1.6x the rest under a plain byte%30.
    expect(Math.max(...freqs) / Math.min(...freqs)).toBeLessThan(1.35);
  });
});

describe("joinByCode input handling", () => {
  const noSql = { async unsafe() {} } as never;

  it("rejects a malformed code before touching the DB (same not_found)", async () => {
    for (const bad of ["", "abc", "TOOLONGCODE9", "AB CD-12!", "IL0O1234"]) {
      const r = await joinByCode(noSql, "u1", bad);
      expect(r).toEqual({ ok: false, reason: "not_found" });
    }
  });
});
