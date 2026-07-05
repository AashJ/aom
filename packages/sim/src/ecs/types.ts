// Per-type from day one so ranged units are a ROW, not a refactor
// (ARCHITECTURE.md M5 open-questions commitment). Movement speed stays global
// until a second type actually needs it.
export interface UnitTypeStats {
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  aggroRange: number;
  attackCooldownTicks: number;
}

export const UNIT_TYPES: readonly UnitTypeStats[] = [
  {
    maxHp: 40,
    attackDamage: 5,
    attackRange: 1.2,
    aggroRange: 10,
    attackCooldownTicks: 20,
  },
];

export const LEASH_FACTOR = 1.4;
