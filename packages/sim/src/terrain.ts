// Terrain is gameplay state as of M3 because gameplay reads slope for walkability,
// closing ARCHITECTURE.md's parked terrain ownership question. Generation obeys
// the sim determinism rules: Math.imul/floor/shifts/arithmetic only, which this
// generator already used. The engine receives world.heights once at init as a
// sanctioned one-time handoff, not a per-tick channel; per-tick data still flows
// only through RenderSnapshot.
export const MAP_TILES = 256;
export const VERTS_PER_ROW = MAP_TILES + 1;
// Blend order follows the Classic AoM subset in terrain/blends.txt: lower ids
// are painted first and higher ids are layered over them by the renderer.
export const TERRAIN_DIRT_A = 0;
export const TERRAIN_CLIFF_GREEK_B = 1;
export const TERRAIN_GRASS_DIRT_75 = 2;
export const TERRAIN_GRASS_DIRT_50 = 3;
export const TERRAIN_GRASS_DIRT_25 = 4;
export const TERRAIN_GRASS_B = 5;
export const TERRAIN_GRASS_A = 6;
export const TERRAIN_CLIFF_GREEK_A = 7;
export const TERRAIN_MATERIAL_IDS = [
  TERRAIN_DIRT_A,
  TERRAIN_CLIFF_GREEK_B,
  TERRAIN_GRASS_DIRT_75,
  TERRAIN_GRASS_DIRT_50,
  TERRAIN_GRASS_DIRT_25,
  TERRAIN_GRASS_B,
  TERRAIN_GRASS_A,
  TERRAIN_CLIFF_GREEK_A,
] as const;
export type TerrainMaterialId = (typeof TERRAIN_MATERIAL_IDS)[number];
export const TERRAIN_MATERIAL_COUNT = TERRAIN_MATERIAL_IDS.length;
// Max per-edge height delta per 1-unit tile, roughly where the terrain shader
// starts blending to rock so unwalkable terrain will visually read as rocky once
// the overlay lands.
export const WALKABLE_MAX_SLOPE = 0.65;

// Shaping constants, retuned for multiplayer map connectivity (2026-07-19):
// ~4.6% of tiles are unwalkable on seed 1337, peaks reach ~18 units, and the
// steepest slope remains a clearly impassable ~2.3 units/tile.
// PLAINS_AMPLITUDE keeps the lowlands gently rolling and buildable; the
// mountain mask turns the top of the noise range into steep impassable ranges.
const FBM_MAX = 13.125; // sum of octave amplitudes 7 + 3.5 + 1.75 + 0.875
const PLAINS_AMPLITUDE = 5;
const MOUNTAIN_START = 0.62;
const MOUNTAIN_RANGE = 0.24;
const MOUNTAIN_AMPLITUDE = 16;

export function generateHeightmap(seed: number): Float32Array {
  const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);

  for (let z = 0; z < VERTS_PER_ROW; z += 1) {
    for (let x = 0; x < VERTS_PER_ROW; x += 1) {
      let base = 0;
      let amplitude = 7;
      let frequency = 1 / 64;

      for (let octave = 0; octave < 4; octave += 1) {
        base += valueNoise(x * frequency, z * frequency, seed + octave) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }

      // Normalize the raw fBm, then shape: plains + squared smoothstep mountain
      // mask. Squaring the mask gives soft foothills that steepen into cliffs;
      // every op here is determinism-legal (no pow, no trig).
      const n = base / FBM_MAX;
      let mask = Math.min(1, Math.max(0, (n - MOUNTAIN_START) / MOUNTAIN_RANGE));
      mask = mask * mask * (3 - 2 * mask);

      heights[z * VERTS_PER_ROW + x] = n * PLAINS_AMPLITUDE + mask * mask * MOUNTAIN_AMPLITUDE;
    }
  }

  return heights;
}

export function generateTerrainMaterials(seed: number, heights: Float32Array): Uint8Array {
  if (heights.length !== VERTS_PER_ROW * VERTS_PER_ROW) {
    throw new RangeError("Terrain heights must contain one value per terrain vertex.");
  }

  // Materials live on terrain vertices. Each mesh quad therefore receives four
  // material ids, which the renderer turns into the original corner/edge masks.
  const materials = new Uint8Array(heights.length);

  for (let z = 0; z < VERTS_PER_ROW; z += 1) {
    for (let x = 0; x < VERTS_PER_ROW; x += 1) {
      const index = z * VERTS_PER_ROW + x;
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(MAP_TILES, x + 1);
      const z0 = Math.max(0, z - 1);
      const z1 = Math.min(MAP_TILES, z + 1);
      const height = heights[index]!;
      const steepestEdge = Math.max(
        Math.abs(height - heights[z * VERTS_PER_ROW + x0]!),
        Math.abs(height - heights[z * VERTS_PER_ROW + x1]!),
        Math.abs(height - heights[z0 * VERTS_PER_ROW + x]!),
        Math.abs(height - heights[z1 * VERTS_PER_ROW + x]!),
      );

      if (steepestEdge > WALKABLE_MAX_SLOPE * 1.25) {
        materials[index] = TERRAIN_CLIFF_GREEK_A;
        continue;
      }

      if (steepestEdge > WALKABLE_MAX_SLOPE * 0.72) {
        materials[index] = TERRAIN_CLIFF_GREEK_B;
        continue;
      }

      // Painted ground is independent of elevation. Two low-frequency fields
      // produce broad authored-looking patches instead of shader-side speckle.
      const broad = valueNoise(x / 56, z / 56, seed + 97);
      const detail = valueNoise(x / 18, z / 18, seed + 131);
      const dryness = broad * 0.78 + detail * 0.22;

      if (dryness < 0.34) {
        materials[index] = TERRAIN_DIRT_A;
      } else if (dryness < 0.4) {
        materials[index] = TERRAIN_GRASS_DIRT_75;
      } else if (dryness < 0.46) {
        materials[index] = TERRAIN_GRASS_DIRT_50;
      } else if (dryness < 0.52) {
        materials[index] = TERRAIN_GRASS_DIRT_25;
      } else {
        materials[index] =
          valueNoise(x / 32, z / 32, seed + 173) < 0.5 ? TERRAIN_GRASS_B : TERRAIN_GRASS_A;
      }
    }
  }

  return materials;
}

export function heightAt(heights: Float32Array, x: number, z: number): number {
  const cx = Math.min(MAP_TILES, Math.max(0, x));
  const cz = Math.min(MAP_TILES, Math.max(0, z));
  const x0 = Math.floor(cx);
  const z0 = Math.floor(cz);
  const x1 = Math.min(MAP_TILES, x0 + 1);
  const z1 = Math.min(MAP_TILES, z0 + 1);
  const tx = cx - x0;
  const tz = cz - z0;
  const h00 = heights[z0 * VERTS_PER_ROW + x0]!;
  const h10 = heights[z0 * VERTS_PER_ROW + x1]!;
  const h01 = heights[z1 * VERTS_PER_ROW + x0]!;
  const h11 = heights[z1 * VERTS_PER_ROW + x1]!;
  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;

  return hx0 + (hx1 - hx0) * tz;
}

export function computeWalkable(heights: Float32Array): Uint8Array {
  const walkable = new Uint8Array(MAP_TILES * MAP_TILES);

  for (let z = 0; z < MAP_TILES; z += 1) {
    for (let x = 0; x < MAP_TILES; x += 1) {
      const h00 = heights[z * VERTS_PER_ROW + x]!;
      const h10 = heights[z * VERTS_PER_ROW + x + 1]!;
      const h01 = heights[(z + 1) * VERTS_PER_ROW + x]!;
      const h11 = heights[(z + 1) * VERTS_PER_ROW + x + 1]!;
      const steepestEdge = Math.max(
        Math.abs(h00 - h10),
        Math.abs(h00 - h01),
        Math.abs(h10 - h11),
        Math.abs(h01 - h11),
      );

      walkable[z * MAP_TILES + x] = steepestEdge <= WALKABLE_MAX_SLOPE ? 1 : 0;
    }
  }

  return walkable;
}

function hash2D(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  // Quintic smoothstep gives C2 continuity, avoiding visible lattice creases in normals.
  const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
  const sz = tz * tz * tz * (tz * (tz * 6 - 15) + 10);
  const n00 = hash2D(x0, z0, seed);
  const n10 = hash2D(x0 + 1, z0, seed);
  const n01 = hash2D(x0, z0 + 1, seed);
  const n11 = hash2D(x0 + 1, z0 + 1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;

  return nx0 + (nx1 - nx0) * sz;
}
