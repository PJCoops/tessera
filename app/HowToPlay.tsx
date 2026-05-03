"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { LOCALES, LOCALE_COOKIE, type Locale, pathnameWithLocale } from "./lib/i18n";

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

type Tab = "how" | "words" | "settings" | "credits";
type InitialTab = "how" | "words";
type ThemePref = "system" | "light" | "dark";

const LANG_LABELS: Record<Locale, string> = { en: "English", es: "Español" };

export function HowToPlay({
  open,
  onClose,
  goldRows,
  showWordsTab,
  initialTab = "how",
  hideHints,
  onHideHintsChange,
  muted,
  onMutedChange,
  theme,
  onThemeChange,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  goldRows: string[];
  showWordsTab: boolean;
  initialTab?: InitialTab;
  hideHints: boolean;
  onHideHintsChange: (v: boolean) => void;
  muted: boolean;
  onMutedChange: (v: boolean) => void;
  theme: ThemePref;
  onThemeChange: (v: ThemePref) => void;
  locale: Locale;
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
              <TabButton active={tab === "credits"} onClick={() => setTab("credits")}>
                Credits
              </TabButton>
            </div>

            <div className="mt-6">
              {tab === "how" && <HowToContent />}
              {tab === "words" && <WordsContent goldRows={goldRows} />}
              {tab === "settings" && (
                <SettingsContent
                  hideHints={hideHints}
                  onHideHintsChange={onHideHintsChange}
                  muted={muted}
                  onMutedChange={onMutedChange}
                  theme={theme}
                  onThemeChange={onThemeChange}
                  locale={locale}
                />
              )}
              {tab === "credits" && <CreditsContent />}
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
  onHideHintsChange,
  muted,
  onMutedChange,
  theme,
  onThemeChange,
  locale,
}: {
  hideHints: boolean;
  onHideHintsChange: (v: boolean) => void;
  muted: boolean;
  onMutedChange: (v: boolean) => void;
  theme: ThemePref;
  onThemeChange: (v: ThemePref) => void;
  locale: Locale;
}) {
  // Locale change is a navigation, not local state. Write the cookie before
  // navigating — otherwise the proxy sees the stale value and redirects back.
  const onLanguageChange = (next: Locale) => {
    if (next === locale) return;
    if (typeof window === "undefined") return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const target = pathnameWithLocale(window.location.pathname, next) + window.location.search;
    window.location.href = target;
  };

  return (
    <div className="divide-y divide-[color:var(--color-rule)] text-sm">
      <SettingRow
        title="Theme"
        description="System follows your device. Light or dark stays on this browser."
        control={
          <Segmented
            value={theme}
            onChange={onThemeChange}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            ariaLabel="Theme"
          />
        }
      />
      <SettingRow
        title="Language"
        description="Changes UI language. Puzzle words stay the same."
        control={
          <Segmented
            value={locale}
            onChange={onLanguageChange}
            options={LOCALES.map((l) => ({ value: l, label: LANG_LABELS[l] }))}
            ariaLabel="Language"
          />
        }
      />
      <SettingRow
        title="Hide row hints"
        description="Removes the dotted outline that marks tiles already on the right row. Harder mode."
        control={<Toggle checked={hideHints} onChange={onHideHintsChange} ariaLabel="Hide row hints" />}
      />
      <SettingRow
        title="Mute"
        description="Silences the win jingle when you solve the puzzle."
        control={<Toggle checked={muted} onChange={onMutedChange} ariaLabel="Mute" />}
      />
    </div>
  );
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-[color:var(--color-muted)] mt-0.5 text-xs leading-snug">{description}</p>
      </div>
      <div className="flex-shrink-0 mt-0.5">{control}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label className="relative inline-flex items-center w-10 h-6 cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <span className="absolute inset-0 rounded-full bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] peer-checked:bg-[color:var(--color-ink)] peer-checked:border-[color:var(--color-ink)] transition-colors" />
      <span className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-[color:var(--color-paper)] shadow transition-transform peer-checked:translate-x-4" />
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-md bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              active
                ? "bg-[color:var(--color-paper)] text-[color:var(--color-ink)] shadow-sm"
                : "text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CreditsContent() {
  return (
    <div className="space-y-5 text-sm max-h-[60vh] overflow-y-auto pr-1">
      <section>
        <h3 className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
          Created by
        </h3>
        <p className="mt-2">
          <a
            href="https://pjcooper.design"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            Paul Cooper
          </a>
        </p>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
          Sound effects
        </h3>
        <ul className="mt-2 space-y-2 text-[color:var(--color-ink-soft)]">
          <li>
            <a
              href="https://freesound.org/s/808180/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Ice Cream Truck at Park Playground
            </a>
            {" "}by fudgealtoid. License: Attribution 4.0.
          </li>
          <li>
            <a
              href="https://freesound.org/s/615100/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Magic Game Win Success 2
            </a>
            {" "}by MLaudio. License: Creative Commons 0.
          </li>
          <li>
            <a
              href="https://freesound.org/s/274183/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Jingle Win Synth 04
            </a>
            {" "}by LittleRobotSoundFactory. License: Attribution 4.0.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
          Contributors
        </h3>
        <ul className="mt-2 space-y-1 text-[color:var(--color-ink-soft)]">
          <li>Christine Banfield</li>
          <li>Don Brown</li>
          <li>Alison Burd</li>
          <li>Brett Pandora</li>
          <li>Richard Pattie</li>
        </ul>
      </section>
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
