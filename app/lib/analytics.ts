// Thin wrapper around PostHog's capture(), Meta Pixel's fbq(), and our
// /api/meta-event Conversions API endpoint. Call sites stay tidy and SSR /
// failure cases never throw. Add new event types here as we add them — keeps
// the event vocabulary in one place.
import posthog from "posthog-js";

type Props = Record<string, string | number | boolean | null>;

export type AnalyticsEvent =
  | "puzzle_started"
  | "puzzle_solved"
  | "puzzle_revealed"
  | "hide_hints_toggled"
  | "muted_toggled"
  | "email_subscribed";

// Mirror to Meta only the events worth optimizing ad delivery against.
// PageView is auto-fired by the Pixel snippet itself. ViewContent is a
// standard event Meta uses for custom-audience seed; PuzzleSolved is a
// custom event we'll later set as the campaign optimization target once
// we have ~50 events/week.
const META_EVENT_MAP: Partial<Record<AnalyticsEvent, { name: string; standard: boolean }>> = {
  puzzle_started: { name: "ViewContent", standard: true },
  puzzle_solved: { name: "PuzzleSolved", standard: false },
};

function makeEventId(): string {
  // crypto.randomUUID is widely supported (>97% of browsers as of 2026); fall
  // back to a non-cryptographic random for the long tail. Either way, the id
  // only needs to match the corresponding CAPI call.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function track(event: AnalyticsEvent, props?: Props): void {
  if (typeof window === "undefined") return;

  // PostHog
  try {
    posthog.capture(event, props);
  } catch {
    // analytics must never break gameplay
  }

  // Meta: fire Pixel and CAPI with the same event_id so Meta dedupes.
  const meta = META_EVENT_MAP[event];
  if (!meta) return;

  const eventId = makeEventId();

  // Pixel (browser-side; lost to adblockers ~30-50%)
  if (typeof window.fbq === "function") {
    try {
      window.fbq(
        meta.standard ? "track" : "trackCustom",
        meta.name,
        props ?? {},
        { eventID: eventId }
      );
    } catch {
      // ditto
    }
  }

  // CAPI (server-side; survives adblockers, fire-and-forget). keepalive lets
  // the request finish even if the user navigates away.
  try {
    fetch("/api/meta-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: meta.name,
        event_id: eventId,
        event_source_url: window.location.href,
        custom_data: props,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ditto
  }
}
