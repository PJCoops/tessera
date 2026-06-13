import { describe, expect, it } from "vitest";
import { validateHandle } from "./handle";

describe("validateHandle", () => {
  it("accepts a normal handle", () => {
    expect(validateHandle("alex")).toEqual({ ok: true, value: "alex" });
  });

  it("accepts letters, digits, underscore and dash", () => {
    expect(validateHandle("a-b_c9")).toEqual({ ok: true, value: "a-b_c9" });
  });

  it("trims surrounding whitespace but keeps case", () => {
    expect(validateHandle("  PJCoops  ")).toEqual({ ok: true, value: "PJCoops" });
  });

  it("rejects too short", () => {
    expect(validateHandle("ab")).toEqual({ ok: false, reason: "too_short" });
  });

  it("rejects too long (>20)", () => {
    expect(validateHandle("a".repeat(21))).toEqual({ ok: false, reason: "too_long" });
  });

  it("accepts exactly 20", () => {
    expect(validateHandle("a".repeat(20)).ok).toBe(true);
  });

  it.each(["has space", "emoji😀", "dot.dot", "slash/x", "amp&er"])(
    "rejects bad chars: %s",
    (v) => {
      expect(validateHandle(v)).toEqual({ ok: false, reason: "bad_chars" });
    }
  );

  it("rejects all-digit handles", () => {
    expect(validateHandle("12345")).toEqual({ ok: false, reason: "all_digits" });
  });

  it("rejects blocked words case-insensitively", () => {
    expect(validateHandle("Admin")).toEqual({ ok: false, reason: "blocked" });
    expect(validateHandle("tessera")).toEqual({ ok: false, reason: "blocked" });
  });
});
