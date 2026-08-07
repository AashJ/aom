import type { Attack, UnitTypeStats } from "../content/unit-type-schema";

function ageIndex(age: number): 0 | 1 | 2 | 3 {
  return age <= 0 ? 0 : age >= 3 ? 3 : (age as 1 | 2);
}

export function effectiveMaxHp(stats: UnitTypeStats, age: number): number {
  const progression = stats.ageProgression;
  return progression === undefined
    ? stats.maxHp
    : stats.maxHp * progression.maxHpMultipliers[ageIndex(age)];
}

export function effectiveLineOfSight(stats: UnitTypeStats, age: number): number {
  return stats.ageProgression?.lineOfSight[ageIndex(age)] ?? stats.lineOfSight;
}

export function effectiveAttackRange(
  stats: UnitTypeStats,
  attack: Attack,
  age: number,
): number {
  return stats.ageProgression?.attackRanges[ageIndex(age)] ?? attack.range;
}

export function effectiveAttackDamageMultiplier(stats: UnitTypeStats, age: number): number {
  return stats.ageProgression?.attackDamageMultipliers[ageIndex(age)] ?? 1;
}
