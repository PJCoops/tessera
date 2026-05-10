import type { ReactNode } from "react";

// Mini tile swatch matching the real grid colours 1:1, so what you see in
// the help modal and on the board legend is identical to what you're
// looking for on the puzzle. Lives in its own module so both the game
// and the help modal can use it without a circular import.
export function Legend({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "row" | "bonus" | "hint";
}) {
  const isHint = variant === "hint";
  const bg = isHint ? "var(--color-cream)" : variant === "bonus" ? "#b85a1c" : "#7a9070";
  // Sage/rust swatches have fixed backgrounds — pin their text contrast too so
  // they read the same in light and dark themes. Hint tile follows the theme.
  const color = isHint ? "var(--color-ink)" : "#fafaf7";
  const letter = isHint ? "A" : variant === "row" ? "B" : "C";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-[3px] text-[11px] font-medium leading-none"
        style={{
          background: bg,
          color,
          outline: isHint ? "2px dashed var(--color-ink)" : undefined,
          outlineOffset: isHint ? "-3px" : undefined,
        }}
      >
        {letter}
      </span>
      {children}
    </span>
  );
}
