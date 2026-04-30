// Thin wrapper around PostHog's capture() so call sites stay tidy and SSR /
// failure cases never throw. Add new event types here as we add them — keeps
// the event vocabulary in one place.
import posthog from "posthog-js";

type Props = Record<string, string | number | boolean | null>;

export type AnalyticsEvent =
  | "puzzle_started"
  | "puzzle_solved"
  | "puzzle_revealed"
  | "hide_hints_toggled";

export function track(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, props);
  } catch {
    // analytics must never break gameplay
  }
}
