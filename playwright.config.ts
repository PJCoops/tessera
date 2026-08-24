import { defineConfig, devices } from "@playwright/test";

// Playwright starts the app itself (see `webServer` below) and every
// `page.goto("/")` resolves against this.
const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

// The two axes of the theme matrix. Kept as data so the project list below is
// a cross product rather than nine hand-written blocks.
const BROWSERS = [
  { id: "chromium", use: devices["Desktop Chrome"] },
  { id: "firefox", use: devices["Desktop Firefox"] },
  { id: "webkit", use: devices["Desktop Safari"] },
];

const BREAKPOINTS = [
  { id: "mobile", viewport: { width: 390, height: 844 } },
  { id: "tablet", viewport: { width: 834, height: 1112 } },
  { id: "desktop", viewport: { width: 1440, height: 900 } },
];

const THEME_SPEC = /theme\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // One worker: `next dev` compiles routes on demand and several browsers
  // hitting it at once make it crawl. Against a production build
  // (`npm run build && npm run start`) you can raise or drop this.
  workers: 1,
  // A stray `test.only` should fail CI rather than silently skip the suite.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : [["html", { open: "never" }]],

  use: {
    baseURL,
    // Keep a trace for anything that failed and got retried — open it with
    // `npx playwright show-trace <path>` for a frame-by-frame replay.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // The everyday suite: behaviour doesn't change per browser, so one
    // desktop engine plus a real phone is enough. `testIgnore` keeps the
    // theme spec out — it has its own matrix below.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: THEME_SPEC,
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
      testIgnore: THEME_SPEC,
    },

    // Theme matrix: every browser at every breakpoint, theme spec only.
    // Run just this group with `npx playwright test --grep @theme`.
    ...BROWSERS.flatMap((browser) =>
      BREAKPOINTS.map((breakpoint) => ({
        name: `theme-${browser.id}-${breakpoint.id}`,
        use: { ...browser.use, viewport: breakpoint.viewport },
        testMatch: THEME_SPEC,
      }))
    ),
  ],

  webServer: {
    // Next refuses to run two dev servers for the same directory, so with
    // `reuseExistingServer` this attaches to the one you already have open.
    // `next dev` is fine for local runs. For a CI-realistic run swap this
    // for `npm run build && npm run start -- --port ${PORT}`.
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
