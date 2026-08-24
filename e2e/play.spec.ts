import { test, expect } from "./fixtures";
import { DEMO_SOLUTION } from "./grid";

// `?demo` loads a fixed SHOW/HAVE/OVER/WERE board and records nothing, which
// makes it the ideal surface for testing the core mechanic.
test.describe("the swap mechanic", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo");
  });

  test("the practice board holds the demo letters, scrambled", async ({ grid }) => {
    const rows = await grid.rows();

    expect(rows.join("").split("").sort()).toEqual(
      DEMO_SOLUTION.join("").split("").sort()
    );
    expect(rows).not.toEqual(DEMO_SOLUTION); // it starts scrambled
  });

  test("tapping two tiles trades their letters and counts a move", async ({
    page,
    grid,
  }) => {
    const before = await grid.letters();

    await grid.swap(0, 1);

    const after = await grid.letters();
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
    expect(after.slice(2)).toEqual(before.slice(2)); // nothing else moved
    await expect(page.getByText(/Moves 1/)).toBeVisible();
  });

  test("a solved board reports how many moves it took", async ({ page, grid }) => {
    await grid.solveTo(DEMO_SOLUTION);

    expect(await grid.rows()).toEqual(DEMO_SOLUTION);
    await expect(page.getByText(/Solved in \d+ moves?/)).toBeVisible();
  });
});
