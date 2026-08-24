import { expect, type Locator, type Page } from "@playwright/test";

// Small "page object": one place that knows how Tessera's board is built, so
// the specs read like descriptions of player behaviour instead of selectors.
export class Grid {
  readonly n: number;

  constructor(private readonly page: Page, n = 4) {
    this.n = n;
  }

  /** The tile currently sitting at grid position `pos` (0 = top-left). */
  tile(pos: number): Locator {
    return this.page.locator(`[data-testid="tile"][data-position="${pos}"]`);
  }

  /** Letters by grid position, e.g. index 5 is row 2, column 2. */
  async letters(): Promise<string[]> {
    const tiles = this.page.getByTestId("tile");
    // A web-first assertion: retries until all 16 tiles are mounted, so we
    // never read a half-rendered board.
    await expect(tiles).toHaveCount(this.n * this.n);
    const found = await tiles.evaluateAll((els) =>
      els.map((el) => ({
        pos: Number(el.getAttribute("data-position")),
        letter: (el.textContent ?? "").trim(),
      }))
    );
    const letters: string[] = new Array(this.n * this.n).fill("");
    for (const { pos, letter } of found) letters[pos] = letter;
    return letters;
  }

  /** The board as words, top row first: ["SHOW", "HAVE", ...]. */
  async rows(): Promise<string[]> {
    const letters = await this.letters();
    return Array.from({ length: this.n }, (_, r) =>
      letters.slice(r * this.n, r * this.n + this.n).join("")
    );
  }

  /** One player move: tap a tile, then tap the tile to trade places with. */
  async swap(a: number, b: number): Promise<void> {
    await this.tile(a).click();
    await this.tile(b).click();
  }

  /**
   * Play the board to `target` (rows as words). Tiles are interchangeable by
   * letter, so a selection sort over positions always finishes in at most
   * N*N - 1 swaps.
   */
  async solveTo(target: string[]): Promise<void> {
    const want = target.join("").toUpperCase().split("");
    const have = await this.letters();
    expect([...have].sort()).toEqual([...want].sort()); // same bag of letters

    for (let i = 0; i < want.length; i++) {
      if (have[i] === want[i]) continue;
      const j = have.findIndex(
        (letter, k) => k > i && letter === want[i] && have[k] !== want[k]
      );
      expect(j, `no tile left to place ${want[i]} at ${i}`).toBeGreaterThan(-1);
      await this.swap(i, j);
      [have[i], have[j]] = [have[j], have[i]];
    }
  }
}

/** The fixed board behind `?demo` — see app/lib/demo-grid.json. */
export const DEMO_SOLUTION = ["SHOW", "HAVE", "OVER", "WERE"];
