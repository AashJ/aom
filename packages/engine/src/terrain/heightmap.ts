// Render-side procedural terrain only. Per ARCHITECTURE.md, this moves into the sim once
// gameplay reads terrain heights and determinism matters.
export const MAP_TILES = 256;
export const CHUNK_TILES = 32;
export const CHUNKS_PER_ROW = MAP_TILES / CHUNK_TILES;
export const VERTS_PER_ROW = MAP_TILES + 1;

export function generateHeightmap(seed: number): Float32Array {
  const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);

  for (let z = 0; z < VERTS_PER_ROW; z += 1) {
    for (let x = 0; x < VERTS_PER_ROW; x += 1) {
      let height = 0;
      let amplitude = 7;
      let frequency = 1 / 64;

      for (let octave = 0; octave < 4; octave += 1) {
        height += valueNoise(x * frequency, z * frequency, seed + octave) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }

      heights[z * VERTS_PER_ROW + x] = height;
    }
  }

  return heights;
}

export function heightAt(heights: Float32Array, x: number, z: number): number {
  // Render-side unit Y comes from this in M1; the sim does not know terrain exists yet.
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
