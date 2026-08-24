// This spec is about the *first* visit, so it uses the stock `test` with an
// untouched localStorage rather than the seeded fixture in ./fixtures — only
// the cookie banner is dismissed so it can't cover the buttons.
import { test, expect } from "@playwright/test";
import { blockServiceWorker, seedConsent } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
  await blockServiceWorker(page);
});

test("a first-time visitor gets the start screen, then the board", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Tessera" })).toBeVisible();
  await expect(
    page.getByText("Swap tiles until every row spells the correct word.")
  ).toBeVisible();
  // The playable board hasn't been mounted yet.
  await expect(page.getByTestId("tile")).toHaveCount(0);

  await page.getByRole("button", { name: "Play", exact: true }).click();

  await expect(page.getByTestId("tile")).toHaveCount(16);
});

test("the start screen is not shown again after playing once", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByTestId("tile")).toHaveCount(16);

  await page.reload();

  // Straight to the board — no Play button in the way.
  await expect(page.getByTestId("tile")).toHaveCount(16);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
});

test("How to play opens the rules", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "How to play" }).click();

  const heading = page.getByRole("heading", { name: /Tessera Puzzle/ });
  await expect(heading).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await expect(heading).toBeHidden();
});
