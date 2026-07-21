import {
  DAMAGE_CLASS_COUNT,
  type Attack,
  type DamageProfile,
  type DamageBonus,
  type DamageBonusTarget,
  type MeleeAttack,
  type MeleeAttackCycle,
  type UnitTypeStats,
} from "../content/unit-type-schema";

export function matchesDamageTarget(target: DamageBonusTarget, stats: UnitTypeStats): boolean {
  if (target.kind === "unit") return stats.key === target.key;
  return (
    (stats.classes & target.classes) === target.classes &&
    (target.requiredCulture === undefined || stats.culture === target.requiredCulture) &&
    (target.excludedCulture === undefined || stats.culture !== target.excludedCulture)
  );
}

interface DamageSource {
  readonly damage: DamageProfile;
  readonly bonuses: readonly DamageBonus[];
}

interface RadialBody {
  readonly bodyRadius: number;
}

/** Converts Classic's edge-to-edge action range into a center-distance check. */
export function centerDistanceForEdgeRange(
  edgeRange: number,
  source: RadialBody,
  target: RadialBody,
): number {
  return source.bodyRadius + edgeRange + target.bodyRadius;
}

export function resolveDamage(source: DamageSource, targetStats: UnitTypeStats): number {
  let damage = 0;

  for (let damageClass = 0; damageClass < DAMAGE_CLASS_COUNT; damageClass += 1) {
    damage += source.damage[damageClass]! * (1 - targetStats.armor[damageClass]!);
  }

  for (const bonus of source.bonuses) {
    if (matchesDamageTarget(bonus.target, targetStats)) {
      damage *= bonus.multiplier;
    }
  }

  return damage;
}

export function resolveAttackDamage(attack: Attack, targetStats: UnitTypeStats): number {
  return resolveDamage(attack, targetStats);
}

// Gate A compatibility surface for focused melee unit-pack tests. Delivery is
// decided by Attack.kind; armor/bonus resolution is shared across every kind.
export function resolveMeleeDamage(attack: MeleeAttack, targetStats: UnitTypeStats): number {
  return resolveAttackDamage(attack, targetStats);
}

export function resolveMeleeCycleDamage(
  attack: MeleeAttack,
  cycle: MeleeAttackCycle,
  targetStats: UnitTypeStats,
): number {
  return resolveMeleeDamage(attack, targetStats) * (cycle.actionTicks / attack.cooldownTicks);
}
