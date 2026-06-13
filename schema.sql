-- Tessera accounts schema. Apply manually to the Supabase project
-- (SQL editor, or: psql "$DATABASE_URL" -f schema.sql). No migration
-- tooling yet; keep this file the single source of truth and append
-- ALTERs as the schema evolves.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Editing UI ships in a later slice; column exists now so leaderboards
  -- have somewhere to read from.
  display_name text,
  -- Historical maxima carried over from localStorage streaks at first
  -- import. Preserved separately because pre-account history may not
  -- have result rows to derive the old max from.
  imported_max_streak_classic int not null default 0,
  imported_max_streak_hard    int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_display_name_lower on profiles (lower(display_name));

-- Pins each day's generated puzzle on first server-side validation, so a
-- wordlist edit after a puzzle airs can never change what counts as a
-- valid replay for that day.
create table puzzles (
  date date not null,
  locale text not null check (locale in ('en','es')),
  mode text not null check (mode in ('classic','hard')),
  gold_rows text[] not null,
  -- N*N letters in board position order (row-major).
  start_letters text not null,
  min_swaps int not null,
  created_at timestamptz not null default now(),
  primary key (date, locale, mode)
);

create table puzzle_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('classic','hard')),
  puzzle_number int not null check (puzzle_number >= 1),
  moves int not null check (moves >= 0),
  bonus boolean not null default false,
  revealed boolean not null default false,
  -- True only when the server replayed the submitted move history against
  -- the pinned puzzle. Future leaderboards rank verified rows only.
  verified boolean not null default false,
  -- Informational: localStorage result keys are locale-blind, so locale
  -- is best-effort and excluded from the primary key.
  locale text not null default 'en',
  time_ms int check (time_ms is null or time_ms between 0 and 86400000),
  -- Client-claimed completion time, clamped server-side. created_at is
  -- the trustworthy timestamp for leaderboard day-windows.
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mode, puzzle_number)
);
create index results_leaderboard_idx
  on puzzle_results (mode, puzzle_number, moves, time_ms)
  where verified and not revealed;

-- RLS on with zero policies: the public anon key gets nothing through
-- PostgREST. All reads and writes go through our API routes over the
-- direct Postgres connection, because replay validation runs in app code
-- and client-writable rows could forge verified results.
alter table profiles enable row level security;
alter table puzzles enable row level security;
alter table puzzle_results enable row level security;

-- ── Launch bundle: leaderboards + mini-leagues ──────────────────────

-- Country of the request that recorded a verified solve (ISO-3166-1
-- alpha-2 from Vercel's x-vercel-ip-country); 'ZZ' when the header is
-- missing (local dev). Rows that predate capture stay null and simply
-- don't appear on country boards until re-solved.
alter table puzzle_results add column if not exists country text;

-- Country leaderboard: filter by (mode, puzzle_number, country) then
-- order by moves, time_ms, over the same verified/not-revealed predicate.
create index if not exists results_country_leaderboard_idx
  on puzzle_results (mode, puzzle_number, country, moves, time_ms)
  where verified and not revealed;

-- Mini-leagues: invite-code groups. Standings are computed live as the
-- global board filtered to member handles, no seasons, no cron.
create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists league_members (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- Reverse lookup for the "my leagues" list.
create index if not exists league_members_user_idx on league_members (user_id);

-- Same lockdown as the rest: RLS on, zero policies, all access server-side.
alter table leagues enable row level security;
alter table league_members enable row level security;
