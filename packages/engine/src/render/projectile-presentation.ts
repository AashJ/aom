import type { RenderSnapshot } from "@aom/sim";
import type {
  ProjectileModelForwardAxis,
  RuntimeProjectilePresentation,
} from "../content/unit-media-schema";
import { PROJECTILE_PRESENTATIONS } from "./model-assets";
import * as mat4 from "../math/mat4";

export const PROJECTILE_VISUAL_X = 0;
export const PROJECTILE_VISUAL_Z = 1;
export const PROJECTILE_VISUAL_FACING_X = 2;
export const PROJECTILE_VISUAL_FACING_Z = 3;
export const PROJECTILE_VISUAL_PROGRESS = 4;
export const PROJECTILE_VISUAL_FLOATS = 5;

export function resolveProjectilePresentation(
  snapshot: RenderSnapshot,
  index: number,
): RuntimeProjectilePresentation | null {
  if (snapshot.projectileVisible[index] === 0) return null;
  return PROJECTILE_PRESENTATIONS[snapshot.projectileTypes[index]!] ?? null;
}

/** Writes one allocation-free render interpolation sample. */
export function writeProjectileVisualState(
  out: Float32Array,
  prev: RenderSnapshot,
  curr: RenderSnapshot,
  index: number,
  alpha: number,
): void {
  const aligned =
    index < prev.projectileCount && prev.projectileIds[index] === curr.projectileIds[index];
  const prevX = aligned ? prev.projectilePosX[index]! : curr.projectilePosX[index]!;
  const prevZ = aligned ? prev.projectilePosZ[index]! : curr.projectilePosZ[index]!;
  const prevFacingX = aligned ? prev.projectileFacingX[index]! : curr.projectileFacingX[index]!;
  const prevFacingZ = aligned ? prev.projectileFacingZ[index]! : curr.projectileFacingZ[index]!;
  const prevProgress = aligned ? prev.projectileProgress[index]! : curr.projectileProgress[index]!;

  out[PROJECTILE_VISUAL_X] = prevX + (curr.projectilePosX[index]! - prevX) * alpha;
  out[PROJECTILE_VISUAL_Z] = prevZ + (curr.projectilePosZ[index]! - prevZ) * alpha;

  let facingX = prevFacingX + (curr.projectileFacingX[index]! - prevFacingX) * alpha;
  let facingZ = prevFacingZ + (curr.projectileFacingZ[index]! - prevFacingZ) * alpha;
  const facingLength = Math.sqrt(facingX * facingX + facingZ * facingZ);
  if (facingLength > 1e-6) {
    facingX /= facingLength;
    facingZ /= facingLength;
  } else {
    facingX = 0;
    facingZ = 1;
  }
  out[PROJECTILE_VISUAL_FACING_X] = facingX;
  out[PROJECTILE_VISUAL_FACING_Z] = facingZ;
  out[PROJECTILE_VISUAL_PROGRESS] = Math.min(
    1,
    Math.max(0, prevProgress + (curr.projectileProgress[index]! - prevProgress) * alpha),
  );
}

export function projectileFlightHeight(
  presentation: RuntimeProjectilePresentation,
  progress: number,
): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return presentation.flightHeight + presentation.arcHeight * 4 * clamped * (1 - clamped);
}

/** Maps an authored model's longitudinal axis onto renderer-local +Z. */
export function writeProjectileModelTransform(
  out: mat4.Mat4,
  forwardAxis: ProjectileModelForwardAxis,
): void {
  mat4.identity(out);
  switch (forwardAxis) {
    case "positive-z":
      return;
    case "negative-z":
      out[0] = -1;
      out[10] = -1;
      return;
    case "positive-y":
      out[5] = 0;
      out[6] = 1;
      out[9] = -1;
      out[10] = 0;
  }
}
