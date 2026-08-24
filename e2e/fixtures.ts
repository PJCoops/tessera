import { test as base, expect, type Page } from "@playwright/test";
import { Grid } from "./grid";

/**
 * Dismiss the cookie banner before the app boots. `addInitScript` runs in the
 * page before any of its own JavaScript, so the consent cookie is already
 * there when the provider looks for it and the banner never opens — no
 * clicking through it in every test.
 */
export async function seedConsent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const value = encodeURIComponent(
      JSON.stringify({ v: 1, analytics: false, marketing: false, t: Date.now() })
    );
    document.cookie = `tessera_consent=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  });
}

/**
 * Stop public/sw.js from registering. Two reasons: a caching service worker
 * is a liability in tests, and Playwright's WebKit build freezes the page
 * outright once it registers — which is what the Settings tab does via
 * PushReminderToggle. (Real Safari is likely fine; this is a harness quirk.)
 */
export async function blockServiceWorker(page: Page): Promise<void> {
  await page.route("**/sw.js", (route) => route.abort());
}

type Fixtures = {
  /** Helper for reading and playing the board (see e2e/grid.ts). */
  grid: Grid;
};

/**
 * Playwright already gives every test a fresh browser profile, so nothing
 * leaks between tests. What it can't know is that Tessera has first-run
 * behaviour that would otherwise fight the test:
 *
 *  - the cookie banner,
 *  - the start screen, shown until the player presses Play once, and
 *  - an idle "watch me swap" animation that fires 7s into a first visit.
 *
 * Tests that want the first-run experience import `test` from
 * "@playwright/test" instead and seed only what they need.
 */
export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await seedConsent(page);
    await blockServiceWorker(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("tessera:seen-start", "1");
      window.localStorage.setItem("tessera:demo-played", "1");
    });
    await use(page);
  },
  grid: async ({ page }, use) => {
    await use(new Grid(page));
  },
});

export { expect };
