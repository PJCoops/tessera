// Thin wrapper around PostHog's capture() and Meta Pixel's fbq(). Call sites
// stay tidy and SSR / failure cases never throw. Add new event types here as
// we add them — keeps the event vocabulary in one place.
import posthog from "posthog-js";

type Props = Record<string, string | number | boolean | null>;

export type AnalyticsEvent =
  | "puzzle_started"
  | "puzzle_solved"
  | "puzzle_revealed"
  | "hide_hints_toggled";

// Mirror to Meta only the events worth optimizing ad delivery against.
// PageView is auto-fired by the Pixel snippet itself. ViewContent is a
// standard event Meta uses for custom-audience seed; PuzzleSolved is a
// custom event we'll later set as the campaign optimization target once
// we have ~50 events/week.
const META_EVENT_MAP: Partial<Record<AnalyticsEvent, { name: string; standard: boolean }>> = {
  puzzle_started: { name: "ViewContent", standard: true },
  puzzle_solved: { name: "PuzzleSolved", standard: false },
};

export function track(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, props);
  } catch {
    // analytics must never break gameplay
  }
  const meta = META_EVENT_MAP[event];
  if (meta && typeof window.fbq === "function") {
    try {
      window.fbq(meta.standard ? "track" : "trackCustom", meta.name, props ?? {});
    } catch {
      // ditto
    }
  }
}
