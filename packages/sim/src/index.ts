// Load-bearing architecture rule: @aom/sim imports nothing from engine or DOM; violations
// are bugs even when they work. See ARCHITECTURE.md determinism rules before editing sim.
export * from "./commands";
export * from "./ecs/world";
export { clearSelection, SEPARATION_RADIUS, setSelected } from "./ecs/world";
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
