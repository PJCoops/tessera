"use client";

// Mode-tabbed wrapper for today's social blurb. Both blurbs are built
// on the server and passed in as strings; the client just toggles
// which one is shown.

import { useState } from "react";

type Mode = "classic" | "hard";

export function SocialBlurbTabs({ classic, hard }: { classic: string; hard: string }) {
  const [mode, setMode] = useState<Mode>("classic");
  const blurb = mode === "classic" ? classic : hard;
  return (
    <>
      <div className="flex items-center gap-1 mb-3" role="tablist" aria-label="Mode">
        {(["classic", "hard"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m)}
              className={
                "px-3 py-1 text-xs rounded-md border " +
                (active
                  ? "bg-[color:var(--color-ink)] text-[color:var(--color-cream)] border-[color:var(--color-ink)]"
                  : "bg-transparent text-[color:var(--color-muted)] border-[color:var(--color-rule)] hover:text-[color:var(--color-ink)]")
              }
            >
              {m === "classic" ? "Classic" : "Hard"}
            </button>
          );
        })}
      </div>
      <pre className="whitespace-pre-wrap break-words p-5 rounded-md bg-[color:var(--color-cream)] border border-[color:var(--color-rule)] text-sm leading-relaxed font-[inherit] select-all cursor-text">
        {blurb}
      </pre>
    </>
  );
}
