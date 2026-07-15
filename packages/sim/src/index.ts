// Load-bearing architecture rule: @aom/sim imports nothing from engine or DOM; violations
// are bugs even when they work. See ARCHITECTURE.md determinism rules before editing sim.
export * from "./commands";
export { COMMAND_ADVANCE_AGE, COMMAND_GATHER, COMMAND_PLACE, COMMAND_TRAIN } from "./commands";
export {
  CLASSICAL_AGE_ADVANCE_RULE,
  CLASSICAL_AGE_ADVANCE_TICKS,
  CLASSICAL_AGE_COST_FOOD,
  getAgeAdvanceAvailability,
  type AgeAdvanceAvailability,
  type AgeAdvanceAvailabilityState,
  type AgeAdvanceRule,
  type ResourceAmounts,
} from "./ecs/age-advancement";
export {
  getTypeAvailability,
  hasCompletedBuilding,
  isCompletedOwnedBuilding,
  isTypeAvailable,
  type BuildingCompletionState,
  type HasCompletedBuilding,
  type TypeAvailability,
} from "./ecs/availability";
export { idGeneration, idIndex, packId } from "./ecs/id";
export { registerPlayer } from "./ecs/players";
export {
  AGE_ARCHAIC,
  AGE_CLASSICAL,
  AGE_COUNT,
  AGE_HEROIC,
  AGE_MYTHIC,
  AGE_NAMES,
  GOD_ATHENA,
  GOD_BAST,
  GOD_HADES,
  GOD_HERMES,
  GOD_POSEIDON,
  GOD_PTAH,
  GOD_RA,
  GOD_ZEUS,
  NO_AGE,
  NO_GOD,
} from "./ecs/progression";
export {
  BUILD_PER_STRIKE,
  CARRY_CAPACITY,
  FAVOR,
  FOOD,
  GATHER_COOLDOWN_TICKS,
  GATHER_PER_STRIKE,
  GOLD,
  LEASH_FACTOR,
  NODE_RETARGET_RADIUS,
  RESOURCE_COUNT,
  TYPE_BARRACKS,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_HOUSE,
  TYPE_MILITIA,
  TYPE_TOWN_CENTER,
  TYPE_TEMPLE,
  TYPE_TREE,
  TYPE_VILLAGER,
  UNIT_TYPES,
  WOOD,
  type UnitTypeStats,
} from "./ecs/types";
export * from "./ecs/world";
export {
  canPlaceBuilding,
  clearSelection,
  flushFlowFields,
  killUnit,
  MATCH_DRAW,
  MAX_PLAYERS,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_IDLE,
  MODE_RETURNING,
  NEUTRAL_OWNER,
  NO_TARGET,
  resolveId,
  SEPARATION_RADIUS,
  setSelected,
  spawnBuilding,
  spawnResourceNodes,
  unitIdAt,
} from "./ecs/world";
export { buildFlowField, cellOf, sampleFlowDirection, type FlowField } from "./flow";
export * from "./hash";
export * from "./snapshot";
export * from "./visibility";
export * from "./math/prng";
export {
  MAP_TILES,
  TERRAIN_CLIFF_GREEK_A,
  TERRAIN_CLIFF_GREEK_B,
  TERRAIN_DIRT_A,
  TERRAIN_GRASS_A,
  TERRAIN_GRASS_B,
  TERRAIN_GRASS_DIRT_25,
  TERRAIN_GRASS_DIRT_50,
  TERRAIN_GRASS_DIRT_75,
  TERRAIN_MATERIAL_COUNT,
  TERRAIN_MATERIAL_IDS,
  type TerrainMaterialId,
  VERTS_PER_ROW,
  generateHeightmap,
  generateTerrainMaterials,
  heightAt,
  WALKABLE_MAX_SLOPE,
  computeWalkable,
} from "./terrain";
