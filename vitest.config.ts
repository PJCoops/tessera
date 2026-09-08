import { configDefaults, defineConfig } from "vitest/config";

// Unit/integration tests run under Vitest (`npm test`). End-to-end specs in
// `e2e/` are Playwright and must not be picked up by Vitest's spec glob —
// they import `@playwright/test` and fail here. Playwright runs them via
// `npm run test:e2e` (see playwright.config.ts).
export default defineConfig({
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "e2e/**", ".next/**", "dist/**"],
  },
});
