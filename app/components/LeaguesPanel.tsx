"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../lib/locale-context";
import type { ModeId } from "../lib/mode";
import { track } from "../lib/analytics";
import { type Entry, BoardRow } from "./LeaderboardModal";

type League = { id: string; name: string; inviteCode: string; memberCount: number };
type TallyRow = { handle: string; daysWon: number; isMe: boolean };
type Standings = {
  league: { id: string; name: string; inviteCode: string };
  board: Entry[];
  tally: TallyRow[];
  hasHandle: boolean;
};

type View = "list" | "create" | "join" | { standings: string };

// The Leagues tab inside the leaderboard modal. Self-contained little view
// machine: my-leagues list, create, join, and a standings sub-view.
export function LeaguesPanel({
  mode,
  num,
  signedIn,
  onOpenAccount,
  onOpenHandle,
}: {
  mode: ModeId;
  num: number;
  signedIn: boolean;
  onOpenAccount: () => void;
  onOpenHandle: () => void;
}) {
  const { t } = useLocale();
  const [view, setView] = useState<View>("list");
  const [leagues, setLeagues] = useState<League[] | null>(null);

  const loadLeagues = useCallback(async () => {
    try {
      const res = await fetch("/api/leagues");
      const json = (await res.json()) as { ok: boolean; leagues: League[] };
      if (json.ok) setLeagues(json.leagues);
    } catch {}
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLeagues();
  }, [signedIn, loadLeagues]);

  if (!signedIn) {
    return <Prompt text={t("leagues.signInPrompt")} cta={t("account.signIn")} onClick={onOpenAccount} />;
  }

  if (view === "create") {
    return <CreateView onDone={() => { setView("list"); void loadLeagues(); }} onCancel={() => setView("list")} />;
  }
  if (view === "join") {
    return <JoinView onDone={() => { setView("list"); void loadLeagues(); }} onCancel={() => setView("list")} />;
  }
  if (typeof view === "object") {
    return (
      <StandingsView
        leagueId={view.standings}
        mode={mode}
        num={num}
        onBack={() => setView("list")}
        onOpenHandle={onOpenHandle}
      />
    );
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          onClick={() => setView("create")}
          className="flex-1 px-3 py-2 text-xs bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity"
        >
          {t("leagues.create")}
        </button>
        <button
          onClick={() => setView("join")}
          className="flex-1 px-3 py-2 text-xs border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
        >
          {t("leagues.join")}
        </button>
      </div>
      <div className="mt-3 divide-y divide-[color:var(--color-rule)]">
        {leagues === null ? (
          <p className="py-6 text-center text-xs text-[color:var(--color-muted)]">{t("leaderboard.loading")}</p>
        ) : leagues.length === 0 ? (
          <p className="py-6 text-center text-xs text-[color:var(--color-muted)]">{t("leagues.empty")}</p>
        ) : (
          leagues.map((l) => (
            <button
              key={l.id}
              onClick={() => setView({ standings: l.id })}
              className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-[color:var(--color-cream)] px-2 -mx-2 rounded transition-colors"
            >
              <span className="text-sm font-medium truncate">{l.name}</span>
              <span className="flex-shrink-0 text-xs text-[color:var(--color-muted)]">
                {t("leagues.members", { n: l.memberCount })}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function Prompt({ text, cta, onClick }: { text: string; cta: string; onClick: () => void }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 py-6">
      <p className="text-sm text-[color:var(--color-muted)] text-center">{text}</p>
      <button
        onClick={onClick}
        className="px-4 py-2 text-xs border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors"
      >
        {cta}
      </button>
    </div>
  );
}

function CreateView({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || name.trim().length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = (await res.json()) as { ok: boolean; league?: { name: string; inviteCode: string } };
      if (json.ok && json.league) {
        track("league_created", {});
        setCreated(json.league);
      }
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const link = `${window.location.origin}/?join=${created.inviteCode}`;
    return (
      <div className="mt-4">
        <p className="text-sm font-medium">{created.name}</p>
        <p className="mt-1 text-xs text-[color:var(--color-muted)]">{t("leagues.shareInvite")}</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-cream)] px-3 py-2 text-xs">{link}</code>
          <button
            onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); }}
            className="flex-shrink-0 px-3 py-2 text-xs bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity"
          >
            {copied ? t("leagues.copied") : t("leagues.copyLink")}
          </button>
        </div>
        <button onClick={onDone} className="mt-4 w-full px-4 py-2 text-xs border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors">
          {t("leagues.done")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
      <BackLink onClick={onCancel} label={t("leagues.back")} />
      <input
        autoFocus
        maxLength={40}
        placeholder={t("leagues.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy}
        className="w-full rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] px-3 py-2 text-sm placeholder:text-[color:var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/20"
      />
      <button type="submit" disabled={busy || name.trim().length === 0} className="w-full px-4 py-2 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">
        {t("leagues.create")}
      </button>
    </form>
  );
}

function JoinView({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useLocale();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || code.trim().length === 0) return;
    setBusy(true);
    setNotFound(false);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.status === 404) { setNotFound(true); return; }
      if (res.ok) { track("league_joined", {}); onDone(); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2">
      <BackLink onClick={onCancel} label={t("leagues.back")} />
      <input
        autoFocus
        maxLength={12}
        placeholder={t("leagues.codePlaceholder")}
        value={code}
        onChange={(e) => { setCode(e.target.value.toUpperCase()); setNotFound(false); }}
        disabled={busy}
        className="w-full rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-paper)] px-3 py-2 text-sm tracking-widest text-center placeholder:tracking-normal placeholder:text-[color:var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/20"
      />
      <button type="submit" disabled={busy || code.trim().length === 0} className="w-full px-4 py-2 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-50">
        {t("leagues.join")}
      </button>
      {notFound && <p className="text-[11px] text-red-700">{t("leagues.notFound")}</p>}
    </form>
  );
}

function StandingsView({
  leagueId,
  mode,
  num,
  onBack,
  onOpenHandle,
}: {
  leagueId: string;
  mode: ModeId;
  num: number;
  onBack: () => void;
  onOpenHandle: () => void;
}) {
  const { t } = useLocale();
  const [data, setData] = useState<Standings | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}?mode=${mode}&num=${num}`);
      const json = (await res.json()) as { ok: boolean } & Standings;
      if (json.ok) setData(json);
    } catch {}
  }, [leagueId, mode, num]);

  useEffect(() => {
    track("league_standings_viewed", {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!data) return <p className="py-6 text-center text-xs text-[color:var(--color-muted)]">{t("leaderboard.loading")}</p>;
  const link = `${window.location.origin}/?join=${data.league.inviteCode}`;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <BackLink onClick={onBack} label={t("leagues.back")} />
        <button
          onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); }}
          className="text-[11px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] underline-offset-4 hover:underline"
        >
          {copied ? t("leagues.copied") : t("leagues.copyLink")}
        </button>
      </div>
      <p className="mt-2 text-sm font-medium">{data.league.name}</p>

      {!data.hasHandle && (
        <button onClick={onOpenHandle} className="mt-2 w-full px-3 py-1.5 text-[11px] border border-[color:var(--color-rule)] rounded-md hover:bg-[color:var(--color-cream)] transition-colors">
          {t("leagues.noHandlePrompt")}
        </button>
      )}

      <p className="mt-3 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{t("leagues.today")}</p>
      <div className="mt-1">
        {data.board.length === 0 ? (
          <p className="py-3 text-center text-xs text-[color:var(--color-muted)]">{t("leagues.noneToday")}</p>
        ) : (
          data.board.map((e) => <BoardRow key={`${e.rank}-${e.handle}`} e={e} />)
        )}
      </div>

      <p className="mt-4 text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{t("leagues.daysWon")}</p>
      <div className="mt-1">
        {data.tally.map((r) => (
          <div
            key={r.handle}
            className={`grid grid-cols-[1fr_auto] gap-2 items-center px-2 py-1.5 text-xs tabular-nums border-t border-[color:var(--color-rule)] ${r.isMe ? "bg-[color:var(--color-cream)] font-medium" : ""}`}
          >
            <span className="truncate">{r.handle}</span>
            <span>🏆 {r.daysWon}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="text-[11px] text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] underline-offset-4 hover:underline">
      ← {label}
    </button>
  );
}
