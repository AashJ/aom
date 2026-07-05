// Load-bearing architecture rule: @aom/sim imports nothing from engine or DOM; violations
// are bugs even when they work. See ARCHITECTURE.md determinism rules before editing sim.
export * from "./commands";
export { idGeneration, idIndex, packId } from "./ecs/id";
export {
  FOOD,
  LEASH_FACTOR,
  RESOURCE_COUNT,
  TYPE_BERRY,
  TYPE_MILITIA,
  TYPE_TREE,
  TYPE_VILLAGER,
  UNIT_TYPES,
  WOOD,
  type UnitTypeStats,
} from "./ecs/types";
export * from "./ecs/world";
export {
  clearSelection,
  killUnit,
  MATCH_DRAW,
  MAX_PLAYERS,
  NEUTRAL_OWNER,
  NO_TARGET,
  resolveId,
  SEPARATION_RADIUS,
  setSelected,
  spawnResourceNodes,
  unitIdAt,
} from "./ecs/world";
export { buildFlowField, cellOf, type FlowField } from "./flow";
export * from "./hash";
export * from "./snapshot";
export * from "./math/prng";
export {
  MAP_TILES,
  VERTS_PER_ROW,
  generateHeightmap,
  heightAt,
  WALKABLE_MAX_SLOPE,
  computeWalkable,
} from "./terrain";
