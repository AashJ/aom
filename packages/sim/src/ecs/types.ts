// Per-type from day one so ranged units are a ROW, not a refactor
// (ARCHITECTURE.md M5 open-questions commitment). Movement speed stays global
// until a second type actually needs it.
export interface UnitTypeStats {
  maxHp: number;
  lineOfSight: number;
  attackDamage: number;
  attackRange: number;
  aggroRange: number;
  attackCooldownTicks: number;
  isStatic: boolean;
  resource: number;
  // Melee reach measures to the target's surface, not center; without this, a chaser stops
  // at a big building's unwalkable footprint edge, outside attack range, and orbits forever.
  bodyRadius: number;
  // Tiles per side, square; 0 = no footprint.
  footprint: number;
  // Consumed by M6-3/4/5/6; the building table is completed in one pass here.
  costFood: number;
  costWood: number;
  buildTicks: number;
  popBonus: number;
  // Unit type this building produces; -1 = not a producer. Single-slot, no queues in M6.
  trains: number;
  isDropsite: boolean;
}

// Resources are table rows, not subsystems; gold/favor are future rows.
export const FOOD = 0;
export const WOOD = 1;
export const RESOURCE_COUNT = 2;

// Balance-pass placeholders: 0.5 s per unit, 5 s to fill at 20 Hz.
// Build cadence reuses GATHER_COOLDOWN_TICKS (10), so the average rate is 1 progress/tick/builder and buildTicks reads as solo builder-ticks.
export const BUILD_PER_STRIKE = 10;
export const CARRY_CAPACITY = 10;
export const GATHER_PER_STRIKE = 1;
export const GATHER_COOLDOWN_TICKS = 10;
// A depleted node hands workers to a nearby node so a forest is one worksite, not thirty orders.
export const NODE_RETARGET_RADIUS = 14;

export const TYPE_VILLAGER = 0;
export const TYPE_MILITIA = 1;
export const TYPE_TREE = 2;
export const TYPE_BERRY = 3;
export const TYPE_TOWN_CENTER = 4;
export const TYPE_HOUSE = 5;
export const TYPE_BARRACKS = 6;

export const UNIT_TYPES: readonly UnitTypeStats[] = [
  {
    maxHp: 40,
    lineOfSight: 8,
    attackDamage: 5,
    attackRange: 1.2,
    aggroRange: 10,
    attackCooldownTicks: 20,
    isStatic: false,
    resource: -1,
    bodyRadius: 0.3,
    footprint: 0,
    // For trainable units, costFood/costWood are the train price and buildTicks
    // is the train duration (5 s at 20 Hz), the same columns buildings use for construction.
    costFood: 50,
    costWood: 0,
    buildTicks: 100,
    popBonus: 0,
    trains: -1,
    isDropsite: false,
  },
  {
    // Differentiation is a future balance pass.
    maxHp: 40,
    lineOfSight: 10,
    attackDamage: 5,
    attackRange: 1.2,
    aggroRange: 10,
    attackCooldownTicks: 20,
    isStatic: false,
    resource: -1,
    bodyRadius: 0.3,
    footprint: 0,
    costFood: 60,
    costWood: 20,
    buildTicks: 160,
    popBonus: 0,
    trains: -1,
    isDropsite: false,
  },
  {
    // HP is the remaining stock; depletion is death, and swap-remove already handles it.
    maxHp: 150,
    lineOfSight: 0,
    attackDamage: 0,
    attackRange: 0,
    aggroRange: 0,
    attackCooldownTicks: 0,
    isStatic: true,
    resource: WOOD,
    bodyRadius: 0.5,
    footprint: 0,
    costFood: 0,
    costWood: 0,
    buildTicks: 0,
    popBonus: 0,
    trains: -1,
    isDropsite: false,
  },
  {
    maxHp: 100,
    lineOfSight: 0,
    attackDamage: 0,
    attackRange: 0,
    aggroRange: 0,
    attackCooldownTicks: 0,
    isStatic: true,
    resource: FOOD,
    bodyRadius: 0.5,
    footprint: 0,
    costFood: 0,
    costWood: 0,
    buildTicks: 0,
    popBonus: 0,
    trains: -1,
    isDropsite: false,
  },
  {
    maxHp: 2400,
    lineOfSight: 14,
    attackDamage: 0,
    attackRange: 0,
    aggroRange: 0,
    attackCooldownTicks: 0,
    isStatic: true,
    resource: -1,
    bodyRadius: 2.9,
    footprint: 4,
    costFood: 0,
    costWood: 300,
    buildTicks: 300,
    popBonus: 15,
    trains: TYPE_VILLAGER,
    isDropsite: true,
  },
  {
    maxHp: 600,
    lineOfSight: 6,
    attackDamage: 0,
    attackRange: 0,
    aggroRange: 0,
    attackCooldownTicks: 0,
    isStatic: true,
    resource: -1,
    bodyRadius: 1.5,
    footprint: 2,
    costFood: 0,
    costWood: 60,
    buildTicks: 120,
    popBonus: 10,
    trains: -1,
    isDropsite: false,
  },
  {
    maxHp: 1200,
    lineOfSight: 10,
    attackDamage: 0,
    attackRange: 0,
    aggroRange: 0,
    attackCooldownTicks: 0,
    isStatic: true,
    resource: -1,
    bodyRadius: 2.2,
    footprint: 3,
    costFood: 0,
    costWood: 120,
    buildTicks: 200,
    popBonus: 0,
    trains: TYPE_MILITIA,
    isDropsite: false,
  },
];

export const LEASH_FACTOR = 1.4;
