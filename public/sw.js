// Tessera service worker. Minimal on purpose:
//   - handles push events from the daily reminder cron
//   - opens / focuses the puzzle when a notification is tapped
//   - skips waiting on install and claims clients on activate so a
//     freshly-deployed worker takes over without a tab reload
//
// No offline cache in v1. The puzzle generates on-device, but the app
// shell still needs network. Adding caching incorrectly is a worse
// experience than not having it (stale assets, broken locale switches),
// so we ship without and revisit only if there's a clear demand signal.
//
// Served from the site root with no-cache headers (configured in
// next.config.ts) so users always pick up the latest worker on next
// visit.

self.addEventListener("install", (event) => {
  // Activate immediately rather than waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    // If a malformed push gets through, fall back to a generic prompt
    // so the user still sees something rather than nothing.
    payload = { title: "Tessera", body: "Today's puzzle is ready.", url: "/" };
  }

  const title = payload.title || "Tessera";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    // Tag so successive daily reminders replace rather than stack — a
    // user who's been offline for a week shouldn't wake up to seven
    // identical notifications.
    tag: payload.tag || "tessera-daily",
    renotify: true,
    data: {
      url: payload.url || "/",
      sentAt: Date.now(),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  // Focus an existing tab on the same origin if the user already has
  // the puzzle open — feels less jarring than spawning a duplicate.
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const sameOrigin = all.find((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch (e) {
          return false;
        }
      });
      if (sameOrigin) {
        await sameOrigin.focus();
        if ("navigate" in sameOrigin) {
          try {
            await sameOrigin.navigate(target);
          } catch (e) {
            // Some browsers reject cross-document navigation; the focus
            // alone is still useful.
          }
        }
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
