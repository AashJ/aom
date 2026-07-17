import type { RenderSnapshot } from "@aom/sim";

export const UNIT_POSE_X = 0;
export const UNIT_POSE_Z = 1;
export const UNIT_POSE_ELEVATION = 2;
export const UNIT_POSE_FLOATS = 3;

export function snapshotsAlignAt(
  prev: RenderSnapshot,
  curr: RenderSnapshot,
  index: number,
): boolean {
  return index < prev.count && prev.ids[index] === curr.ids[index];
}

export function unitSnapshotDisplacementSquared(
  prev: RenderSnapshot,
  curr: RenderSnapshot,
  index: number,
): number {
  if (!snapshotsAlignAt(prev, curr, index)) return 0;
  const dx = curr.posX[index]! - prev.posX[index]!;
  const dz = curr.posZ[index]! - prev.posZ[index]!;
  return dx * dx + dz * dz;
}

/** Writes the one canonical interpolated transform for a live snapshot unit. */
export function writeInterpolatedUnitPose(
  out: Float64Array,
  prev: RenderSnapshot,
  curr: RenderSnapshot,
  index: number,
  alpha: number,
): void {
  const aligned = snapshotsAlignAt(prev, curr, index);
  const prevX = aligned ? prev.posX[index]! : curr.posX[index]!;
  const prevZ = aligned ? prev.posZ[index]! : curr.posZ[index]!;
  const prevElevation = aligned ? prev.elevation[index]! : curr.elevation[index]!;

  out[UNIT_POSE_X] = prevX + (curr.posX[index]! - prevX) * alpha;
  out[UNIT_POSE_Z] = prevZ + (curr.posZ[index]! - prevZ) * alpha;
  out[UNIT_POSE_ELEVATION] = prevElevation + (curr.elevation[index]! - prevElevation) * alpha;
}
