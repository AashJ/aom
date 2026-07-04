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
