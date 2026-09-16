/**
 * Procedural pixel-art textures for the three extra RATFIRE biomes —
 * the siblings of desertTextures.ts. Drawn once into canvases at boot
 * (no asset files, deterministic), then sampled with NearestFilter so
 * they read exactly like the hand-painted minecraft atlas.
 *
 * The terrain UV scheme samples the TOP HALF of an atlas for up-facing
 * quads and the BOTTOM HALF for side quads (see terrainChunks.ts), so
 * every atlas keeps that layout:
 *  - RED SAND ATLAS: rust-red windswept dune tops + layered red
 *    sandstone sides with a loose fringe (Mars-like red desert).
 *  - BADLANDS ATLAS: pale terracotta cap + side tile painted as one
 *    full sedimentary STRATA cycle (orange/red/tan/cream bands) — each
 *    block face is one stratum, so the stacked terrace walls (see the
 *    wall-fill in terrainChunks.ts) read as striped canyon rock.
 *  - BASALT ATLAS: near-black speckled tops + columnar sides with
 *    bright LAVA CRACKS. The basalt material also uses this canvas as
 *    its emissive map, so the crack pixels glow orange out of the dark
 *    rock — day and especially night (see terrainChunks.ts).
 */

import * as THREE from 'three';

/** Grid-pixel size of one half — 32 px keeps the chunky minecraft look. */
const HALF = 32;

/** Deterministic PRNG (mulberry32) so every boot paints identical tiles. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Speckle a rect with a palette, ~1-in-`density` pixels per pass. */
function speckle(
  ctx: Ctx,
  rand: () => number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  colors: string[],
  density: number
): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (rand() < density) {
        px(ctx, x, y, 1, 1, colors[(rand() * colors.length) | 0]);
      }
    }
  }
}

/* ------------------------- RED DESERT ------------------------- */

/** Windswept rust-red dune cap: dark warm reds (tops face the sun and
 *  the game's hot daylight lifts them ~1.9x — same dark-paint trick as
 *  the calibrated sand tops in desertTextures.ts; the first boot came
 *  out neon under the lift, so the palette sits DEEP and desaturated). */
function paintRedSandTop(ctx: Ctx, rand: () => number): void {
  const sand = ['#6f2d1f', '#682a1c', '#78331f', '#622719'];
  for (let y = 0; y < HALF; y++) {
    for (let x = 0; x < HALF; x++) {
      px(ctx, x, y, 1, 1, sand[(rand() * sand.length) | 0]);
    }
  }
  // wind-combed ripple runs, one step darker
  for (let r = 0; r < 6; r++) {
    const y = (rand() * HALF) | 0;
    const x0 = (rand() * HALF) | 0;
    const len = 3 + ((rand() * 8) | 0);
    px(ctx, x0, y, Math.min(len, HALF - x0), 1, '#571f12');
  }
  speckle(ctx, rand, 0, 0, HALF, HALF, ['#4f1c10', '#7e3423', '#5a2214'], 0.06);
}

/** Layered red sandstone body with a ragged loose-red-sand fringe. */
function paintRedSandstoneSide(ctx: Ctx, rand: () => number): void {
  const stone = ['#8a3a26', '#7f341f', '#94422c', '#752d1b', '#99472f'];
  for (let y = 0; y < HALF; y++) {
    for (let x = 0; x < HALF; x++) {
      px(ctx, x, y, 1, 1, stone[(rand() * stone.length) | 0]);
    }
  }
  // faint wind-strata seams
  let y = 4 + ((rand() * 4) | 0);
  while (y < HALF) {
    const seam = ['#6b2917', '#75301c', '#612414'][(rand() * 3) | 0];
    let x = (rand() * 6) | 0;
    while (x < HALF) {
      const run = 2 + ((rand() * 7) | 0);
      px(ctx, x, y, Math.min(run, HALF - x), 1, seam);
      x += run + 1 + ((rand() * 5) | 0);
    }
    y += 5 + ((rand() * 5) | 0);
  }
  speckle(ctx, rand, 0, 0, HALF, HALF, ['#712c1a', '#a8503a', '#5d2313'], 0.06);
  // loose top fringe
  for (let x = 0; x < HALF; x++) {
    const depth = 4 + ((rand() * 3) | 0);
    for (let y = 0; y < depth; y++) {
      const sand = y < depth - 1 ? ['#a85236', '#9f4a30', '#b25a3c'] : ['#7c311e', '#732c1a'];
      px(ctx, x, y, 1, 1, sand[(rand() * sand.length) | 0]);
    }
  }
}

/* ------------------------- BADLANDS ------------------------- */

/** Pale hard terracotta cap — sun-baked mesa top. */
function paintMesaTop(ctx: Ctx, rand: () => number): void {
  const cap = ['#96683c', '#8d6036', '#a07142', '#885931'];
  for (let y = 0; y < HALF; y++) {
    for (let x = 0; x < HALF; x++) {
      px(ctx, x, y, 1, 1, cap[(rand() * cap.length) | 0]);
    }
  }
  // cracked-earth seams on the baked cap
  for (let c = 0; c < 5; c++) {
    let x = (rand() * HALF) | 0;
    let y = (rand() * HALF) | 0;
    const steps = 4 + ((rand() * 6) | 0);
    for (let s = 0; s < steps; s++) {
      px(ctx, x, y, 1, 1, '#6f4a26');
      x = (x + ((rand() * 3) | 0) - 1 + HALF) % HALF;
      y = (y + 1) % HALF;
    }
  }
  speckle(ctx, rand, 0, 0, HALF, HALF, ['#7a5228', '#ab7b4c', '#6a4522'], 0.07);
}

/** ONE FULL SEDIMENTARY STRATA CYCLE: horizontal terracotta bands
 *  (orange / red / tan / cream) with thin dark seams between them.
 *  Every block face shows the same cycle, so stacked wall-fill faces
 *  read as repeating layered canyon rock. */
function paintMesaSide(ctx: Ctx, rand: () => number): void {
  const bands = [
    ['#b3623c', '#aa5a34', '#bc6a44'], // burnt orange
    ['#8f4028', '#863a23', '#9a4830'], // deep red
    ['#c98d55', '#c0834c', '#d4975f'], // tan
    ['#a34e30', '#99462a', '#ad5738'], // red-orange
    ['#d8b184', '#cfa678', '#e0bb8f'], // cream
    ['#b3623c', '#aa5a34', '#bc6a44'], // burnt orange
    ['#7c3a24', '#74331f', '#86422a'], // dark red-brown
  ];
  let y = 0;
  let b = (rand() * bands.length) | 0;
  while (y < HALF) {
    const thickness = 3 + ((rand() * 4) | 0); // 3-6 px strata
    const band = bands[b % bands.length];
    const y1 = Math.min(y + thickness, HALF);
    for (let yy = y; yy < y1; yy++) {
      for (let x = 0; x < HALF; x++) {
        px(ctx, x, yy, 1, 1, band[(rand() * band.length) | 0]);
      }
    }
    // thin dark seam between strata
    if (y1 < HALF) {
      for (let x = 0; x < HALF; x++) {
        if (rand() < 0.85) px(ctx, x, y1, 1, 1, '#5f2f1c');
      }
    }
    y = y1 + 1;
    b++;
  }
  speckle(ctx, rand, 0, 0, HALF, HALF, ['#6d3a24', '#c49264', '#82462a'], 0.05);
}

/* ------------------------- VOLCANO ------------------------- */

/** Near-black basalt cap with faint grey speckle and a couple of tiny
 *  ember dots (the only top-face glow the emissive map picks up). */
function paintBasaltTop(ctx: Ctx, rand: () => number): void {
  const rock = ['#1f2226', '#24282d', '#1a1d21', '#2a2f35'];
  for (let y = 0; y < HALF; y++) {
    for (let x = 0; x < HALF; x++) {
      px(ctx, x, y, 1, 1, rock[(rand() * rock.length) | 0]);
    }
  }
  speckle(ctx, rand, 0, 0, HALF, HALF, ['#3a4048', '#15171a', '#454c55'], 0.08);
  // rare ember pinpricks where the crust has thinned
  const dots = 2 + ((rand() * 2) | 0);
  for (let d = 0; d < dots; d++) {
    px(ctx, (rand() * HALF) | 0, (rand() * HALF) | 0, 1, 1, ['#ff6a22', '#ff8c3a'][d % 2]);
  }
}

/** Columnar basalt body: vertical striations + 3-4 jagged bright LAVA
 *  CRACKS (1 px wide with forked branches). With this canvas as the
 *  material's emissiveMap the cracks glow orange out of the dark rock. */
function paintBasaltSide(ctx: Ctx, rand: () => number): void {
  const rock = ['#191c20', '#1e2226', '#141619', '#23272c'];
  for (let y = 0; y < HALF; y++) {
    for (let x = 0; x < HALF; x++) {
      px(ctx, x, y, 1, 1, rock[(rand() * rock.length) | 0]);
    }
  }
  // vertical column striations, one step lighter
  let x = 2 + ((rand() * 3) | 0);
  while (x < HALF) {
    const w = 1 + ((rand() * 2) | 0);
    const shade = rand() < 0.5 ? '#2c3138' : '#262b31';
    px(ctx, x, 0, Math.min(w, HALF - x), HALF, shade);
    x += w + 2 + ((rand() * 3) | 0);
  }
  speckle(ctx, rand, 0, 0, HALF, HALF, ['#31363d', '#101214'], 0.06);
  // LAVA CRACKS: jagged descending runs with occasional forks
  const cracks = 3 + ((rand() * 2) | 0);
  for (let c = 0; c < cracks; c++) {
    let cx = 2 + ((rand() * (HALF - 4)) | 0);
    let cy = (rand() * 4) | 0;
    const core = rand() < 0.5 ? '#ff7a2e' : '#ff5a1f';
    const hot = '#ffb35e';
    while (cy < HALF) {
      px(ctx, cx, cy, 1, 1, core);
      if (rand() < 0.3) px(ctx, cx, cy, 1, 1, hot); // hot core flicker px
      // fork
      if (rand() < 0.22 && cy + 1 < HALF) {
        const fx = cx + (rand() < 0.5 ? -1 : 1);
        if (fx >= 0 && fx < HALF) px(ctx, fx, cy + 1, 1, 1, core);
      }
      cx += ((rand() * 3) | 0) - 1;
      cx = Math.max(0, Math.min(HALF - 1, cx));
      cy += 1 + ((rand() * 2) | 0);
    }
  }
}

/** VOLCANO CALDERA LAVA ATLAS: molten crust plates separated by a web
 *  of white-hot melt. The lava material uses this canvas as BOTH its
 *  diffuse map and its emissive map (like the basalt atlas) — the crust
 *  pixels glow faint red while the melt web burns bright, so the lake
 *  and flows read as living lava day and especially night. */
function paintLavaTop(ctx: Ctx, rand: () => number): void {
  // molten base — hot oranges with baked-in variation
  const melt = ['#e86214', '#f57a1e', '#d85210', '#ff9432', '#ee6c18'];
  for (let y = 0; y < HALF; y++) {
    for (let x = 0; x < HALF; x++) {
      px(ctx, x, y, 1, 1, melt[(rand() * melt.length) | 0]);
    }
  }
  // mid-glow speckle inside the melt
  speckle(ctx, rand, 0, 0, HALF, HALF, ['#ffab3a', '#c9480d'], 0.1);
  // dark crust plates drifting on the pool (leave bright melt gaps)
  const plates = 9 + ((rand() * 4) | 0);
  for (let p = 0; p < plates; p++) {
    const cx = rand() * HALF;
    const cy = rand() * HALF;
    const rx = 3 + rand() * 5;
    const ry = 2.5 + rand() * 4.5;
    const crust = ['#6f2608', '#7c2c0a', '#611f06', '#8a340c'][(rand() * 4) | 0];
    const x0 = Math.max(0, Math.floor(cx - rx - 1));
    const x1 = Math.min(HALF - 1, Math.ceil(cx + rx + 1));
    const y0 = Math.max(0, Math.floor(cy - ry - 1));
    const y1 = Math.min(HALF - 1, Math.ceil(cy + ry + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny < 0.85 + rand() * 0.3) {
          px(ctx, x, y, 1, 1, rand() < 0.85 ? crust : '#4f1804');
        }
      }
    }
  }
  // white-hot pinpricks where two melt webs cross
  const hotDots = 8 + ((rand() * 5) | 0);
  for (let h = 0; h < hotDots; h++) {
    px(
      ctx,
      (rand() * HALF) | 0,
      (rand() * HALF) | 0,
      1,
      1,
      rand() < 0.5 ? '#ffd35e' : '#ffe58a'
    );
  }
}

/** Molten wall face for the pool/flow edges: dark basaltic crust with a
 *  bright surface band at the top and vertical drip runs descending. */
function paintLavaSide(ctx: Ctx, rand: () => number): void {
  const crust = ['#5f2106', '#6d2708', '#541c05', '#672407'];
  for (let y = 0; y < HALF; y++) {
    for (let x = 0; x < HALF; x++) {
      px(ctx, x, y, 1, 1, crust[(rand() * crust.length) | 0]);
    }
  }
  // the molten surface band the face hangs from (top rows burn bright)
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < HALF; x++) {
      if (rand() < 0.9 - y * 0.1) {
        px(
          ctx,
          x,
          y,
          1,
          1,
          meltBand(y, rand)
        );
      }
    }
  }
  // drip runs of melt sliding down the crust face
  const drips = 3 + ((rand() * 3) | 0);
  for (let d = 0; d < drips; d++) {
    let x = (rand() * HALF) | 0;
    const len = 8 + ((rand() * 14) | 0);
    for (let y = 0; y < len; y++) {
      px(ctx, x, y, 1, 1, y < 3 ? '#ffb648' : '#f0821e');
      if (rand() < 0.3) {
        const nx = x + (rand() < 0.5 ? -1 : 1);
        if (nx >= 0 && nx < HALF) px(ctx, nx, y, 1, 1, '#c9550f');
      }
      if (rand() < 0.12) {
        x = Math.max(0, Math.min(HALF - 1, x + (rand() < 0.5 ? -1 : 1)));
      }
    }
  }
  // hottest pinpricks
  speckle(ctx, rand, 0, 0, HALF, HALF, ['#ffd35e'], 0.015);
}

/** One row of the molten surface band: hottest at the very top. */
function meltBand(y: number, rand: () => number): string {
  if (y < 2) return rand() < 0.5 ? '#ffd35e' : '#ffc04a';
  if (y < 4) return rand() < 0.5 ? '#ff9432' : '#f57a1e';
  return rand() < 0.5 ? '#e86214' : '#d85210';
}

/** Paints a 32x64 atlas: top half = top-face tile, bottom half = side tile. */
function buildAtlas(
  top: (ctx: Ctx, rand: () => number) => void,
  side: (ctx: Ctx, rand: () => number) => void,
  seed: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = HALF;
  canvas.height = HALF * 2;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    top(ctx, mulberry32(seed));
    ctx.save();
    ctx.translate(0, HALF);
    side(ctx, mulberry32(seed ^ 0x9e3779b9));
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; // crisp minecraft pixels
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** Red-desert atlas: rust dune cap / layered red sandstone-with-fringe. */
export function createRedSandAtlas(): THREE.CanvasTexture {
  return buildAtlas(paintRedSandTop, paintRedSandstoneSide, 0xbedead21);
}

/** Badlands atlas: baked terracotta cap / full strata cycle side. */
export function createMesaAtlas(): THREE.CanvasTexture {
  return buildAtlas(paintMesaTop, paintMesaSide, 0x0badcafe2);
}

/** Volcano atlas: speckled basalt cap / columnar side with lava cracks
 *  (doubles as the material's emissive map — see terrainChunks.ts). */
export function createBasaltAtlas(): THREE.CanvasTexture {
  return buildAtlas(paintBasaltTop, paintBasaltSide, 0xc0c0a017);
}

/** Caldera lava atlas: crust-plate melt pool / dripping molten wall face
 *  (also wired as the material's emissive map — the melt web glows). */
export function createLavaAtlas(): THREE.CanvasTexture {
  return buildAtlas(paintLavaTop, paintLavaSide, 0x1a1a7a17);
}
