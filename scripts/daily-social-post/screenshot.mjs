import puppeteer from "puppeteer";

const TARGET_URL = process.env.PUZZLE_URL || "https://tesserapuzzle.com/";
const ORIGIN = new URL(TARGET_URL).origin;

export async function captureScreenshot(outPath) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    // Squareish portrait viewport: the board is centered with max-width ~520px
    // and the header/footer chrome fits in ~1100px tall. Wider viewports leave
    // huge black margins around the board.
    // Generous viewport so the board renders at full size; we crop tight after.
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    // Pre-seed localStorage so the live puzzle renders in light mode without
    // the splash/demo overlays. Keys come from:
    //  - app/StartScreen.tsx        → tessera:seen-start
    //  - app/TesseraGame.tsx        → tessera:demo-played, tessera:theme
    await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.setItem("tessera:seen-start", "1");
      localStorage.setItem("tessera:demo-played", "1");
      localStorage.setItem("tessera:theme", "light");
    });

    await page.goto(TARGET_URL, { waitUntil: "networkidle0", timeout: 60_000 });
    // Let layout settle + intro animations finish.
    await new Promise((r) => setTimeout(r, 1500));

    // Tight crop around the game container (the <main>'s first child wraps
    // the title, grid, and controls). Small padding so tiles don't kiss edges.
    const PAD = 32;
    const box = await page.evaluate((pad) => {
      const el =
        document.querySelector("main > div") ||
        document.querySelector("main") ||
        document.body;
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, Math.floor(r.left - pad)),
        y: Math.max(0, Math.floor(r.top - pad)),
        width: Math.ceil(r.width + pad * 2),
        height: Math.ceil(r.height + pad * 2),
      };
    }, PAD);

    await page.screenshot({ path: outPath, type: "png", clip: box });
  } finally {
    await browser.close();
  }
  return outPath;
}
