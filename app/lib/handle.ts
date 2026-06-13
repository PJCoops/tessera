// Public display name (handle) validation. Setting a handle is how a
// player opts into leaderboards and leagues; uniqueness is enforced
// case-insensitively server-side by the profiles_display_name_lower index,
// this only covers shape and a small reactive blocklist.

export type HandleResult =
  | { ok: true; value: string }
  | { ok: false; reason: "too_short" | "too_long" | "bad_chars" | "all_digits" | "blocked" };

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

const SHAPE = /^[a-zA-Z0-9_-]+$/;

// Lowercased. Kept deliberately small; offensive handles are also
// nullable by hand later. Not a comprehensive filter.
const BLOCKED = new Set<string>([
  "admin",
  "tessera",
  "moderator",
  "support",
]);

// Trims surrounding whitespace but preserves the player's casing for
// display. Uniqueness is case-insensitive at the DB layer.
export function validateHandle(raw: string): HandleResult {
  const value = raw.trim();
  if (value.length < HANDLE_MIN) return { ok: false, reason: "too_short" };
  if (value.length > HANDLE_MAX) return { ok: false, reason: "too_long" };
  if (!SHAPE.test(value)) return { ok: false, reason: "bad_chars" };
  if (/^\d+$/.test(value)) return { ok: false, reason: "all_digits" };
  if (BLOCKED.has(value.toLowerCase())) return { ok: false, reason: "blocked" };
  return { ok: true, value };
}
