// Frozen contract for the /api/v1 surface (docs/flutter-app-spec.md §4.2).
//
// This zod schema is the single source of truth: it validates responses at
// runtime, provides the static types, and is compiled to JSON Schema
// (app/lib/api/v1-schema.json, via `npm run gen:v1-schema`) for generating
// the Flutter Dart models.
//
// Deprecation policy: v1 fields are additive-only. A breaking change means
// /api/v2 plus a support window; `minSupportedVersion` retires old clients
// before a v1 field is removed.

import { z } from "zod";

export const LOCALES = ["en", "es"] as const;
export const MODES = ["classic", "hard"] as const;

// ── GET /api/v1/puzzle ────────────────────────────────────────────────────

export const puzzleQuerySchema = z.object({
  // YYYY-MM-DD, UTC. Required. The route additionally rejects non-real
  // calendar days (400), future dates (403), and pre-EPOCH dates (404).
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locale: z.enum(LOCALES).default("en"),
  mode: z.enum(MODES).default("classic"),
});

export const tileSchema = z.object({
  id: z.int().min(0),
  letter: z.string().length(1),
});

export const puzzleResponseSchema = z.object({
  // Puzzle number relative to EPOCH (EPOCH = day 1).
  num: z.int().positive(),
  // N gold words, each N letters, lowercase.
  goldRows: z.array(z.string()).min(4).max(5),
  // The scrambled start board as a row-major letter string, length N*N.
  startLetters: z.string(),
  // The same start board as tiles; `id` is the tile's solved home index.
  startTiles: z.array(tileSchema).min(16).max(25),
  // Minimum swaps from start to solved. Drives the ratio-based tier.
  minSwaps: z.int().positive(),
});

export type PuzzleQuery = z.infer<typeof puzzleQuerySchema>;
export type PuzzleResponse = z.infer<typeof puzzleResponseSchema>;

// ── GET /api/v1/app-config ───────────────────────────────────────────────

export const appConfigResponseSchema = z.object({
  // Lowest client version still allowed to talk to v1. The client hard-
  // blocks below this and shows a store link; prefer letting the current
  // version keep playing in a degraded mode (§16.2).
  minSupportedVersion: z.string(),
  // Optional one-shot "what's new" card, keyed so the client shows it once.
  whatsNew: z
    .object({ id: z.string(), title: z.string(), body: z.string() })
    .nullable(),
  // Dark-launch switches (ad placements, new-player grace, etc. — §21).
  // Open map so flags can be added without a schema bump.
  flags: z.record(z.string(), z.boolean()),
});

export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>;

// ── GET /api/v1/results ──────────────────────────────────────────────────

export const streakSchema = z.object({
  current: z.int().min(0),
  max: z.int().min(0),
  lastWon: z.int().min(0),
});

export const resultRowSchema = z.object({
  num: z.int().positive(),
  mode: z.enum(MODES),
  moves: z.int().min(0),
  bonus: z.boolean(),
  revealed: z.boolean(),
  verified: z.boolean(),
  timeMs: z.int().nullable(),
  completedAt: z.number(),
});

export const resultsResponseSchema = z.object({
  ok: z.literal(true),
  results: z.array(resultRowSchema),
  streaks: z.object({ classic: streakSchema, hard: streakSchema }),
});

export type ResultsResponse = z.infer<typeof resultsResponseSchema>;

// ── DELETE /api/v1/account ───────────────────────────────────────────────

export const accountDeleteResponseSchema = z.object({
  ok: z.literal(true),
  status: z.literal("pending_deletion"),
  permanentAt: z.string(),
  alreadyPending: z.boolean(),
});

export type AccountDeleteResponse = z.infer<typeof accountDeleteResponseSchema>;

// The map of every v1 response schema, keyed by route. The JSON Schema
// generator and the contract tests both iterate this.
export const v1ResponseSchemas = {
  "GET /api/v1/puzzle": puzzleResponseSchema,
  "GET /api/v1/app-config": appConfigResponseSchema,
  "GET /api/v1/results": resultsResponseSchema,
  "DELETE /api/v1/account": accountDeleteResponseSchema,
} as const;
