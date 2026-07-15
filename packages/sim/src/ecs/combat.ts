import {
  DAMAGE_CLASS_COUNT,
  type Attack,
  type DamageBonusTarget,
  type MeleeAttack,
  type UnitTypeStats,
} from "../content/unit-type-schema";

function matchesDamageBonusTarget(target: DamageBonusTarget, stats: UnitTypeStats): boolean {
  if (target.kind === "unit") return stats.key === target.key;
  return (
    (stats.classes & target.classes) === target.classes &&
    (target.requiredCulture === undefined || stats.culture === target.requiredCulture) &&
    (target.excludedCulture === undefined || stats.culture !== target.excludedCulture)
  );
}

export function resolveAttackDamage(attack: Attack, targetStats: UnitTypeStats): number {
  let damage = 0;

  for (let damageClass = 0; damageClass < DAMAGE_CLASS_COUNT; damageClass += 1) {
    damage += attack.damage[damageClass]! * (1 - targetStats.armor[damageClass]!);
  }

  for (const bonus of attack.bonuses) {
    if (matchesDamageBonusTarget(bonus.target, targetStats)) {
      damage *= bonus.multiplier;
    }
  }

  return damage;
}

// Gate A compatibility surface for focused melee unit-pack tests. Delivery is
// decided by Attack.kind; armor/bonus resolution is shared across every kind.
export function resolveMeleeDamage(attack: MeleeAttack, targetStats: UnitTypeStats): number {
  return resolveAttackDamage(attack, targetStats);
}
