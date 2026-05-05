// Regenerate PWA icons from the 1024×1024 master at app/icon.png.
// Outputs:
//   public/icon-192.png          — Android home-screen launcher
//   public/icon-512.png          — high-DPI Android, splash
//   public/icon-512-maskable.png — adaptive icon with safe-area padding
//                                  (10% inset on each side per W3C maskable spec)
//
// Run with: node scripts/build-pwa-icons.mjs
//
// Sharp is pulled in transitively by Next; if it ever stops shipping,
// install it explicitly with `npm i -D sharp` and rerun.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const master = join(repoRoot, "app/icon.png");
const out = (name) => join(repoRoot, "public", name);

const masterBuf = await readFile(master);

async function resize(size, file) {
  const buf = await sharp(masterBuf).resize(size, size, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(out(file), buf);
  console.log(`wrote public/${file} (${size}×${size}, ${buf.length} bytes)`);
}

// Maskable icon: the W3C spec reserves the outer 10% of each edge for the
// platform mask. We pad the master into a square canvas filled with rust
// (#b85a1c) so the brand mark sits in the safe zone and the bleed area
// matches the master's own background — no visible seam if the platform
// mask leaves more than the safe zone visible.
async function maskable(size, file) {
  const safe = Math.round(size * 0.8);
  const inner = await sharp(masterBuf).resize(safe, safe, { fit: "cover" }).toBuffer();
  const buf = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0xb8, g: 0x5a, b: 0x1c, alpha: 1 },
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(out(file), buf);
  console.log(`wrote public/${file} (${size}×${size} maskable, ${buf.length} bytes)`);
}

await resize(192, "icon-192.png");
await resize(512, "icon-512.png");
await maskable(512, "icon-512-maskable.png");
