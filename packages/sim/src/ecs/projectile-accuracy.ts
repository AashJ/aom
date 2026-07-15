import type { ProjectileAttack } from "../content/unit-type-schema";

const PERCENT = 100;

/** Classic's pre-roll hit score; distance is measured center to center at release. */
export function classicProjectileHitScore(
  attack: ProjectileAttack,
  distance: number,
  priorShots: number,
): number {
  return (
    attack.accuracy * PERCENT -
    distance * attack.accuracyReductionFactor +
    priorShots * attack.aimBonus
  );
}

/** Classic skips the random draw outside the open (0, 100] score interval. */
export function classicProjectileHits(hitScore: number, roll: number): boolean {
  if (hitScore <= 0) return false;
  if (hitScore > PERCENT) return true;
  return roll <= hitScore;
}

/** Half-width of each axis of Classic's square miss region. */
export function classicProjectileSpread(
  attack: ProjectileAttack,
  distance: number,
  priorShots: number,
): number {
  const aimPercent = Math.min(PERCENT, Math.max(0, priorShots * attack.aimBonus));
  return (
    Math.min(distance * attack.spreadFactor, attack.maxSpread) * ((PERCENT - aimPercent) / PERCENT)
  );
}

/**
 * Returns Classic's one-time release lead duration. Targets moving at or above
 * TrackRating are not led and can dodge the captured point.
 */
export function classicProjectileLeadSeconds(
  sourceX: number,
  sourceZ: number,
  targetX: number,
  targetZ: number,
  targetVelocityX: number,
  targetVelocityZ: number,
  projectileSpeed: number,
  trackRating: number,
): number {
  const targetSpeed = Math.sqrt(
    targetVelocityX * targetVelocityX + targetVelocityZ * targetVelocityZ,
  );
  if (targetSpeed <= 0 || targetSpeed >= trackRating) return 0;

  const dx = targetX - sourceX;
  const dz = targetZ - sourceZ;
  return Math.sqrt(dx * dx + dz * dz) / projectileSpeed;
}
