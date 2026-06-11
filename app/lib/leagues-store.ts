import type { Sql } from "./db";
import type { ModeId } from "./mode";
import { type BoardEntry, compareEntries } from "./leaderboard-store";

export type LeagueSummary = { id: string; name: string; inviteCode: string; memberCount: number };
export type TallyEntry = { handle: string; daysWon: number; isMe: boolean };
export type LeagueStandings = {
  league: { id: string; name: string; inviteCode: string };
  board: BoardEntry[];
  tally: TallyEntry[];
  hasHandle: boolean;
};

export const LEAGUE_NAME_MAX = 40;

// Crockford-ish alphabet: no 0/O/1/I/L to keep codes easy to read aloud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 7;

function genCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, LEAGUE_NAME_MAX);
}

export async function createLeague(
  sql: Sql,
  ownerId: string,
  rawName: string
): Promise<{ id: string; name: string; inviteCode: string } | { error: "bad_name" }> {
  const name = normalizeName(rawName);
  if (name.length === 0) return { error: "bad_name" };
  // Retry on the rare invite_code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    try {
      const rows = await sql<{ id: string }[]>`
        insert into leagues (invite_code, name, owner_id)
        values (${code}, ${name}, ${ownerId})
        returning id`;
      const id = rows[0].id;
      await sql`insert into league_members (league_id, user_id) values (${id}, ${ownerId})
                on conflict do nothing`;
      return { id, name, inviteCode: code };
    } catch (e) {
      if ((e as { code?: string }).code === "23505") continue; // code collision
      throw e;
    }
  }
  throw new Error("could not allocate a unique invite code");
}

export async function joinByCode(
  sql: Sql,
  userId: string,
  rawCode: string
): Promise<{ ok: true; league: { id: string; name: string } } | { ok: false; reason: "not_found" }> {
  const code = rawCode.trim().toUpperCase();
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from leagues where invite_code = ${code}`;
  if (rows.length === 0) return { ok: false, reason: "not_found" };
  await sql`insert into league_members (league_id, user_id) values (${rows[0].id}, ${userId})
            on conflict do nothing`;
  return { ok: true, league: { id: rows[0].id, name: rows[0].name } };
}

export async function listMyLeagues(sql: Sql, userId: string): Promise<LeagueSummary[]> {
  const rows = await sql<{ id: string; name: string; invite_code: string; member_count: number }[]>`
    select l.id, l.name, l.invite_code,
           (select count(*) from league_members m2 where m2.league_id = l.id) as member_count
    from leagues l
    join league_members m on m.league_id = l.id and m.user_id = ${userId}
    order by l.created_at desc`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    inviteCode: r.invite_code,
    memberCount: Number(r.member_count),
  }));
}

export async function isMember(sql: Sql, userId: string, leagueId: string): Promise<boolean> {
  const rows = await sql`
    select 1 from league_members where league_id = ${leagueId} and user_id = ${userId} limit 1`;
  return rows.length > 0;
}

// Pure twin of the days-won SQL: for each member, count puzzles where they
// were the league's best that day (ties on moves AND time both credited),
// per mode. Exported for tests.
export function tallyDaysWon(
  rows: { userId: string; handle: string; mode: string; puzzleNumber: number; moves: number; timeMs: number | null }[]
): { userId: string; handle: string; daysWon: number }[] {
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.mode}:${r.puzzleNumber}`;
    const arr = byDay.get(key);
    if (arr) arr.push(r);
    else byDay.set(key, [r]);
  }
  const wins = new Map<string, { handle: string; daysWon: number }>();
  for (const day of byDay.values()) {
    let best = day[0];
    for (const r of day) if (compareEntries(r, best) < 0) best = r;
    for (const r of day) {
      if (compareEntries(r, best) === 0) {
        const cur = wins.get(r.userId) ?? { handle: r.handle, daysWon: 0 };
        cur.daysWon += 1;
        wins.set(r.userId, cur);
      }
    }
  }
  // Ensure every member appears even with zero wins.
  for (const r of rows) if (!wins.has(r.userId)) wins.set(r.userId, { handle: r.handle, daysWon: 0 });
  return Array.from(wins.entries()).map(([userId, v]) => ({ userId, handle: v.handle, daysWon: v.daysWon }));
}

export async function leagueStandings(
  sql: Sql,
  leagueId: string,
  mode: ModeId,
  num: number,
  userId: string
): Promise<LeagueStandings> {
  const meta = await sql<{ id: string; name: string; invite_code: string }[]>`
    select id, name, invite_code from leagues where id = ${leagueId}`;
  const league = meta.length
    ? { id: meta[0].id, name: meta[0].name, inviteCode: meta[0].invite_code }
    : { id: leagueId, name: "", inviteCode: "" };

  const myHandleRows = await sql<{ display_name: string | null }[]>`
    select display_name from profiles where id = ${userId}`;
  const myHandle = myHandleRows[0]?.display_name ?? null;

  // Today's board filtered to league members (with a handle).
  const boardRows = await sql<{ rank: number; handle: string; moves: number; time_ms: number | null }[]>`
    select row_number() over (order by pr.moves asc, pr.time_ms asc nulls last) as rank,
           p.display_name as handle, pr.moves, pr.time_ms
    from puzzle_results pr
    join league_members lm on lm.user_id = pr.user_id and lm.league_id = ${leagueId}
    join profiles p on p.id = pr.user_id
    where pr.mode = ${mode} and pr.puzzle_number = ${num}
      and pr.verified and not pr.revealed and p.display_name is not null
    order by pr.moves asc, pr.time_ms asc nulls last`;
  const board: BoardEntry[] = boardRows.map((r) => ({
    rank: Number(r.rank),
    handle: r.handle,
    moves: Number(r.moves),
    timeMs: r.time_ms === null ? null : Number(r.time_ms),
    isMe: myHandle !== null && r.handle === myHandle,
  }));

  // Days-won tally across all of this league's history for the mode.
  const tallyRows = await sql<{ handle: string; days_won: number }[]>`
    with member_results as (
      select p.display_name as handle, pr.puzzle_number,
             rank() over (
               partition by pr.puzzle_number
               order by pr.moves asc, pr.time_ms asc nulls last
             ) as day_rank
      from puzzle_results pr
      join league_members lm on lm.user_id = pr.user_id and lm.league_id = ${leagueId}
      join profiles p on p.id = pr.user_id
      where pr.mode = ${mode}
        and pr.verified and not pr.revealed and p.display_name is not null
    )
    select handle, count(*) filter (where day_rank = 1) as days_won
    from member_results
    group by handle
    order by days_won desc, handle asc`;
  const tally: TallyEntry[] = tallyRows.map((r) => ({
    handle: r.handle,
    daysWon: Number(r.days_won),
    isMe: myHandle !== null && r.handle === myHandle,
  }));

  return { league, board, tally, hasHandle: myHandle !== null };
}
