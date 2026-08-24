import { test, expect } from "./fixtures";

test("today's puzzle can be solved, and stays solved on reload", async ({
  page,
  grid,
}) => {
  // `?solve` renders today's board already solved and records nothing — a
  // ready-made answer key for the real board.
  await page.goto("/?solve");
  const solution = await grid.rows();
  expect(solution).toHaveLength(4);

  await page.goto("/");
  await grid.solveTo(solution);

  await expect(page.getByText(/Solved in \d+ moves?/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Challenge a friend/ })).toBeVisible();

  await page.reload();

  // The result is persisted in localStorage, so the game still knows today is
  // done. Note the board comes back scrambled — the app restores the *result*,
  // not the solved arrangement.
  await expect(page.getByText(/Solved in \d+ moves?/)).toBeVisible();
});

test("?day= opens a past puzzle in replay mode", async ({ page }) => {
  await page.goto("/?day=2026-05-01");

  await expect(page.getByText("Replay", { exact: true })).toBeVisible();
  await expect(page.getByText(/Tessera · #\d+ · 2026-05-01/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to today/ })).toBeVisible();
  await expect(page.getByTestId("tile")).toHaveCount(16);
});

test("a future ?day= silently falls back to today", async ({ page }) => {
  await page.goto("/?day=2099-01-01");

  await expect(page.getByText("Replay", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("tile")).toHaveCount(16);
});
