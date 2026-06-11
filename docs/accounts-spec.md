# Tessera Accounts & Streak Sync — Spec

Status: Phase 0 + core Phase 1 implemented (see Implementation notes)
Owner: Paul
Last updated: 2026-06-10

## Implementation notes (2026-06-10)

The first slice is built on the `worktree-accounts-sync` branch: Supabase
magic-link auth, result submission with server-side replay validation,
two-way streak/history sync, post-win CTA and Account settings row. Ships
dark behind `NEXT_PUBLIC_ACCOUNTS_ENABLED`. Schema lives in `schema.sql`
at the repo root.

Deliberate divergences from the spec below:

- **No `streaks` table, no `record_win` RPC.** Streaks are derived from
  `puzzle_results` rows (the spec's own "recompute if corrupted" rationale,
  made the default). Pre-account maxima are preserved via
  `imported_max_streak_*` columns on `profiles`.
- **RLS is enabled with zero policies.** The spec's client-direct RPC model
  can't validate that a claimed win actually happened. All reads/writes go
  through `/api/results*` routes, which replay the submitted move history
  against the day's pinned puzzle (`puzzles` table) and only then mark a row
  `verified`. Leaderboards (next slice) rank verified rows only.
- **`puzzle_results` is richer than spec'd:** moves, bonus, revealed,
  verified, locale, time_ms. Replay history capture shipped in the game
  client at the same time, so "solve first, sign in later" still verifies.
- **History sync is in scope** (the spec deferred it): results pull to new
  devices, streak merge is fresher-lastWon-wins plus max-of-maxes.
- **6-digit codes, not magic links.** A code keeps the player on the device
  they're already on; a link would sign in whichever device opened the
  email, which fights the cross-device purpose. `signInWithOtp` + client
  `verifyOtp`, no server redirect route.

Still deferred, matching the spec's phasing: milestone and streak-at-risk
nudges, the `/account` page (display name, delete account, email change,
login history, data export), custom email templates.

Setup required before flipping the flag: Supabase project (EU), apply
schema.sql, edit the **Magic Link** email template so it sends the code,
i.e. include `{{ .Token }}` in the body (the default `{{ .ConfirmationURL }}`
link is unused), set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DATABASE_URL` (transaction pooler,
port 6543) in Vercel.

## Goals

1. Persist streaks server-side so they survive cleared cookies, new devices, and the upcoming mobile app.
2. Lay the auth foundation for future social features: leaderboards, mini-leagues, friend invites.
3. Keep the game fully playable **without** an account. Login is a value-add, never a wall.
4. Cheap to run at 10k MAU. Scalable to 100k+ without rearchitecture.

## Non-goals (for now)

- Passwords. Magic links only at launch — fewer support tickets, no breach liability, no "forgot password" flow.
- Social login (Google / Apple). Add in Phase 2 if data shows magic-link friction.
- Cross-puzzle game history sync (replays). Streak is the priority; full history can follow.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Auth + DB | **Supabase** | Free tier covers 50k MAU. Auth, Postgres, and row-level security in one. Built-in magic links via Resend-equivalent. |
| Email delivery | Supabase built-in → **Resend** later | Free SMTP is fine for MVP. Move to Resend (3k/mo free) once we customise templates. |
| Client SDK | `@supabase/supabase-js` + `@supabase/ssr` for Next | Official, well-maintained, works with Next App Router. |
| Hosting | Vercel (current) | No change. |
| Mobile (Phase 3) | Same Supabase project | One DB, one auth system. App uses `supabase-flutter` or React Native SDK depending on stack. |

**Estimated cost at 10k MAU**: $0. Supabase free tier = 50k MAU, 500MB DB, 5GB bandwidth. Streak rows are ~100 bytes each, so 10k users = 1MB. We're nowhere near limits.

**First paid tier ($25/mo Pro)** kicks in at 100k MAU or if we need point-in-time recovery / longer log retention. Worth doing before launch if we're risk-averse about data loss.

---

## Data model

```sql
-- Supabase manages auth.users automatically. We add a profile + game data.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text unique,            -- nullable until set; required for leaderboards
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current int not null default 0,
  max int not null default 0,
  last_won_puzzle int,                  -- puzzle number, matches existing client logic
  updated_at timestamptz default now()
);

create table puzzle_results (
  user_id uuid references auth.users(id) on delete cascade,
  puzzle_number int not null,
  won boolean not null,
  guesses int,
  time_ms int,
  mode text,                            -- 'normal' | 'hard' etc, future-proofing
  played_at timestamptz default now(),
  primary key (user_id, puzzle_number)
);
```

**Why a separate `puzzle_results` table?** Cheap, future-proofs leaderboards ("fastest solve today"), and lets us recompute streaks server-side if a bug ever corrupts them. ~100 bytes/row × 365 days × 10k players = 365MB/year. Still cheap; archive after 2 years if needed.

**Row-level security (mandatory):**
```sql
alter table profiles enable row level security;
alter table streaks enable row level security;
alter table puzzle_results enable row level security;

-- Users can only read/write their own rows
create policy "own_rows" on streaks for all using (auth.uid() = user_id);
create policy "own_rows" on puzzle_results for all using (auth.uid() = user_id);

-- Profiles: own row writable, display_name publicly readable (for leaderboards)
create policy "read_all" on profiles for select using (true);
create policy "write_own" on profiles for update using (auth.uid() = id);
```

---

## Migration: localStorage → server

The single most important UX moment. Get this wrong and we wipe streaks on login.

**Rule:** server is canonical once logged in, but we **merge** localStorage into it on first sync — taking the higher value per field.

```ts
// Pseudocode for first login
const local = readStreak();              // { current, max, lastWon }
const remote = await fetchStreak();       // null on first login

const merged = {
  current: local.lastWon >= remote?.last_won_puzzle
    ? local.current
    : remote.current,
  max: Math.max(local.max, remote?.max ?? 0),
  last_won_puzzle: Math.max(local.lastWon, remote?.last_won_puzzle ?? 0),
};

await upsertStreak(merged);
```

After login, localStorage becomes a **write-through cache** — we update both, but server wins on conflict. Logged-out players still write to localStorage only.

---

## Phased delivery

### Phase 0 — Foundations (1-2 days, no user-visible change)

- Create Supabase project (EU region for GDPR proximity).
- Wire `@supabase/ssr` into Next middleware, server actions, route handlers.
- Add tables + RLS policies above.
- Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Vercel env (+ service-role key for admin tasks only).
- Feature flag: `NEXT_PUBLIC_ACCOUNTS_ENABLED=false`. Ship dormant.

**Deliverable:** infra exists, nothing user-visible.

### Phase 1 — MVP accounts (1 week)

User-visible scope:
- **Sign up / log in** via magic link. Single email field, one-click confirmation.
- **Streak sync** (the whole point): logged-in users' streaks read/write to Supabase, with localStorage merge on first login.
- **Account screen** (`/account`) with:
  - Email (read-only — changing email requires reverification flow; defer to Phase 2)
  - Display name (editable, unique, validated)
  - Log out button
  - Delete account button (hard delete, confirmation modal, cascades via FK)
- **Persistent sign-in entry point:** a "Sign in / Create account" link in the main menu (and a small button on the start screen for logged-out players) so anyone can sign up without waiting for a streak milestone. The nudge is for converting engaged players; the button is for the keen ones who want to opt in early.
- **The milestone nudge:** after a player hits a 3-day streak, show a one-time modal: *"Nice streak. Save it to your email so you don't lose it."* Dismissible. Track dismiss vs. accept in PostHog.
- **Streak-at-risk nudge:** if a logged-out player has a 7+ streak and hasn't created an account, show the nudge again after each win.

Best practices borrowed:
- **NYT Games**: account is optional, but they nag at meaningful milestones (streak, badges). Copy that pattern.
- **Duolingo**: shows "Don't lose your progress!" with the current streak number displayed. Specificity beats generic CTAs.
- **Wordle**: pure localStorage; we're explicitly going further because we want mobile + leaderboards.

**Out of scope for Phase 1:** password auth, social login, login history, email change.

### Phase 2 — Polish & trust (1 week)

- **Email change flow:** confirm on both old + new addresses.
- **Login history**: simple table `auth_events (user_id, event_type, ip, user_agent, created_at)`. Surface last 10 events on `/account` ("Logged in from Chrome on Mac, 2 hours ago"). Builds trust, helps users spot unauthorised access.
- **Account deletion grace period:** soft-delete with 7-day undo via email link, then hard delete via cron. Prevents rage-quits.
- **Data export**: GDPR-friendly "Download my data" button → JSON of profile + all puzzle results. Cheap to build, expensive to skip if a regulator asks.
- **Custom email templates** via Resend: branded, on-message, no "noreply@supabase.co" sender.

### Phase 3 — Mobile app + social (timing TBD)

- App uses same Supabase project. Login on app = same streak.
- Display names become leaderboard-visible.
- Mini-leagues: invite-only groups of 5-20 players, weekly aggregate score. Separate spec.
- Optional: Apple / Google sign-in (mobile expects it).

---

## Account screen — detailed UX

```
┌─────────────────────────────────────┐
│  Account                            │
├─────────────────────────────────────┤
│                                     │
│  Display name                       │
│  [paulc________________]  [Save]    │
│  Shown on leaderboards. 3-20 chars. │
│                                     │
│  Email                              │
│  paul@example.com                   │
│  [Change email]                     │
│                                     │
│  Your stats                         │
│  Current streak: 12                 │
│  Best streak: 34                    │
│  Puzzles played: 87                 │
│                                     │
│  Recent activity                    │
│  • Signed in · Chrome · 2h ago      │
│  • Signed in · iPhone · yesterday   │
│  • Signed in · Chrome · 3 days ago  │
│                                     │
│  ───────────────────────────────    │
│                                     │
│  [Log out]                          │
│                                     │
│  [Delete account]                   │
│  Permanently removes your data.     │
│                                     │
└─────────────────────────────────────┘
```

**Display name validation:**
- 3-20 chars, alphanumeric + `_-`
- Case-insensitive uniqueness (`paulc` and `PaulC` collide)
- Profanity filter (Phase 2; for MVP, accept and moderate reactively)
- Auto-suggest if taken: `paulc-42`

---

## Security

| Concern | Mitigation |
|---|---|
| Streak tampering | RLS ensures users can only write their own row. Streak increment validated server-side via a Postgres function or edge function — client can't post `current: 9999`. |
| Magic link interception | Supabase links are single-use, 1-hour expiry. Add IP/UA binding in Phase 2 if abuse appears. |
| Account takeover via email | Email change requires confirmation on **both** addresses (Phase 2). |
| Mass-deletion abuse | Soft delete + grace period (Phase 2). Hard delete confirmation requires typing display name. |
| Rate limiting | Supabase has built-in limits on auth endpoints. Add app-level rate limit on `record-win` (1 win per puzzle per user, enforced by PK on `puzzle_results`). |
| Service-role key leak | Never bundled client-side. Only used in trusted server actions for admin tasks (e.g. account deletion cleanup). |
| GDPR | EU region, data export endpoint, hard delete works. Add privacy policy line: "Streak data stored in Supabase (EU)." |

**Streak-write validation (server-side function):**

```sql
create function record_win(p_puzzle_number int)
returns streaks language plpgsql security definer as $$
declare result streaks;
begin
  insert into puzzle_results (user_id, puzzle_number, won)
  values (auth.uid(), p_puzzle_number, true)
  on conflict do nothing;  -- idempotent

  update streaks set
    current = case
      when last_won_puzzle = p_puzzle_number then current
      when last_won_puzzle = p_puzzle_number - 1 then current + 1
      else 1
    end,
    max = greatest(max, current),
    last_won_puzzle = p_puzzle_number,
    updated_at = now()
  where user_id = auth.uid()
  returning * into result;

  return result;
end $$;
```

Client just calls `supabase.rpc('record_win', { p_puzzle_number: N })`. No way to lie about it.

---

## Onboarding flow — the nudge

```
Player wins puzzle #3 in a row (logged out)
         │
         ▼
   Win modal shows as normal, with extra footer:

   ┌────────────────────────────────────┐
   │  ★ 3-day streak!                   │
   │                                    │
   │  Save it to your email so you      │
   │  don't lose it if you clear        │
   │  cookies or switch devices.        │
   │                                    │
   │  [your@email.com_______]           │
   │  [ Save my streak ]   [ Not now ]  │
   └────────────────────────────────────┘
```

- Single field, no password.
- One-tap "Not now" → suppress for 7 days, then re-prompt at next milestone (7-day, 14-day, 30-day streaks).
- After signup: success message references the streak number specifically ("Streak of 3 saved — see you tomorrow").
- PostHog events: `account_nudge_shown`, `account_nudge_dismissed`, `account_nudge_email_submitted`, `account_created`.

**Borrowed from:**
- Duolingo's loss-aversion framing ("don't lose")
- NYT's milestone-triggered prompts (only after meaningful engagement)
- Wordle Bot's quiet, non-modal nudges (we can A/B test inline vs. modal in Phase 2)

---

## Telemetry

PostHog events to add:
- `auth_magic_link_requested` (email domain only, not full address)
- `auth_login_success` / `auth_login_failed`
- `auth_logout`
- `account_deleted`
- `display_name_set` (first time)
- `streak_sync_first_login` — with `local_streak`, `remote_streak`, `merged_streak` for debugging

Key funnel: `nudge_shown → email_submitted → magic_link_clicked → first_login → streak_synced`. If drop-off is steep at magic-link-clicked, that's the signal to add social login.

---

## Resolved decisions

1. **Email change:** Phase 2. Adds two-sided confirmation complexity for an edge case.
2. **Nudge timing:** Day 3 streak milestone. Plus a persistent "Sign in / Create account" entry point in the menu and start screen so early adopters don't have to wait for a streak.
3. **Anonymous Supabase users:** Phase 2. Ship MVP with localStorage merge first; revisit if nudge conversion is weak.
4. **Public exposure of `puzzle_results`:** private by default. To be clear, this table holds each player's own scores (time, guesses, win/loss per puzzle) — never solutions. Aggregate-only views for leaderboards in Phase 3 (e.g. "fastest solve today" via a SQL view that exposes display_name + time, not raw rows).
5. **Supabase region:** EU. GDPR proximity, locked in at project creation.

---

## Rollout plan

1. Ship Phase 0 behind flag. Smoke test internally.
2. Enable flag for 10% of traffic. Watch error rates and `streak_sync_first_login` for merge bugs.
3. 100% rollout.
4. Phase 1 nudge ships separately, behind its own flag, so we can A/B copy / timing.
5. After 4 weeks of MVP data, decide Phase 2 priorities based on what's actually breaking or converting.
