import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Unit/integration tests run under Vitest (`npm test`). End-to-end specs in
// `e2e/` are Playwright and must not be picked up by Vitest's spec glob —
// they import `@playwright/test` and fail here. Playwright runs them via
// `npm run test:e2e` (see playwright.config.ts).
export default defineConfig({
  resolve: {
    alias: {
      // `server-only` throws on import outside a React Server Component.
      // The node test suite exercises the server puzzle engine directly, so
      // stub it to a no-op here. Next.js still enforces it at build time.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "e2e/**", ".next/**", "dist/**"],
  },
});
