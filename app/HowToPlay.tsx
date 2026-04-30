"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const SEEN_KEY = "tessera:seen-howto";
const DEF_CACHE_PREFIX = "tessera:def:";
const DEF_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function hasSeenHowTo(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHowToSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {}
}

type Tab = "how" | "words" | "settings";
type InitialTab = "how" | "words";

export function HowToPlay({
  open,
  onClose,
  goldRows,
  showWordsTab,
  initialTab = "how",
  hideHints,
  onHideHintsChange,
}: {
  open: boolean;
  onClose: () => void;
  goldRows: string[];
  showWordsTab: boolean;
  initialTab?: InitialTab;
  hideHints: boolean;
  onHideHintsChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[color:var(--color-ink)]/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[color:var(--color-paper)] border border-[color:var(--color-rule)] rounded-lg p-8 shadow-xl"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)] rounded"
            >
              ×
            </button>

            <h2 className="text-2xl font-light tracking-tight">Tessera.</h2>

            <div className="mt-4 flex gap-1 border-b border-[color:var(--color-rule)]">
              <TabButton active={tab === "how"} onClick={() => setTab("how")}>
                How to play
              </TabButton>
              {showWordsTab && (
                <TabButton active={tab === "words"} onClick={() => setTab("words")}>
                  Today&rsquo;s words
                </TabButton>
              )}
              <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
                Settings
              </TabButton>
            </div>

            <div className="mt-6">
              {tab === "how" && <HowToContent />}
              {tab === "words" && <WordsContent goldRows={goldRows} />}
              {tab === "settings" && (
                <SettingsContent hideHints={hideHints} onChange={onHideHintsChange} />
              )}
            </div>

            {tab === "how" && (
              <button
                onClick={onClose}
                className="mt-6 w-full px-4 py-2.5 text-sm bg-[color:var(--color-ink)] text-[color:var(--color-paper)] rounded-md hover:opacity-90 transition-opacity"
              >
                Play
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm transition-colors -mb-px border-b-2 ${
        active
          ? "border-[color:var(--color-ink)] text-[color:var(--color-ink)]"
          : "border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function HowToContent() {
  return (
    <ol className="space-y-5 text-sm">
      <li className="flex gap-4 items-start">
        <Step n={1} />
        <div>
          <p className="font-medium">Tap two tiles to swap them.</p>
          <p className="text-[color:var(--color-muted)] mt-1">
            Each swap is one move.
          </p>
        </div>
      </li>
      <li className="flex gap-4 items-start">
        <Step n={2} />
        <div>
          <p className="font-medium">Find today&rsquo;s four words.</p>
          <p className="text-[color:var(--color-muted)] mt-1">
            Each row is one specific word. Tiles with a green outline are already on the right row. Tiles fill green when the whole row matches today&rsquo;s word.
          </p>
        </div>
      </li>
      <li className="flex gap-4 items-start">
        <Step n={3} />
        <div>
          <p className="font-medium">The columns spell words too.</p>
          <p className="text-[color:var(--color-muted)] mt-1">
            Use them as a check. When all four rows match, the columns will too, and the whole grid turns gold.
          </p>
        </div>
      </li>
    </ol>
  );
}

type DefEntry = {
  word: string;
  loading: boolean;
  definition: string | null;
  partOfSpeech: string | null;
  resolvedFrom: string | null;
};
type DefCached = {
  definition: string | null;
  partOfSpeech: string | null;
  resolvedFrom: string | null;
  ts: number;
};

function readDefCache(word: string): DefCached | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEF_CACHE_PREFIX + word);
    if (!raw) return null;
    const c = JSON.parse(raw) as DefCached;
    if (Date.now() - c.ts > DEF_CACHE_TTL_MS) return null;
    if (c.definition === null) return null;
    return c;
  } catch {
    return null;
  }
}
function writeDefCache(word: string, c: DefCached) {
  try {
    window.localStorage.setItem(DEF_CACHE_PREFIX + word, JSON.stringify(c));
  } catch {}
}

async function lookupOne(word: string): Promise<{ definition: string | null; partOfSpeech: string | null }> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en_GB/${encodeURIComponent(word)}`);
    if (!res.ok) return { definition: null, partOfSpeech: null };
    const data = await res.json();
    const meaning = data?.[0]?.meanings?.[0];
    return {
      definition: meaning?.definitions?.[0]?.definition ?? null,
      partOfSpeech: meaning?.partOfSpeech ?? null,
    };
  } catch {
    return { definition: null, partOfSpeech: null };
  }
}
function lemmaCandidates(word: string): string[] {
  const out: string[] = [];
  if (word.endsWith("ies") && word.length > 3) out.push(word.slice(0, -3) + "y");
  if (word.endsWith("es") && word.length > 2) out.push(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 1) out.push(word.slice(0, -1));
  if (word.endsWith("ed") && word.length > 2) {
    out.push(word.slice(0, -1));
    out.push(word.slice(0, -2));
  }
  return Array.from(new Set(out));
}
async function fetchDefinition(word: string): Promise<DefCached> {
  const primary = await lookupOne(word);
  if (primary.definition) return { ...primary, resolvedFrom: null, ts: Date.now() };
  for (const cand of lemmaCandidates(word)) {
    const r = await lookupOne(cand);
    if (r.definition) return { ...r, resolvedFrom: cand, ts: Date.now() };
  }
  return { definition: null, partOfSpeech: null, resolvedFrom: null, ts: Date.now() };
}

function WordsContent({ goldRows }: { goldRows: string[] }) {
  const [entries, setEntries] = useState<DefEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const initial: DefEntry[] = goldRows.map((w) => {
      const cached = readDefCache(w);
      return {
        word: w,
        loading: cached === null,
        definition: cached?.definition ?? null,
        partOfSpeech: cached?.partOfSpeech ?? null,
        resolvedFrom: cached?.resolvedFrom ?? null,
      };
    });
    setEntries(initial);
    const toFetch = initial.filter((e) => e.loading).map((e) => e.word);
    Promise.all(
      toFetch.map(async (w) => {
        const c = await fetchDefinition(w);
        writeDefCache(w, c);
        return [w, c] as const;
      })
    ).then((pairs) => {
      if (cancelled) return;
      setEntries((prev) =>
        prev.map((e) => {
          const f = pairs.find(([w]) => w === e.word);
          if (!f) return e;
          return {
            ...e,
            loading: false,
            definition: f[1].definition,
            partOfSpeech: f[1].partOfSpeech,
            resolvedFrom: f[1].resolvedFrom,
          };
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [goldRows]);

  return (
    <>
      <ul className="space-y-5">
        {entries.map((e) => (
          <li key={e.word}>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg font-medium uppercase tracking-wide">{e.word}</span>
              {e.partOfSpeech && (
                <span className="text-xs italic text-[color:var(--color-muted)]">{e.partOfSpeech}</span>
              )}
              {e.resolvedFrom && (
                <span className="text-xs text-[color:var(--color-muted)]">
                  from <span className="italic">{e.resolvedFrom}</span>
                </span>
              )}
            </div>
            <p className="text-sm mt-1 text-[color:var(--color-ink-soft)]">
              {e.loading ? "…" : (e.definition ?? "Definition unavailable.")}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[10px] text-[color:var(--color-muted)]">
        Definitions from dictionaryapi.dev (en_GB).
      </p>
    </>
  );
}

function SettingsContent({
  hideHints,
  onChange,
}: {
  hideHints: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-5 text-sm">
      <label className="flex items-start gap-4 cursor-pointer">
        <span className="relative inline-flex flex-shrink-0 items-center w-10 h-6 mt-0.5">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={hideHints}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="absolute inset-0 rounded-full bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] peer-checked:bg-[color:var(--color-ink)] peer-checked:border-[color:var(--color-ink)] transition-colors" />
          <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-[color:var(--color-paper)] shadow transition-transform peer-checked:translate-x-4" />
        </span>
        <span>
          <span className="font-medium">Hide row hints</span>
          <span className="block text-[color:var(--color-muted)] mt-1">
            Removes the dotted outline that marks tiles already on the right row. Harder mode.
          </span>
        </span>
      </label>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[color:var(--color-cream)] text-sm font-medium text-[color:var(--color-ink)]">
      {n}
    </span>
  );
}
