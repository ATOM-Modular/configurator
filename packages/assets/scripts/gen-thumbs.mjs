/**
 * pnpm --filter @atom/assets thumbs
 *
 * Renders an orthographic TOP-DOWN snapshot of every part's placeholder mesh
 * (its x×z footprint) to parts/thumbs/<id>.png, so the palette has tiles
 * before any real art exists. Authored thumbnails later overwrite these files
 * — a file swap, no code change.
 *
 * Zero deps: rasterises into an RGBA buffer and encodes a PNG with Node's
 * built-in zlib. Placeholder meshes are boxes, so the top-down view is the
 * footprint rectangle drawn with a wireframe hatch (the placeholder affordance).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(pkgRoot, "manifest.json"), "utf-8"));
const outDir = join(pkgRoot, "parts", "thumbs");
mkdirSync(outDir, { recursive: true });

const S = 128; // px, square
const buf = () => new Uint8Array(S * S * 4);
const px = (b, x, y, [r, g, bl, a]) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  // simple source-over onto existing
  const sa = a / 255;
  b[i] = Math.round(r * sa + b[i] * (1 - sa));
  b[i + 1] = Math.round(g * sa + b[i + 1] * (1 - sa));
  b[i + 2] = Math.round(bl * sa + b[i + 2] * (1 - sa));
  b[i + 3] = Math.max(b[i + 3], a);
};

const TAN = [219, 205, 172, 90];
const INK = [18, 18, 17, 230];
const HATCH = [18, 18, 17, 40];

function renderFootprint(w, d) {
  const b = buf();
  // scale the larger footprint side to ~86px, clamp tiny parts to a min box
  const span = Math.max(w, d, 0.05);
  const scale = 86 / span;
  const rw = Math.max(14, Math.round(w * scale));
  const rh = Math.max(14, Math.round(d * scale));
  const x0 = Math.round((S - rw) / 2);
  const y0 = Math.round((S - rh) / 2);
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      const edge = x === x0 || x === x0 + rw - 1 || y === y0 || y === y0 + rh - 1;
      const edge2 = x <= x0 + 1 || x >= x0 + rw - 2 || y <= y0 + 1 || y >= y0 + rh - 2;
      if (edge || edge2) px(b, x, y, INK); // 2px border
      else {
        px(b, x, y, TAN);
        if ((x - y + 400) % 9 < 1) px(b, x, y, HATCH); // wireframe hatch
      }
    }
  }
  return b;
}

// ---- minimal PNG encoder ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (bytes) => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();
const u32 = (n) => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
function chunk(type, data) {
  const t = Uint8Array.from(type, (ch) => ch.charCodeAt(0));
  const body = new Uint8Array(t.length + data.length);
  body.set(t); body.set(data, t.length);
  return Buffer.concat([u32(data.length), body, u32(CRC(body))]);
}
function encodePng(rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  ihdr.set(u32(S), 0); ihdr.set(u32(S), 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  // filter byte 0 per scanline
  const raw = new Uint8Array(S * (S * 4 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * S * 4, (y + 1) * S * 4), y * (S * 4 + 1) + 1);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())]);
}

let n = 0;
for (const p of manifest.parts) {
  const png = encodePng(renderFootprint(p.dimensions.x, p.dimensions.z));
  writeFileSync(join(outDir, `${p.id}.png`), png);
  n++;
}
console.log(`gen-thumbs: wrote ${n} placeholder thumbnails to parts/thumbs/`);
