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

// The map of every v1 response schema, keyed by route. The JSON Schema
// generator and the contract tests both iterate this.
export const v1ResponseSchemas = {
  "GET /api/v1/puzzle": puzzleResponseSchema,
} as const;
