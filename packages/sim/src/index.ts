// Load-bearing architecture rule: @aom/sim imports nothing from engine or DOM; violations
// are bugs even when they work. See ARCHITECTURE.md determinism rules before editing sim.
export * from "./commands";
export * from "./clock";
export {
  COMMAND_ADVANCE_AGE,
  COMMAND_GATHER,
  COMMAND_PLACE,
  COMMAND_PRAY,
  COMMAND_TRAIN,
} from "./commands";
export {
  CLASSICAL_AGE_ADVANCE_RULE,
  CLASSICAL_AGE_ADVANCE_TICKS,
  CLASSICAL_AGE_COST_FOOD,
  getAgeAdvanceAvailability,
  getAgeAdvanceProducerType,
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
  type TypeAvailabilityContext,
} from "./ecs/availability";
export { resolveAttackDamage, resolveMeleeDamage } from "./ecs/combat";
export {
  createProjectileStore,
  MAX_PROJECTILES,
  NO_PROJECTILE_TICK,
  PROJECTILE_ARROW,
  PROJECTILE_SLING_STONE,
  PROJECTILE_SPEAR,
  PROJECTILE_TYPE_COUNT,
  projectileProgressAt,
  queueProjectile,
  tickProjectileStore,
  type ProjectileStore,
  type ProjectileWorldState,
  type QueueProjectile,
} from "./ecs/projectiles";
export {
  favorCapForMajorGod,
  greekFavorRateMicrosPerSecond,
  greekFavorRateMilliPerMinute,
  isGreekMajorGod,
} from "./ecs/favor";
export { idGeneration, idIndex, packId } from "./ecs/id";
export { registerPlayer } from "./ecs/players";
export {
  activeTrainType,
  cancelProduction,
  clearProductionQueue,
  copyProductionQueue,
  enqueueProduction,
  finishActiveProduction,
  MAX_TRAIN_QUEUE,
  type ProductionQueueState,
} from "./ecs/production";
export {
  AGE_ARCHAIC,
  AGE_CLASSICAL,
  AGE_COUNT,
  AGE_HEROIC,
  AGE_MYTHIC,
  AGE_NAMES,
  GOD_ANUBIS,
  GOD_APHRODITE,
  GOD_APOLLO,
  GOD_ARES,
  GOD_ARTEMIS,
  GOD_ATHENA,
  GOD_BAST,
  GOD_DIONYSUS,
  GOD_HADES,
  GOD_HATHOR,
  GOD_HEPHAESTUS,
  GOD_HERMES,
  GOD_HORUS,
  GOD_HERA,
  GOD_ISIS,
  GOD_NEPHTHYS,
  GOD_OSIRIS,
  GOD_POSEIDON,
  GOD_PTAH,
  GOD_RA,
  GOD_SEKHMET,
  GOD_SET,
  GOD_THOTH,
  GOD_ZEUS,
  NO_AGE,
  NO_GOD,
} from "./ecs/progression";
export * from "./ecs/types";
export * from "./content/culture-types";
export * from "./content/unit-roster";
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
  MODE_PRAYING,
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
