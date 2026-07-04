// Heightfield raycast for absolute ground picking (commands, future building placement).
// The y=0 plane intersect is only valid for relative anchoring; this is the
// terrain-true version. Render-side module - determinism rules don't apply.
import type { Vec3 } from "../math/vec3";
import { heightAt, MAP_TILES } from "./heightmap";

// Conservative bound only used to clip the search range.
const MAX_TERRAIN_HEIGHT = 24;
// World units between samples - half a tile; finer than any generator feature.
const COARSE_STEP = 0.5;
// 0.5 / 2^8 ~= 2 mm precision.
const BISECT_ITERATIONS = 8;

export function raycastHeightfield(
  heights: Float32Array,
  origin: Vec3,
  dir: Vec3,
  out: Vec3,
): boolean {
  const ox = origin[0]!;
  const oy = origin[1]!;
  const oz = origin[2]!;
  const dirX = dir[0]!;
  const dirY = dir[1]!;
  const dirZ = dir[2]!;
  const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

  if (len === 0) {
    return false;
  }

  // screenRay supplies an unnormalized near-to-far segment; normalize for world-unit t.
  const invLen = 1 / len;
  const dx = dirX * invLen;
  const dy = dirY * invLen;
  const dz = dirZ * invLen;

  // IEEE +/-Infinity from 1/0 makes parallel slab tests work without branches.
  const invX = 1 / dx;
  const invY = 1 / dy;
  const invZ = 1 / dz;
  const tx1 = (0 - ox) * invX;
  const tx2 = (MAP_TILES - ox) * invX;
  const ty1 = (0 - oy) * invY;
  const ty2 = (MAX_TERRAIN_HEIGHT - oy) * invY;
  const tz1 = (0 - oz) * invZ;
  const tz2 = (MAP_TILES - oz) * invZ;
  let t0 = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2), Math.min(tz1, tz2));
  const t1 = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2), Math.max(tz1, tz2));

  if (t1 < t0 || t1 < 0) {
    return false;
  }

  t0 = Math.max(0, t0);

  let px = ox + dx * t0;
  let py = oy + dy * t0;
  let pz = oz + dz * t0;

  if (py <= heightAt(heights, px, pz)) {
    // If the camera starts inside a hill at min zoom, use the entry point directly.
    out[0] = px;
    out[1] = py;
    out[2] = pz;
    return true;
  }

  let tPrev = t0;

  while (tPrev < t1) {
    const t = Math.min(tPrev + COARSE_STEP, t1);
    px = ox + dx * t;
    py = oy + dy * t;
    pz = oz + dz * t;

    if (py <= heightAt(heights, px, pz)) {
      let lo = tPrev;
      let hi = t;

      // Coarse-march-then-bisect is the standard heightfield trick: the march finds the
      // first crossing interval, bisection sharpens it. A step can only skip a spike
      // narrower than COARSE_STEP, which the smooth value-noise terrain cannot produce.
      for (let i = 0; i < BISECT_ITERATIONS; i += 1) {
        const mid = (lo + hi) * 0.5;
        const midX = ox + dx * mid;
        const midY = oy + dy * mid;
        const midZ = oz + dz * mid;

        if (midY <= heightAt(heights, midX, midZ)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }

      out[0] = ox + dx * hi;
      out[1] = oy + dy * hi;
      out[2] = oz + dz * hi;
      return true;
    }

    tPrev = t;
  }

  return false;
}
