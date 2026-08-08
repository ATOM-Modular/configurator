/**
 * Procedural, self-contained surface + sky textures.
 *
 * SPEC asks for CC0 HDRIs and ambientCG texture sets. Those are the higher-
 * fidelity path, but they're binary assets and a runtime CDN fetch would
 * break the "public bundle is self-contained" rule this project holds. So we
 * generate the maps on a <canvas> at first use instead — good enough to give
 * the steel a sheen and the panels a visible 1200mm joint, and a real HDRI /
 * texture set can be dropped in later as a file swap.
 *
 * All generators are memoised: one texture instance shared across every mesh.
 */
import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// ---------------------------------------------------------------------------
// Wall panel normal map — a shallow vertical V-groove at each 1200mm seam
// plus faint horizontal micro-texture. One panel bay == one full UV tile, so
// the groove lands exactly on the seams the assembly code already produces.
// ---------------------------------------------------------------------------
let wallNormal: Texture | undefined;
export function wallNormalMap(): Texture {
  if (wallNormal) return wallNormal;
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  // flat normal = (128,128,255)
  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, S, S);

  // vertical groove at the two side edges (u≈0 and u≈1)
  const groove = 6;
  for (const edge of [0, S - groove]) {
    const g = ctx.createLinearGradient(edge, 0, edge + groove, 0);
    // left flank points +X (R>128), right flank points −X (R<128)
    g.addColorStop(0, "rgb(180,128,235)");
    g.addColorStop(0.5, "rgb(128,128,255)");
    g.addColorStop(1, "rgb(76,128,235)");
    ctx.fillStyle = g;
    ctx.fillRect(edge, 0, groove, S);
  }

  // subtle horizontal micro lines (fine tonal banding across the panel)
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = "rgb(128,150,250)";
  for (let y = 4; y < S; y += 9) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const t = new CanvasTexture(c);
  t.colorSpace = LinearSRGBColorSpace; // normal data, not colour
  t.wrapS = t.wrapT = RepeatWrapping;
  wallNormal = t;
  return t;
}

// ---------------------------------------------------------------------------
// Wall panel seam map (albedo) — a faint dark line at each 1200mm panel edge
// so joints read at ANY viewing angle, not just grazing (a normal map alone
// vanishes under flat overcast light). One panel bay == one UV tile.
// ---------------------------------------------------------------------------
let wallSeam: Texture | undefined;
export function wallSeamMap(): Texture {
  if (wallSeam) return wallSeam;
  const S = 128;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, S, S);
  // seam at the tile boundary (both edges → a solid line where panels meet)
  const draw = (x: number) => {
    ctx.fillStyle = "rgba(120,120,120,0.55)";
    ctx.fillRect(x, 0, 2, S);
    ctx.fillStyle = "rgba(170,170,170,0.35)";
    ctx.fillRect(x - 1, 0, 1, S);
    ctx.fillRect(x + 2, 0, 1, S);
  };
  draw(0);
  draw(S - 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  wallSeam = t;
  return t;
}

// ---------------------------------------------------------------------------
// Roof corrugation normal map — sinusoidal ribs along one axis. Tiled many
// times across the sheet; ribs run down-slope.
// ---------------------------------------------------------------------------
let roofNormal: Texture | undefined;
export function roofNormalMap(): Texture {
  if (roofNormal) return roofNormal;
  const W = 64;
  const H = 4;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  for (let x = 0; x < W; x++) {
    // derivative of a sine → tangent tilt encoded in the red channel
    const slope = Math.cos((x / W) * Math.PI * 2 * 6); // 6 ribs per tile
    const r = Math.round(128 + slope * 90);
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = 128;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = LinearSRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  roofNormal = t;
  return t;
}

// ---------------------------------------------------------------------------
// Ground — mottled gravel/earth colour with large-scale blotches so the
// tiling doesn't read. Paired with a radial-fade alpha done in the material.
// ---------------------------------------------------------------------------
let groundColor: Texture | undefined;
export function groundColorMap(): Texture {
  if (groundColor) return groundColor;
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#9a9078";
  ctx.fillRect(0, 0, S, S);
  // scatter earth-toned blotches at a few scales (deterministic — no RNG)
  const palette = ["#8a7f66", "#a89c80", "#877c62", "#b0a488", "#7f745c"];
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 900; i++) {
    const r = 4 + rnd() * 46;
    ctx.globalAlpha = 0.06 + rnd() * 0.14;
    ctx.fillStyle = palette[Math.floor(rnd() * palette.length)]!;
    ctx.beginPath();
    ctx.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  groundColor = t;
  return t;
}

// ---------------------------------------------------------------------------
// Equirectangular overcast-daylight sky — soft gradient horizon→zenith with a
// diffuse sun bloom. Used for BOTH the scene background and IBL, so Colorbond
// steel has something real to reflect. Drop-in replacement: a Poly Haven .hdr
// via drei <Environment files>.
// ---------------------------------------------------------------------------
let skyEnv: Texture | undefined;
export function proceduralSky(): Texture {
  if (skyEnv) return skyEnv;
  const W = 1024;
  const H = 512;
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  // vertical gradient: blue zenith → bright hazy horizon → warm ground
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, "#7fa4c8"); // zenith blue
  g.addColorStop(0.35, "#a9c4dc");
  g.addColorStop(0.52, "#dfe9f0"); // horizon haze
  g.addColorStop(0.5, "#eef3f6");
  g.addColorStop(0.5, "#c7bda6"); // ground half begins
  g.addColorStop(1.0, "#a1957c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // diffuse sun disc high on one side
  const sx = W * 0.72;
  const sy = H * 0.24;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.34);
  sun.addColorStop(0, "rgba(255,250,235,0.95)");
  sun.addColorStop(0.25, "rgba(255,248,230,0.5)");
  sun.addColorStop(1, "rgba(255,248,230,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  const t = new CanvasTexture(c);
  t.mapping = EquirectangularReflectionMapping;
  t.colorSpace = SRGBColorSpace;
  skyEnv = t;
  return t;
}
