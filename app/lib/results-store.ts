import type { Sql } from "./db";
import type { ModeId } from "./mode";

export type ResultRow = {
  mode: ModeId;
  puzzleNumber: number;
  moves: number;
  bonus: boolean;
  revealed: boolean;
  verified: boolean;
  locale: string;
  timeMs: number | null;
  completedAtMs: number;
};

export async function ensureProfile(sql: Sql, userId: string): Promise<void> {
  await sql`insert into profiles (id) values (${userId}) on conflict do nothing`;
}

export async function bumpImportedMax(
  sql: Sql,
  userId: string,
  modeId: ModeId,
  max: number
): Promise<void> {
  if (!Number.isInteger(max) || max <= 0) return;
  if (modeId === "hard") {
    await sql`
      update profiles set
        imported_max_streak_hard = greatest(imported_max_streak_hard, ${max}),
        updated_at = now()
      where id = ${userId}`;
  } else {
    await sql`
      update profiles set
        imported_max_streak_classic = greatest(imported_max_streak_classic, ${max}),
        updated_at = now()
      where id = ${userId}`;
  }
}

// Upsert that never downgrades: verified solve (2) beats unverified solve
// (1) beats revealed (0); equal rank keeps the existing row, which also
// makes resubmits of the same result no-ops.
export async function upsertResult(sql: Sql, userId: string, r: ResultRow): Promise<void> {
  await sql`
    insert into puzzle_results
      (user_id, mode, puzzle_number, moves, bonus, revealed, verified, locale, time_ms, completed_at)
    values
      (${userId}, ${r.mode}, ${r.puzzleNumber}, ${r.moves}, ${r.bonus}, ${r.revealed},
       ${r.verified}, ${r.locale}, ${r.timeMs}, to_timestamp(${r.completedAtMs} / 1000.0))
    on conflict (user_id, mode, puzzle_number) do update set
      moves = excluded.moves,
      bonus = excluded.bonus,
      revealed = excluded.revealed,
      verified = excluded.verified,
      locale = excluded.locale,
      time_ms = excluded.time_ms,
      completed_at = excluded.completed_at,
      updated_at = now()
    where (case when excluded.verified then 2 when not excluded.revealed then 1 else 0 end)
        > (case when puzzle_results.verified then 2 when not puzzle_results.revealed then 1 else 0 end)`;
}

type DbResultRow = {
  mode: ModeId;
  puzzle_number: number;
  moves: number;
  bonus: boolean;
  revealed: boolean;
  verified: boolean;
  locale: string;
  time_ms: number | null;
  completed_at_ms: string;
};

export async function listResults(sql: Sql, userId: string): Promise<ResultRow[]> {
  const rows = await sql<DbResultRow[]>`
    select mode, puzzle_number, moves, bonus, revealed, verified, locale, time_ms,
           (extract(epoch from completed_at) * 1000)::bigint as completed_at_ms
    from puzzle_results
    where user_id = ${userId}
    order by puzzle_number asc`;
  return rows.map((r) => ({
    mode: r.mode,
    puzzleNumber: Number(r.puzzle_number),
    moves: Number(r.moves),
    bonus: r.bonus,
    revealed: r.revealed,
    verified: r.verified,
    locale: r.locale,
    timeMs: r.time_ms === null ? null : Number(r.time_ms),
    completedAtMs: Number(r.completed_at_ms),
  }));
}

export async function importedMaxes(
  sql: Sql,
  userId: string
): Promise<{ classic: number; hard: number }> {
  const rows = await sql<{ imported_max_streak_classic: number; imported_max_streak_hard: number }[]>`
    select imported_max_streak_classic, imported_max_streak_hard
    from profiles where id = ${userId}`;
  if (rows.length === 0) return { classic: 0, hard: 0 };
  return {
    classic: Number(rows[0].imported_max_streak_classic),
    hard: Number(rows[0].imported_max_streak_hard),
  };
}
