import { test, expect } from "./fixtures";

// Resolved values of --color-paper in app/globals.css.
const PAPER_LIGHT = "rgb(250, 250, 247)";
const PAPER_DARK = "rgb(14, 14, 14)";

// Tessera resolves the theme from two inputs: an explicit choice saved in
// localStorage (applied by the inline script in app/layout.tsx before
// hydration), falling back to the OS `prefers-color-scheme`.
//
// `test.use({ colorScheme })` emulates the OS setting for a whole describe
// block — that's the axis this file is really about. The browser and the
// viewport come from the project matrix in playwright.config.ts, so these
// tests run once per browser × breakpoint without knowing anything about it.

test.describe("system theme", { tag: "@theme" }, () => {
  test.describe("with a dark OS preference", () => {
    test.use({ colorScheme: "dark" });

    test("paints the page dark", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("body")).toHaveCSS("background-color", PAPER_DARK);
    });
  });

  test.describe("with a light OS preference", () => {
    test.use({ colorScheme: "light" });

    test("paints the page light", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("body")).toHaveCSS("background-color", PAPER_LIGHT);
    });
  });
});

test.describe("explicit theme choice", { tag: "@theme" }, () => {
  test.use({ colorScheme: "light" });

  test("a saved preference overrides the OS setting", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("tessera:theme", "dark");
    });

    await page.goto("/");

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("body")).toHaveCSS("background-color", PAPER_DARK);
  });

  test("choosing Dark in Settings applies at once and survives a reload", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("body")).toHaveCSS("background-color", PAPER_LIGHT);

    await page.getByRole("button", { name: "How to play" }).click();
    await page.getByRole("button", { name: "Settings" }).click();
    await page
      .getByRole("radiogroup", { name: "Theme" })
      .getByRole("radio", { name: "Dark" })
      .click();

    await expect(page.locator("body")).toHaveCSS("background-color", PAPER_DARK);

    await page.reload();

    // No flash of the wrong theme either: the inline script in layout.tsx
    // sets the class before React hydrates.
    await expect(page.locator("body")).toHaveCSS("background-color", PAPER_DARK);
  });
});
