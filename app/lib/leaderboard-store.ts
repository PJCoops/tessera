import type { Sql } from "./db";
import type { ModeId } from "./mode";

// One ranked board row. user_id is never exposed to the client; the handle
// is the public identity.
export type BoardEntry = {
  rank: number;
  handle: string;
  moves: number;
  timeMs: number | null;
  isMe: boolean;
};

export type LeaderboardData = {
  global: BoardEntry[];
  country: BoardEntry[];
  me: { global: BoardEntry | null; country: BoardEntry | null };
  hasHandle: boolean;
};

export const BOARD_LIMIT = 100;

// time_ms can be null on the rare verified row without timing; sort those
// last so the comparator matches the SQL `time_ms asc nulls last`.
const TIME_MAX = 2_147_483_647;

// Ranking order: fewer moves first, then faster time. Exported for tests so
// the SQL ordering stays honest.
export function compareEntries(
  a: { moves: number; timeMs: number | null },
  b: { moves: number; timeMs: number | null }
): number {
  if (a.moves !== b.moves) return a.moves - b.moves;
  return (a.timeMs ?? TIME_MAX) - (b.timeMs ?? TIME_MAX);
}

type Row = {
  rank: number;
  handle: string;
  moves: number;
  time_ms: number | null;
  user_id: string;
};

function toEntries(rows: Row[], userId: string | null): BoardEntry[] {
  return rows.map((r) => ({
    rank: Number(r.rank),
    handle: r.handle,
    moves: Number(r.moves),
    timeMs: r.time_ms === null ? null : Number(r.time_ms),
    isMe: userId !== null && r.user_id === userId,
  }));
}

async function topN(
  sql: Sql,
  mode: ModeId,
  num: number,
  country: string | null,
  userId: string | null
): Promise<BoardEntry[]> {
  const rows = country
    ? await sql<Row[]>`
        select
          row_number() over (order by pr.moves asc, pr.time_ms asc nulls last) as rank,
          p.display_name as handle, pr.moves, pr.time_ms, pr.user_id
        from puzzle_results pr
        join profiles p on p.id = pr.user_id
        where pr.mode = ${mode} and pr.puzzle_number = ${num}
          and pr.verified and not pr.revealed and p.display_name is not null
          and pr.country = ${country}
        order by pr.moves asc, pr.time_ms asc nulls last
        limit ${BOARD_LIMIT}`
    : await sql<Row[]>`
        select
          row_number() over (order by pr.moves asc, pr.time_ms asc nulls last) as rank,
          p.display_name as handle, pr.moves, pr.time_ms, pr.user_id
        from puzzle_results pr
        join profiles p on p.id = pr.user_id
        where pr.mode = ${mode} and pr.puzzle_number = ${num}
          and pr.verified and not pr.revealed and p.display_name is not null
        order by pr.moves asc, pr.time_ms asc nulls last
        limit ${BOARD_LIMIT}`;
  return toEntries(rows, userId);
}

// The viewer's own row + rank when they're past the top slice. Rank is a
// count of strictly-better rows + 1, using the same nulls-last tie-break.
async function myRank(
  sql: Sql,
  mode: ModeId,
  num: number,
  country: string | null,
  userId: string
): Promise<BoardEntry | null> {
  const rows = await sql<(Omit<Row, "rank"> & { rank: number })[]>`
    select
      (select count(*) + 1
       from puzzle_results pr2
       join profiles p2 on p2.id = pr2.user_id
       where pr2.mode = ${mode} and pr2.puzzle_number = ${num}
         and pr2.verified and not pr2.revealed and p2.display_name is not null
         ${country ? sql`and pr2.country = ${country}` : sql``}
         and (pr2.moves < me.moves
              or (pr2.moves = me.moves
                  and coalesce(pr2.time_ms, ${TIME_MAX}) < coalesce(me.time_ms, ${TIME_MAX})))
      ) as rank,
      p.display_name as handle, me.moves, me.time_ms, me.user_id
    from puzzle_results me
    join profiles p on p.id = me.user_id
    where me.user_id = ${userId} and me.mode = ${mode} and me.puzzle_number = ${num}
      and me.verified and not me.revealed and p.display_name is not null
      ${country ? sql`and me.country = ${country}` : sql``}`;
  if (rows.length === 0) return null;
  return toEntries(rows as Row[], userId)[0];
}

export async function getLeaderboard(
  sql: Sql,
  opts: { mode: ModeId; num: number; country: string; userId: string | null }
): Promise<LeaderboardData> {
  const { mode, num, userId } = opts;
  // Treat "ZZ"/unknown as no country board rather than a bucket of its own.
  const country = opts.country && opts.country !== "ZZ" ? opts.country : null;

  const [global, countryBoard] = await Promise.all([
    topN(sql, mode, num, null, userId),
    country ? topN(sql, mode, num, country, userId) : Promise.resolve<BoardEntry[]>([]),
  ]);

  let hasHandle = false;
  let me: LeaderboardData["me"] = { global: null, country: null };
  if (userId) {
    const prof = await sql<{ display_name: string | null }[]>`
      select display_name from profiles where id = ${userId}`;
    hasHandle = (prof[0]?.display_name ?? null) !== null;
    if (hasHandle) {
      const inGlobal = global.some((e) => e.isMe);
      const inCountry = countryBoard.some((e) => e.isMe);
      const [mg, mc] = await Promise.all([
        inGlobal ? Promise.resolve(null) : myRank(sql, mode, num, null, userId),
        !country || inCountry ? Promise.resolve(null) : myRank(sql, mode, num, country, userId),
      ]);
      me = { global: mg, country: mc };
    }
  }

  return { global, country: countryBoard, me, hasHandle };
}
