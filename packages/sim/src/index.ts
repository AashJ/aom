// Load-bearing architecture rule: @aom/sim imports nothing from engine or DOM; violations
// are bugs even when they work. See ARCHITECTURE.md determinism rules before editing sim.
export * from "./commands";
export { COMMAND_GATHER, COMMAND_PLACE } from "./commands";
export { idGeneration, idIndex, packId } from "./ecs/id";
export {
  BUILD_PER_STRIKE,
  CARRY_CAPACITY,
  FOOD,
  GATHER_COOLDOWN_TICKS,
  GATHER_PER_STRIKE,
  LEASH_FACTOR,
  NODE_RETARGET_RADIUS,
  RESOURCE_COUNT,
  TYPE_BARRACKS,
  TYPE_BERRY,
  TYPE_HOUSE,
  TYPE_MILITIA,
  TYPE_TOWN_CENTER,
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
