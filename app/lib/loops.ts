// Thin wrapper over the Loops transactional-events API. Loops holds the
// email templates and localisation; we just fire named events with
// properties. Matches the inline fetch in app/api/cron/daily-reminder.
//
// Required env: LOOPS_API_KEY

const EVENT_ENDPOINT = "https://app.loops.so/api/v1/events/send";

export async function sendLoopsEvent(
  email: string,
  eventName: string,
  eventProperties?: Record<string, string | number | boolean>,
): Promise<{ ok: boolean; status: number }> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.warn(`loops: LOOPS_API_KEY unset, skipping event "${eventName}"`);
    return { ok: false, status: 0 };
  }
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(EVENT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(eventProperties ? { email, eventName, eventProperties } : { email, eventName }),
      signal: ctrl.signal,
    });
    if (!res.ok) console.error(`loops event "${eventName}" -> ${res.status}`);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error(`loops event "${eventName}" failed:`, e);
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}
