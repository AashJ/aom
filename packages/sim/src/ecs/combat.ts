import {
  DAMAGE_CLASS_COUNT,
  type Attack,
  type MeleeAttack,
  type UnitTypeStats,
} from "../content/unit-type-schema";

export function resolveAttackDamage(attack: Attack, targetStats: UnitTypeStats): number {
  let damage = 0;

  for (let damageClass = 0; damageClass < DAMAGE_CLASS_COUNT; damageClass += 1) {
    damage += attack.damage[damageClass]! * (1 - targetStats.armor[damageClass]!);
  }

  for (const bonus of attack.bonuses) {
    if (
      (targetStats.classes & bonus.requiredClasses) === bonus.requiredClasses &&
      (bonus.requiredCulture === undefined || targetStats.culture === bonus.requiredCulture) &&
      (bonus.excludedCulture === undefined || targetStats.culture !== bonus.excludedCulture)
    ) {
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
