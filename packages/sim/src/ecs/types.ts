// Per-type from day one so ranged units are a ROW, not a refactor
// (ARCHITECTURE.md M5 open-questions commitment). Movement speed stays global
// until a second type actually needs it.
export interface UnitTypeStats {
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  aggroRange: number;
  attackCooldownTicks: number;
  isStatic: boolean;
  resource: number;
}

// Resources are table rows, not subsystems; gold/favor are future rows.
export const FOOD = 0;
export const WOOD = 1;
export const RESOURCE_COUNT = 2;

export const TYPE_VILLAGER = 0;
export const TYPE_MILITIA = 1;
export const TYPE_TREE = 2;
export const TYPE_BERRY = 3;

export const UNIT_TYPES: readonly UnitTypeStats[] = [
  {
    maxHp: 40,
    attackDamage: 5,
    attackRange: 1.2,
    aggroRange: 10,
    attackCooldownTicks: 20,
    isStatic: false,
    resource: -1,
  },
  {
    // Differentiation is a future balance pass.
    maxHp: 40,
    attackDamage: 5,
    attackRange: 1.2,
    aggroRange: 10,
    attackCooldownTicks: 20,
    isStatic: false,
    resource: -1,
  },
  {
    // HP is the remaining stock; depletion is death, and swap-remove already handles it.
    maxHp: 150,
    attackDamage: 0,
    attackRange: 0,
    aggroRange: 0,
    attackCooldownTicks: 0,
    isStatic: true,
    resource: WOOD,
  },
  {
    maxHp: 100,
    attackDamage: 0,
    attackRange: 0,
    aggroRange: 0,
    attackCooldownTicks: 0,
    isStatic: true,
    resource: FOOD,
  },
];

export const LEASH_FACTOR = 1.4;
