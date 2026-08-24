import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only. The Playwright specs in e2e/ share the `.spec.ts`
    // suffix but need a browser and a running server — `npm run test:e2e`
    // owns those.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
