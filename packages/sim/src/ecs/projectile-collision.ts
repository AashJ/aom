import { circleSweepEntryFraction } from "./circle-collision";

/** Projectile-facing name for the shared deterministic circle-sweep kernel. */
export function projectileCircleEntryFraction(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  centerX: number,
  centerZ: number,
  radius: number,
): number {
  return circleSweepEntryFraction(startX, startZ, endX, endZ, centerX, centerZ, radius);
}

/** Stable IDs break equal-contact ties independently of dense storage order. */
export function projectileHitComesFirst(
  currentFraction: number,
  currentTargetId: number,
  candidateFraction: number,
  candidateTargetId: number,
): boolean {
  return (
    candidateFraction >= 0 &&
    (currentFraction < 0 ||
      candidateFraction < currentFraction ||
      (candidateFraction === currentFraction && candidateTargetId < currentTargetId))
  );
}
