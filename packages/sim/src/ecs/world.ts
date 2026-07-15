// Determinism rules: allowed math is + - * /, Math.sqrt/fround/abs/min/max/floor/ceil/
// trunc/sign, integer ops, and comparisons. Banned: transcendental Math functions,
// Math.random, Date, wall-clock or DOM state, and unordered iteration.
import {
  CHEAT_ADD_FOOD,
  CHEAT_ADD_GOLD,
  CHEAT_ADD_WOOD,
  CHEAT_FULL_FAVOR,
  CHEAT_REVEAL_MAP,
  COMMAND_ADVANCE_AGE,
  COMMAND_ATTACK,
  COMMAND_BUILD,
  COMMAND_CANCEL_TRAIN,
  COMMAND_CHEAT,
  COMMAND_GATHER,
  COMMAND_MOVE,
  COMMAND_PLACE,
  COMMAND_PRAY,
  COMMAND_STOP,
  COMMAND_TRAIN,
  type Command,
} from "../commands";
import { TICK_S } from "../clock";
import {
  cultureForMajorGod,
  townCenterTypeForCulture,
  workerTypeForCulture,
} from "../content/culture-types";
import { buildFlowField, cellOf, sampleFlowDirection, type FlowField } from "../flow";
import { createPcg32, nextFloat, type Pcg32 } from "../math/prng";
import {
  computeWalkable,
  generateHeightmap,
  generateTerrainMaterials,
  MAP_TILES,
} from "../terrain";
import {
  isEntityVisibleTo,
  isFootprintVisibleTo,
  updateVisibility,
  VIS_EXPLORED,
  VISIBILITY_TILES,
} from "../visibility";
import { idGeneration, idIndex, packId } from "./id";
import { resolveMeleeDamage } from "./combat";
import { hasCompletedBuilding, isTypeAvailable } from "./availability";
import { NO_RESEARCH } from "./age-advancement";
import { favorCapForMajorGod, tickGreekFavor } from "./favor";
import { registerPlayer } from "./players";
import { assignFieldGoal, setFacingToward } from "./navigation";
import { AGE_COUNT, NO_GOD } from "./progression";
import {
  activeTrainType,
  cancelProduction,
  clearProductionQueue,
  copyProductionQueue,
  enqueueProduction,
  finishActiveProduction,
  MAX_TRAIN_QUEUE,
} from "./production";
import {
  createProjectileStore,
  queueProjectile,
  tickProjectileStore,
  type ProjectileStore,
} from "./projectiles";
import { GRID_CELL, GRID_CELLS, GRID_DIM, rebuildUnitSpatialGrid } from "./spatial-grid";
import {
  cancelBuildingResearch,
  isBuildingResearching,
  tickBuildingResearch,
  tryStartAgeAdvance,
} from "./research";
import {
  BUILD_PER_STRIKE,
  CARRY_CAPACITY,
  CULTURE_GREEK,
  FAVOR,
  FOOD,
  GATHER_COOLDOWN_TICKS,
  GATHER_PER_STRIKE,
  GOLD,
  LEASH_FACTOR,
  NODE_RETARGET_RADIUS,
  NO_UNIT_TYPE,
  RESOURCE_COUNT,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_GREEK_VILLAGER,
  TYPE_TREE,
  TRAIN_OPTIONS_BY_PRODUCER,
  UNIT_CLASS_WORKER,
  UNIT_TYPES,
  WOOD,
} from "./types";
import {
  assignGatherTask,
  assignWorkerTask,
  clearWorkerTask,
  isValidPrayerTarget,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_IDLE,
  MODE_PRAYING,
  MODE_RETURNING,
  NO_TARGET,
  tickPrayerTask,
} from "./worker-tasks";

export { TICK_HZ, TICK_S } from "../clock";
export { setFacingToward } from "./navigation";
export {
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_IDLE,
  MODE_PRAYING,
  MODE_RETURNING,
  NO_TARGET,
} from "./worker-tasks";
export const SIM_MAP_SIZE = MAP_TILES;
export const MAX_UNITS = 10_000;
// Players use real ids < 256, but stockpiles index by actual id; a 256-wide
// four-resource array is 4 KB, cheaper than an id-to-slot map.
export const NEUTRAL_OWNER = 255;
export const MAX_PLAYERS = 8;
// world.winner values: -1 = match ongoing, >= 0 = that player id won,
// MATCH_DRAW = everyone is dead (mutual annihilation).
export const MATCH_DRAW = -2;
const FINAL_APPROACH_DIST = 2;
const GOAL_REMAP_RADIUS = 8;
export const SEPARATION_RADIUS = 0.8;
// Slightly under the 0.15 move step so movers still make net progress through a crowd.
const SEPARATION_MAX_STEP = 0.12;
// Opposite corners for 1v1, the classic RTS start.
const START_CORNERS = [
  [40, 40],
  [216, 216],
  [216, 40],
  [40, 216],
] as const;
const GOLD_PLACEMENT_ATTEMPTS = 64;
const INV_SQRT2 = 1 / Math.sqrt(2);
const sampledFlowDirection = new Float64Array(2);
const GOLD_OTHER_NODE_CLEARANCE = 2;
// This is content for the current map, not a universal economy rule. Future
// maps can choose different counts and ranges without changing mine behavior.
const CURRENT_MAP_GOLD_PLACEMENTS = [
  { perPlayer: 1, minDistance: 22, maxDistance: 32, goldMineSpacing: 6 },
  { perPlayer: 1, minDistance: 50, maxDistance: 75, goldMineSpacing: 10 },
  { perPlayer: 1, minDistance: 90, maxDistance: 115, goldMineSpacing: 12 },
] as const;
const MAX_TARGET_BODY_RADIUS = (() => {
  let maxRadius = 0;

  for (let type = 0; type < UNIT_TYPES.length; type += 1) {
    const stats = UNIT_TYPES[type];
    if (stats !== undefined) {
      maxRadius = Math.max(maxRadius, stats.bodyRadius);
    }
  }

  return maxRadius;
})();

export interface World {
  tick: number;
  count: number;
  rng: Pcg32;
  heights: Float32Array;
  terrainMaterials: Uint8Array;
  walkable: Uint8Array;
  posX: Float64Array;
  posZ: Float64Array;
  velX: Float64Array;
  velZ: Float64Array;
  moveTargetX: Float64Array;
  moveTargetZ: Float64Array;
  moving: Uint8Array;
  // Unit-length world-space heading. A vector avoids deterministic-sim trig and
  // lets the renderer rotate 3D models through the full circle.
  facingX: Float64Array;
  facingZ: Float64Array;
  // Actual player ids, which are NOT guaranteed contiguous - lobby churn skips numbers;
  // 255 owners is plenty.
  owner: Uint8Array;
  playerIds: Uint8Array;
  playerSlotById: Int16Array;
  playerCount: number;
  visibility: Uint8Array;
  stockpiles: Uint32Array;
  // Progression is indexed by actual player id, like stockpiles. Visibility is
  // the exception because its map-sized rows are packed by active-player slot.
  playerAge: Uint8Array;
  playerMajorGod: Uint8Array;
  playerMinorGods: Uint8Array;
  // Fractional Favor is authoritative because it determines the tick on which
  // the next whole resource becomes spendable.
  playerFavorProgress: Uint32Array;
  // Rebuilt from active prayer tasks every tick for Favor generation and HUD rate.
  prayingVillagers: Uint16Array;
  unitType: Uint16Array;
  // Armor can produce fractional damage, so authoritative hit points remain f64.
  hp: Float64Array;
  buildProgress: Uint16Array;
  // Queue slot 0 is the authoritative active item. trainRemaining belongs only to that slot.
  trainRemaining: Uint16Array;
  trainQueueLength: Uint8Array;
  trainQueueTypes: Uint16Array;
  // Research is owned by its building and shares that producer's countdown slot.
  researchId: Uint8Array;
  researchChoice: Uint8Array;
  researchRemaining: Uint16Array;
  attackCooldown: Uint16Array;
  attackTarget: Uint32Array;
  attackOrdered: Uint8Array;
  projectiles: ProjectileStore;
  mode: Uint8Array;
  carried: Uint16Array;
  carriedResource: Uint8Array;
  // Stable-id target shared by gathering, construction, and prayer tasks.
  taskTarget: Uint32Array;
  // Last known position of the assigned node; returning villagers go back here to prospect
  // when the node died behind their back.
  gatherPosX: Float64Array;
  gatherPosZ: Float64Array;
  // Indexed by stable HANDLE, not dense slot. Per-dense-slot generations cannot
  // survive swap-remove: the moved unit's dense index changes, and its outstanding
  // ids must stay valid while it lives. Before any death, handle === dense index,
  // preserving M5 1a's generation-0 numeric equality.
  generation: Uint16Array;
  slotOf: Int32Array;
  handleOf: Uint32Array;
  nextHandle: number;
  freeHandles: Uint32Array;
  freeHandleCount: number;
  dying: Uint8Array;
  pendingDeaths: Uint32Array;
  pendingDeathCount: number;
  // Transient output for the last completed tick. Snapshots copy these before the
  // next tick clears them, so presentation never infers deaths from missing ids.
  deathEventCount: number;
  deathEventIds: Uint32Array;
  deathEventTypes: Uint16Array;
  deathEventPosX: Float64Array;
  deathEventPosZ: Float64Array;
  deathEventFacingX: Float64Array;
  deathEventFacingZ: Float64Array;
  deathEventOwners: Uint8Array;
  selectable: Uint8Array;
  selected: Uint8Array;
  commands: Command[];
  winner: number;
  contested: boolean;
  // Per-tick derived scratch and command-time flow caches. Excluded from hashWorld:
  // grid/push arrays are rebuilt from positions each tick; unitField/fieldCache are
  // derived flow-field references for current move targets and walkability.
  cellCount: Uint32Array;
  cellStart: Uint32Array;
  cellUnits: Uint32Array;
  pushX: Float64Array;
  pushZ: Float64Array;
  unitField: (FlowField | null)[];
  // Tiny LRU keyed by goalCell; groups share one field, that's the whole point of flow fields.
  fieldCache: FlowField[];
}

export function createWorld(seed: number): World {
  const heights = generateHeightmap(seed);
  const terrainMaterials = generateTerrainMaterials(seed, heights);
  const walkable = computeWalkable(heights);
  const slotOf = new Int32Array(MAX_UNITS);
  const playerSlotById = new Int16Array(256);
  const playerMajorGod = new Uint8Array(256);
  const playerMinorGods = new Uint8Array(256 * AGE_COUNT);
  const researchId = new Uint8Array(MAX_UNITS);
  const researchChoice = new Uint8Array(MAX_UNITS);

  slotOf.fill(-1);
  playerSlotById.fill(-1);
  playerMajorGod.fill(NO_GOD);
  playerMinorGods.fill(NO_GOD);
  researchId.fill(NO_RESEARCH);
  researchChoice.fill(NO_GOD);

  return {
    tick: 0,
    count: 0,
    rng: createPcg32(seed),
    // One seed now derives the whole world: terrain and units can never disagree
    // about which map they're on.
    heights,
    terrainMaterials,
    walkable,
    // SoA typed arrays: cache-friendly linear iteration, zero per-tick allocation, and
    // trivially hashable for future desync detection.
    posX: new Float64Array(MAX_UNITS),
    posZ: new Float64Array(MAX_UNITS),
    velX: new Float64Array(MAX_UNITS),
    velZ: new Float64Array(MAX_UNITS),
    moveTargetX: new Float64Array(MAX_UNITS),
    moveTargetZ: new Float64Array(MAX_UNITS),
    moving: new Uint8Array(MAX_UNITS),
    facingX: new Float64Array(MAX_UNITS),
    facingZ: new Float64Array(MAX_UNITS),
    owner: new Uint8Array(MAX_UNITS),
    playerIds: new Uint8Array(MAX_PLAYERS),
    playerSlotById,
    playerCount: 0,
    visibility: new Uint8Array(MAX_PLAYERS * VISIBILITY_TILES),
    stockpiles: new Uint32Array(256 * RESOURCE_COUNT),
    playerAge: new Uint8Array(256),
    playerMajorGod,
    playerMinorGods,
    playerFavorProgress: new Uint32Array(256),
    prayingVillagers: new Uint16Array(256),
    unitType: new Uint16Array(MAX_UNITS),
    hp: new Float64Array(MAX_UNITS),
    buildProgress: new Uint16Array(MAX_UNITS),
    trainRemaining: new Uint16Array(MAX_UNITS),
    trainQueueLength: new Uint8Array(MAX_UNITS),
    trainQueueTypes: new Uint16Array(MAX_UNITS * MAX_TRAIN_QUEUE).fill(NO_UNIT_TYPE),
    researchId,
    researchChoice,
    researchRemaining: new Uint16Array(MAX_UNITS),
    attackCooldown: new Uint16Array(MAX_UNITS),
    attackTarget: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    attackOrdered: new Uint8Array(MAX_UNITS),
    projectiles: createProjectileStore(),
    mode: new Uint8Array(MAX_UNITS),
    carried: new Uint16Array(MAX_UNITS),
    carriedResource: new Uint8Array(MAX_UNITS),
    taskTarget: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    gatherPosX: new Float64Array(MAX_UNITS),
    gatherPosZ: new Float64Array(MAX_UNITS),
    generation: new Uint16Array(MAX_UNITS),
    slotOf,
    handleOf: new Uint32Array(MAX_UNITS),
    nextHandle: 0,
    freeHandles: new Uint32Array(MAX_UNITS),
    freeHandleCount: 0,
    dying: new Uint8Array(MAX_UNITS),
    pendingDeaths: new Uint32Array(MAX_UNITS),
    pendingDeathCount: 0,
    deathEventCount: 0,
    deathEventIds: new Uint32Array(MAX_UNITS),
    deathEventTypes: new Uint16Array(MAX_UNITS),
    deathEventPosX: new Float64Array(MAX_UNITS),
    deathEventPosZ: new Float64Array(MAX_UNITS),
    deathEventFacingX: new Float64Array(MAX_UNITS),
    deathEventFacingZ: new Float64Array(MAX_UNITS),
    deathEventOwners: new Uint8Array(MAX_UNITS),
    selectable: new Uint8Array(MAX_UNITS),
    // Per-client UI state in multiplayer eventually, but a plain component in M1.
    selected: new Uint8Array(MAX_UNITS),
    commands: [],
    winner: -1,
    contested: false,
    cellCount: new Uint32Array(GRID_CELLS),
    cellStart: new Uint32Array(GRID_CELLS + 1),
    cellUnits: new Uint32Array(MAX_UNITS),
    pushX: new Float64Array(MAX_UNITS),
    pushZ: new Float64Array(MAX_UNITS),
    // oxlint-disable-next-line unicorn/no-new-array
    unitField: new Array(MAX_UNITS).fill(null),
    fieldCache: [],
  };
}

function isTypeAvailableToPlayer(
  world: World,
  playerId: number,
  unitType: number,
  producerType = NO_UNIT_TYPE,
): boolean {
  if (
    playerId < 0 ||
    playerId >= world.playerSlotById.length ||
    world.playerSlotById[playerId] === -1
  ) {
    return false;
  }

  const majorGod = world.playerMajorGod[playerId]!;
  const minorGodStart = playerId * AGE_COUNT;

  return isTypeAvailable(unitType, {
    playerAge: world.playerAge[playerId]!,
    playerCulture: cultureForMajorGod(majorGod),
    producerType,
    hasCompletedBuilding: (buildingType) => hasCompletedBuilding(world, playerId, buildingType),
    hasGod: (god) => {
      if (god === majorGod) return true;
      for (let age = 0; age < AGE_COUNT; age += 1) {
        if (world.playerMinorGods[minorGodStart + age] === god) return true;
      }
      return false;
    },
  });
}

function isWalkableStep(
  world: World,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): boolean {
  const fromTile = cellOf(fromX, fromZ);
  const toTile = cellOf(toX, toZ);

  // Units spawned on an obstructed tile must be able to move within it until
  // they cross onto walkable ground.
  if (toTile === fromTile) {
    return true;
  }

  if (world.walkable[toTile] !== 1) {
    return false;
  }

  const fromTileX = fromTile & (MAP_TILES - 1);
  const fromTileZ = fromTile >>> 8;
  const toTileX = toTile & (MAP_TILES - 1);
  const toTileZ = toTile >>> 8;

  if (fromTileX === toTileX || fromTileZ === toTileZ) {
    return true;
  }

  // A combined seek + separation push is shorter than one tile on each axis,
  // so a diagonal transition can only cross these two orthogonal side tiles.
  // Requiring both prevents the final blended vector from cutting a corner
  // even when its destination tile is itself walkable.
  const xSideTile = fromTileZ * MAP_TILES + toTileX;
  const zSideTile = toTileZ * MAP_TILES + fromTileX;
  return world.walkable[xSideTile] === 1 && world.walkable[zSideTile] === 1;
}

function hasWalkableDirectPath(
  world: World,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  distance: number,
): boolean {
  // Final approach is at most two world units. Quarter-tile segments cannot
  // skip an intervening cell, and isWalkableStep preserves the same diagonal
  // corner rule used by normal movement.
  const segmentCount = Math.ceil(distance * 4);
  let x = fromX;
  let z = fromZ;

  for (let segment = 1; segment <= segmentCount; segment += 1) {
    const nextX = fromX + ((toX - fromX) * segment) / segmentCount;
    const nextZ = fromZ + ((toZ - fromZ) * segment) / segmentCount;

    if (!isWalkableStep(world, x, z, nextX, nextZ)) {
      return false;
    }

    x = nextX;
    z = nextZ;
  }

  return true;
}

export function spawnUnit(
  world: World,
  x: number,
  z: number,
  vx: number,
  vz: number,
  owner = 0,
  type = TYPE_GREEK_VILLAGER,
): number {
  if (world.count >= MAX_UNITS) {
    throw new RangeError("World unit capacity exceeded.");
  }

  if (owner !== NEUTRAL_OWNER && world.playerSlotById[owner] === -1) {
    throw new RangeError(`Player ${owner} must be registered before spawning owned entities.`);
  }

  const index = world.count;
  const handle =
    world.freeHandleCount > 0 ? world.freeHandles[--world.freeHandleCount]! : world.nextHandle++;

  world.slotOf[handle] = index;
  world.handleOf[index] = handle;
  world.posX[index] = x;
  world.posZ[index] = z;
  world.velX[index] = vx;
  world.velZ[index] = vz;
  world.moveTargetX[index] = 0;
  world.moveTargetZ[index] = 0;
  world.moving[index] = 0;
  // The fixed camera looks from -X/-Z, so new idle units begin front-facing.
  world.facingX[index] = -INV_SQRT2;
  world.facingZ[index] = -INV_SQRT2;
  setFacingToward(world, index, x + vx, z + vz);
  world.owner[index] = owner;
  world.unitType[index] = type;
  world.hp[index] = UNIT_TYPES[type]!.maxHp;
  world.buildProgress[index] = 0;
  clearProductionQueue(world, index);
  world.researchId[index] = NO_RESEARCH;
  world.researchChoice[index] = NO_GOD;
  world.researchRemaining[index] = 0;
  world.attackCooldown[index] = 0;
  world.carried[index] = 0;
  world.carriedResource[index] = 0;
  clearWorkerTask(world, index);
  world.selectable[index] = 1;
  world.selected[index] = 0;
  world.count += 1;
  // Numerically identical while generations are 0; callers holding "indices" from spawnUnit
  // are already holding valid packed ids.
  return packId(handle, world.generation[handle]!);
}

export function flushFlowFields(world: World): void {
  // Fields are derived from walkability; any walkability edit invalidates every cached path.
  // Units mid-move fall back to direct seek until their next field fetch: graceful, deterministic.
  world.fieldCache.length = 0;
  world.unitField.fill(null);
}

export function canPlaceBuilding(
  world: World,
  tileX: number,
  tileZ: number,
  type: number,
): boolean {
  const footprint = UNIT_TYPES[type]!.footprint;

  // walkable doubles as the occupancy grid: mountains, other buildings, and map edges all reject
  // placement through one check.
  for (let z = tileZ; z < tileZ + footprint; z += 1) {
    for (let x = tileX; x < tileX + footprint; x += 1) {
      if (x < 0 || x >= MAP_TILES || z < 0 || z >= MAP_TILES) {
        return false;
      }

      if (world.walkable[z * MAP_TILES + x] !== 1) {
        return false;
      }
    }
  }

  return true;
}

export function spawnBuilding(
  world: World,
  tileX: number,
  tileZ: number,
  owner: number,
  type: number,
  complete = true,
): number {
  const footprint = UNIT_TYPES[type]!.footprint;
  const id = spawnUnit(world, tileX + footprint / 2, tileZ + footprint / 2, 0, 0, owner, type);
  const index = world.count - 1;

  // An incomplete building is a blueprint — present, footprint stamped, attackable,
  // but functionally inert until construction finishes in M6-5.
  world.buildProgress[index] = complete ? UNIT_TYPES[type]!.buildTicks : 0;
  // Units standing inside a just-stamped footprint are accepted as-is for M6 — the existing
  // same-tile movement allowance means they can always walk out.
  for (let z = tileZ; z < tileZ + footprint; z += 1) {
    for (let x = tileX; x < tileX + footprint; x += 1) {
      world.walkable[z * MAP_TILES + x] = 0;
    }
  }

  flushFlowFields(world);

  return id;
}

export function resolveId(world: World, id: number): number {
  const handle = idIndex(id);

  // -1 = stale or invalid — a unit that died during the input-delay window; callers treat it
  // as a silent, deterministic no-op. Ordering a corpse around must never be an error and NEVER
  // a desync. Dead handles keep slotOf = -1, so they resolve to -1 naturally.
  if (handle >= world.nextHandle || world.generation[handle] !== idGeneration(id)) return -1;
  return world.slotOf[handle]!;
}

export function unitIdAt(world: World, index: number): number {
  // How the engine converts a live index — e.g. from selection — into the id a command must carry.
  const handle = world.handleOf[index]!;

  return packId(handle, world.generation[handle]!);
}

export function killUnit(world: World, index: number): void {
  if (index < 0 || index >= world.count || world.dying[index] === 1) {
    return;
  }

  // Marks only; removal happens at tick end so mid-tick iteration order is never
  // disturbed. Callers today: tests; tomorrow: combat.
  world.dying[index] = 1;
  world.pendingDeaths[world.pendingDeathCount] = index;
  world.pendingDeathCount += 1;
}

export function clearSelection(world: World): void {
  world.selected.fill(0, 0, world.count);
}

export function setSelected(world: World, id: number, on: boolean): void {
  if (id < 0 || id >= world.count) {
    return;
  }

  world.selected[id] = on ? 1 : 0;
}

export function spawnUnits(world: World, count: number, ownerIds: number[] = [0]): void {
  const ownerCount = ownerIds.length;

  // A solo world must never declare a winner.
  world.contested = ownerCount > 1;

  if (ownerCount === 0) {
    return;
  }

  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
    registerPlayer(world, ownerIds[ownerIndex]!);
  }

  // Placement affordability lands in M6-4; 100/100 is a balance-pass placeholder.
  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
    const owner = ownerIds[ownerIndex]!;
    let alreadyCredited = false;

    for (let previousIndex = 0; previousIndex < ownerIndex; previousIndex += 1) {
      if (ownerIds[previousIndex] === owner) {
        alreadyCredited = true;
        break;
      }
    }

    if (alreadyCredited) {
      continue;
    }

    world.stockpiles[owner * RESOURCE_COUNT + FOOD] = 100;
    world.stockpiles[owner * RESOURCE_COUNT + WOOD] = 100;
    world.stockpiles[owner * RESOURCE_COUNT + GOLD] = 0;
    world.stockpiles[owner * RESOURCE_COUNT + FAVOR] = 0;
  }

  const baseCount = Math.floor(count / ownerCount);
  const extraCount = count % ownerCount;

  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
    const owner = ownerIds[ownerIndex]!;
    const [centerX, centerZ] = START_CORNERS[ownerIndex]!;
    const unitsForOwner = baseCount + (ownerIndex < extraCount ? 1 : 0);
    const culture = cultureForMajorGod(world.playerMajorGod[owner]!);
    const townCenterType = townCenterTypeForCulture(culture);
    const workerType = workerTypeForCulture(culture);

    // Placed before units so the walkable-resample naturally keeps the army off the footprint;
    // deterministic order is preserved.
    spawnBuilding(world, centerX - 2, centerZ - 2, owner, townCenterType);

    for (let i = 0; i < unitsForOwner; i += 1) {
      let x = 0;
      let z = 0;

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const rawX = centerX - 28 + nextFloat(world.rng) * 56;
        const rawZ = centerZ - 28 + nextFloat(world.rng) * 56;

        x = rawX < 8 ? 8 : rawX > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawX;
        z = rawZ < 8 ? 8 : rawZ > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawZ;

        if (world.walkable[cellOf(x, z)] === 1) {
          break;
        }
      }

      // Drift was M1 scaffolding to exercise interpolation; M3 units stand still until commanded.
      // Spawn retry consumes a seed-derived, deterministic number of rng draws; spawn layout
      // shifts vs. step 2, acceptable before anything persists.
      spawnUnit(world, x, z, 0, 0, owner, workerType);
    }
  }
}

// A resource node needs standing room: its own tile AND all eight neighbors
// walkable. A node on (or ringed by) rock is permanently ungatherable — workers
// grind against the boundary forever. Placement skips such spots.
function isNodeSpotOpen(world: World, x: number, z: number): boolean {
  const tx = Math.floor(x);
  const tz = Math.floor(z);

  if (tx < 1 || tx >= MAP_TILES - 1 || tz < 1 || tz >= MAP_TILES - 1) {
    return false;
  }

  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (world.walkable[(tz + dz) * MAP_TILES + (tx + dx)] !== 1) {
        return false;
      }
    }
  }

  return true;
}

// Local standing room (isNodeSpotOpen) is not enough: value-noise mountains form
// walkable POCKETS sealed off from the spawns, and a node inside one is passable
// 3x3 but globally unreachable — workers commute to it forever. Reachability is
// checked against a flow field built from each spawn corner at placement time.
function reachableIn(field: FlowField, x: number, z: number): boolean {
  const cell = cellOf(x, z);

  return cell === field.goalCell || field.dirX[cell] !== 0 || field.dirZ[cell] !== 0;
}

// Deterministic spiral for a walkable cell near a corner (the corner itself sits
// under the pre-placed Town Center footprint).
function walkableCellNear(world: World, x: number, z: number): number {
  for (let r = 0; r < 12; r += 1) {
    for (let dz = -r; dz <= r; dz += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;

        const tx = Math.floor(x) + dx;
        const tz = Math.floor(z) + dz;

        if (
          tx >= 0 &&
          tx < MAP_TILES &&
          tz >= 0 &&
          tz < MAP_TILES &&
          world.walkable[tz * MAP_TILES + tx] === 1
        ) {
          return tz * MAP_TILES + tx;
        }
      }
    }
  }

  return cellOf(x, z);
}

function hasNodeClearance(world: World, x: number, z: number, goldMineSpacing: number): boolean {
  for (let i = 0; i < world.count; i += 1) {
    const type = world.unitType[i]!;

    if (UNIT_TYPES[type]!.resource < 0) continue;

    const dx = world.posX[i]! - x;
    const dz = world.posZ[i]! - z;
    const clearance = type === TYPE_GOLD_MINE ? goldMineSpacing : GOLD_OTHER_NODE_CLEARANCE;

    if (dx * dx + dz * dz < clearance * clearance) {
      return false;
    }
  }

  return true;
}

function findConstrainedGoldSpot(
  world: World,
  startX: number,
  startZ: number,
  field: FlowField,
  minDistance: number,
  maxDistance: number,
  goldMineSpacing: number,
): readonly [number, number] | null {
  const minDistanceSq = minDistance * minDistance;
  const maxDistanceSq = maxDistance * maxDistance;

  // Square rejection sampling produces a random direction without sin/cos,
  // which are banned by the deterministic simulation contract.
  for (let attempt = 0; attempt < GOLD_PLACEMENT_ATTEMPTS; attempt += 1) {
    const x = startX + (nextFloat(world.rng) * 2 - 1) * maxDistance;
    const z = startZ + (nextFloat(world.rng) * 2 - 1) * maxDistance;
    const dx = x - startX;
    const dz = z - startZ;
    const distanceSq = dx * dx + dz * dz;

    if (
      distanceSq >= minDistanceSq &&
      distanceSq <= maxDistanceSq &&
      isNodeSpotOpen(world, x, z) &&
      reachableIn(field, x, z) &&
      hasNodeClearance(world, x, z, goldMineSpacing)
    ) {
      return [x, z];
    }
  }

  // Required map objects do not silently disappear after unlucky sampling.
  // The stable row-major fallback finds any legal tile in the same band.
  for (let tileZ = 1; tileZ < MAP_TILES - 1; tileZ += 1) {
    for (let tileX = 1; tileX < MAP_TILES - 1; tileX += 1) {
      const x = tileX + 0.5;
      const z = tileZ + 0.5;
      const dx = x - startX;
      const dz = z - startZ;
      const distanceSq = dx * dx + dz * dz;

      if (
        distanceSq >= minDistanceSq &&
        distanceSq <= maxDistanceSq &&
        isNodeSpotOpen(world, x, z) &&
        reachableIn(field, x, z) &&
        hasNodeClearance(world, x, z, goldMineSpacing)
      ) {
        return [x, z];
      }
    }
  }

  return null;
}

function spawnGoldMines(world: World, startFields: readonly FlowField[]): void {
  for (const placement of CURRENT_MAP_GOLD_PLACEMENTS) {
    for (let copy = 0; copy < placement.perPlayer; copy += 1) {
      for (let playerIndex = 0; playerIndex < world.playerCount; playerIndex += 1) {
        const [startX, startZ] = START_CORNERS[playerIndex]!;
        const spot = findConstrainedGoldSpot(
          world,
          startX,
          startZ,
          startFields[playerIndex]!,
          placement.minDistance,
          placement.maxDistance,
          placement.goldMineSpacing,
        );

        if (spot === null) {
          throw new RangeError(`Unable to place required gold mine for player ${playerIndex}`);
        }

        spawnUnit(world, spot[0], spot[1], 0, 0, NEUTRAL_OWNER, TYPE_GOLD_MINE);
      }
    }
  }
}

export function spawnResourceNodes(world: World): void {
  // Fixed order: the rng stream and handle assignment depend on call order; do not reorder.
  // Keep the two legacy tree fields in solo play; the forests are point-symmetric even
  // without an opponent. Additional player fields support their map-profile gold slots.
  const startFieldCount = Math.max(2, world.playerCount);
  const startFields: FlowField[] = [];

  for (let playerIndex = 0; playerIndex < startFieldCount; playerIndex += 1) {
    const [startX, startZ] = START_CORNERS[playerIndex]!;
    const inwardX = startX + (startX < SIM_MAP_SIZE * 0.5 ? 6 : -6);
    const inwardZ = startZ + (startZ < SIM_MAP_SIZE * 0.5 ? 6 : -6);
    startFields.push(buildFlowField(world.walkable, walkableCellNear(world, inwardX, inwardZ)));
  }

  const fieldA = startFields[0]!;
  const fieldB = startFields[1]!;
  for (let cluster = 0; cluster < 6; cluster += 1) {
    let centerX = 0;
    let centerZ = 0;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      centerX = 30 + nextFloat(world.rng) * 196;
      centerZ = 30 + nextFloat(world.rng) * 196;

      const dxA = centerX - 40;
      const dzA = centerZ - 40;
      const dxB = centerX - 216;
      const dzB = centerZ - 216;

      if (dxA * dxA + dzA * dzA >= 45 * 45 && dxB * dxB + dzB * dzB >= 45 * 45) {
        break;
      }
    }

    const treeCount = 8 + Math.floor(nextFloat(world.rng) * 8);

    for (let tree = 0; tree < treeCount; tree += 1) {
      let placed = false;

      for (let attempt = 0; attempt < 20 && !placed; attempt += 1) {
        const rawX = centerX - 10 + nextFloat(world.rng) * 20;
        const rawZ = centerZ - 10 + nextFloat(world.rng) * 20;
        const x = rawX < 8 ? 8 : rawX > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawX;
        const z = rawZ < 8 ? 8 : rawZ > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawZ;
        const mirrorX = SIM_MAP_SIZE - x;
        const mirrorZ = SIM_MAP_SIZE - z;

        // Terrain is NOT symmetric: a fine spot can have an on-rock mirror.
        // Place the pair only when BOTH ends are gatherable; skipping the pair
        // (not just one end) is what keeps the halves fair.
        if (
          isNodeSpotOpen(world, x, z) &&
          isNodeSpotOpen(world, mirrorX, mirrorZ) &&
          reachableIn(fieldA, x, z) &&
          reachableIn(fieldB, mirrorX, mirrorZ)
        ) {
          spawnUnit(world, x, z, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
          spawnUnit(world, mirrorX, mirrorZ, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
          placed = true;
        }
      }
    }
  }

  const berryOffsets = [
    [16, 16],
    [18, 13],
    [13, 18],
    [20, 16],
    [16, 20],
  ] as const;

  for (let cornerIndex = 0; cornerIndex < 2; cornerIndex += 1) {
    const [cornerX, cornerZ] = START_CORNERS[cornerIndex]!;
    const dirX = cornerX < SIM_MAP_SIZE * 0.5 ? 1 : -1;
    const dirZ = cornerZ < SIM_MAP_SIZE * 0.5 ? 1 : -1;

    for (let bush = 0; bush < berryOffsets.length; bush += 1) {
      const [offsetX, offsetZ] = berryOffsets[bush]!;
      let placed = false;

      // Jitter widens with each failed attempt so a rocky patch pushes the
      // bush to nearby open ground instead of silently accepting rock.
      for (let attempt = 0; attempt < 20 && !placed; attempt += 1) {
        const jitter = 3 + attempt * 0.75;
        const rawX = cornerX + dirX * offsetX + (nextFloat(world.rng) * 2 - 1) * jitter;
        const rawZ = cornerZ + dirZ * offsetZ + (nextFloat(world.rng) * 2 - 1) * jitter;
        const x = rawX < 8 ? 8 : rawX > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawX;
        const z = rawZ < 8 ? 8 : rawZ > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawZ;

        if (isNodeSpotOpen(world, x, z) && reachableIn(cornerIndex === 0 ? fieldA : fieldB, x, z)) {
          spawnUnit(world, x, z, 0, 0, NEUTRAL_OWNER, TYPE_BERRY);
          placed = true;
        }
      }
    }
  }

  // Gold is placed after existing resources so its clearance constraints cannot
  // perturb the established forest and berry layouts for the same seed.
  spawnGoldMines(world, startFields);
}

export function tickWorld(world: World): void {
  world.deathEventCount = 0;

  // 1. Visibility reads positions from the last completed movement step. Command
  // validation and combat below therefore consult the same authoritative mask.
  updateVisibility(world);

  // 2. Apply commands at the start of the tick.
  applyPendingCommands(world);

  // 3. Build a spatial grid from start-of-tick positions.
  rebuildUnitSpatialGrid(world);

  // 4. Existing projectile entities launch, fly, and impact before units decide
  // whether to begin a new attack cycle. A newly queued projectile cannot advance
  // until the next tick, preserving its animation-timed release boundary.
  tickProjectileStore(world, world.projectiles, UNIT_TYPES, dealDamage);

  // 5. Combat needs the fresh spatial grid for acquisition and writes moveTarget/moving
  // that the movement compute then consumes.
  for (let i = 0; i < world.count; i += 1) {
    const stats = UNIT_TYPES[world.unitType[i]!]!;
    const attack = stats.attack;

    if (stats.isStatic || attack === null) {
      // Static and unarmed rows never auto-acquire or strike.
      continue;
    }

    if (world.attackCooldown[i]! > 0) {
      world.attackCooldown[i] = world.attackCooldown[i]! - 1;
    }

    if (world.attackTarget[i] !== NO_TARGET) {
      const target = resolveId(world, world.attackTarget[i]!);
      const targetVisible = target >= 0 && isEntityVisibleTo(world, world.owner[i]!, target);

      if (!targetVisible) {
        const lastDx = world.moveTargetX[i]! - world.posX[i]!;
        const lastDz = world.moveTargetZ[i]! - world.posZ[i]!;
        const arrivedAtLastSeen =
          lastDx * lastDx + lastDz * lastDz <= FINAL_APPROACH_DIST * FINAL_APPROACH_DIST;

        if (world.attackOrdered[i] === 1 && !arrivedAtLastSeen) {
          // Explicit AoM-style pursuit investigates the last visible position without
          // reading the target's live hidden coordinates. Existing moveTargetX/Z are
          // the memory; no separate pursuit component is needed.
          world.moving[i] = 1;
        } else {
          world.attackTarget[i] = NO_TARGET;
          world.attackOrdered[i] = 0;
          world.moving[i] = 0;
          world.unitField[i] = null;
        }
      } else {
        const targetX = world.posX[target]!;
        const targetZ = world.posZ[target]!;
        const dx = targetX - world.posX[i]!;
        const dz = targetZ - world.posZ[i]!;
        const distSq = dx * dx + dz * dz;
        const targetStats = UNIT_TYPES[world.unitType[target]!]!;
        const surfaceAttackRange = attack.range + targetStats.bodyRadius;
        const attackRangeSq = surfaceAttackRange * surfaceAttackRange;

        // Always refresh the memory while visible, including while already in strike range.
        world.moveTargetX[i] = targetX;
        world.moveTargetZ[i] = targetZ;

        // Range checks use target surface reach; large footprints are unwalkable, so center-range
        // melee would stop outside valid strike distance and orbit.
        if (distSq <= attackRangeSq) {
          world.moving[i] = 0;
          world.unitField[i] = null;
          setFacingToward(world, i, targetX, targetZ);

          if (world.attackCooldown[i] === 0) {
            if (attack.kind === "melee") {
              dealDamage(world, target, resolveMeleeDamage(attack, targetStats));
            } else {
              queueProjectile(
                world.projectiles,
                {
                  sourceId: unitIdAt(world, i),
                  sourceType: world.unitType[i]!,
                  owner: world.owner[i]!,
                  targetId: unitIdAt(world, target),
                  attackTick: world.tick,
                },
                UNIT_TYPES,
              );
            }
            world.attackCooldown[i] = attack.cooldownTicks;
          }
        } else {
          const leashRange = attack.aggroRange * LEASH_FACTOR;
          const leashRangeSq = leashRange * leashRange;

          if (world.attackOrdered[i] === 1 || distSq <= leashRangeSq) {
            // STATIC targets - nodes and buildings - have goal cells that never move, so every
            // worker/attacker heading there shares one cached field. UNIT targets keep direct
            // seek: they move every tick, straight-line pursuit self-corrects, and per-tick
            // field builds would churn the tiny LRU.
            if (targetStats.isStatic) {
              const targetGoalCell = cellOf(targetX, targetZ);

              // Avoid re-running the cache lookup every tick for an unchanged static goal.
              if (world.unitField[i]?.goalCell !== targetGoalCell) {
                assignFieldGoal(world, i, targetX, targetZ, targetStats.footprint);
              }
            } else {
              world.moveTargetX[i] = targetX;
              world.moveTargetZ[i] = targetZ;
              world.moving[i] = 1;
              world.unitField[i] = null;
            }
          } else {
            world.attackTarget[i] = NO_TARGET;
            world.attackOrdered[i] = 0;
            world.moving[i] = 0;
            world.unitField[i] = null;
          }
        }
      }
    }

    if (
      world.attackTarget[i] === NO_TARGET &&
      world.moving[i] === 0 &&
      world.mode[i] === MODE_IDLE
    ) {
      // Villagers in economy modes keep working under fire; defense is the player's job in M6.
      // Classic RTS trick: 4x cheaper scans for a worst-case 200 ms reaction,
      // imperceptible and deterministic.
      if ((i + world.tick) % 4 !== 0) {
        continue;
      }

      const x = world.posX[i]!;
      const z = world.posZ[i]!;
      const aggroSearchRange = attack.aggroRange + MAX_TARGET_BODY_RADIUS;
      const searchRadius = Math.ceil(aggroSearchRange / GRID_CELL);
      const rawCellX = Math.floor(x / GRID_CELL);
      const rawCellZ = Math.floor(z / GRID_CELL);
      const cellX = rawCellX < 0 ? 0 : rawCellX >= GRID_DIM ? GRID_DIM - 1 : rawCellX;
      const cellZ = rawCellZ < 0 ? 0 : rawCellZ >= GRID_DIM ? GRID_DIM - 1 : rawCellZ;
      const minCellX = cellX > searchRadius ? cellX - searchRadius : 0;
      const maxCellX = cellX < GRID_DIM - 1 - searchRadius ? cellX + searchRadius : GRID_DIM - 1;
      const minCellZ = cellZ > searchRadius ? cellZ - searchRadius : 0;
      const maxCellZ = cellZ < GRID_DIM - 1 - searchRadius ? cellZ + searchRadius : GRID_DIM - 1;
      let bestIndex = -1;
      let bestDistSq = aggroSearchRange * aggroSearchRange;

      for (let neighborCellZ = minCellZ; neighborCellZ <= maxCellZ; neighborCellZ += 1) {
        for (let neighborCellX = minCellX; neighborCellX <= maxCellX; neighborCellX += 1) {
          const cell = neighborCellX + GRID_DIM * neighborCellZ;
          const start = world.cellStart[cell]!;
          const end = world.cellStart[cell + 1]!;

          for (let unitOffset = start; unitOffset < end; unitOffset += 1) {
            const j = world.cellUnits[unitOffset]!;

            // Nobody auto-fights a tree.
            if (j === i || world.owner[j] === world.owner[i] || world.owner[j] === NEUTRAL_OWNER) {
              continue;
            }

            if (!isEntityVisibleTo(world, world.owner[i]!, j)) {
              continue;
            }

            const dx = world.posX[j]! - x;
            const dz = world.posZ[j]! - z;
            const distSq = dx * dx + dz * dz;
            const surfaceAggroRange =
              attack.aggroRange + UNIT_TYPES[world.unitType[j]!]!.bodyRadius;

            // A large building's edge can be inside aggro range while its center is not.
            if (distSq > surfaceAggroRange * surfaceAggroRange) {
              continue;
            }

            // Grid buckets are in ascending unit order, so first-found-at-min-distance
            // is deterministic; equality keeps the lower dense index tiebreak across cells.
            if (
              bestIndex === -1 ||
              distSq < bestDistSq ||
              (distSq === bestDistSq && j < bestIndex)
            ) {
              bestIndex = j;
              bestDistSq = distSq;
            }
          }
        }
      }

      if (bestIndex >= 0) {
        world.attackTarget[i] = unitIdAt(world, bestIndex);
      }
    }
  }

  // 6. Economy reads the same fresh grid as combat and writes moveTarget/moving for
  // movement to consume - the third costume for chase/strike.
  const retargetRangeSq = NODE_RETARGET_RADIUS * NODE_RETARGET_RADIUS;

  world.prayingVillagers.fill(0);

  for (let i = 0; i < world.count; i += 1) {
    if (world.mode[i] === MODE_IDLE) {
      continue;
    }

    const workerStats = UNIT_TYPES[world.unitType[i]!]!;

    if (
      world.dying[i] === 1 ||
      world.hp[i] === 0 ||
      (workerStats.classes & UNIT_CLASS_WORKER) === 0
    ) {
      continue;
    }
    const workerReach = workerStats.workRange ?? 0;

    if (world.mode[i] === MODE_GATHERING) {
      if (world.carried[i]! >= CARRY_CAPACITY) {
        let bestDropsite = -1;
        let bestDropsiteDistSq = Number.POSITIVE_INFINITY;

        for (let j = 0; j < world.count; j += 1) {
          const dropsiteStats = UNIT_TYPES[world.unitType[j]!]!;

          if (
            !dropsiteStats.isDropsite ||
            world.owner[j] !== world.owner[i] ||
            world.dying[j] === 1 ||
            world.hp[j] === 0 ||
            !(world.buildProgress[j]! >= UNIT_TYPES[world.unitType[j]!]!.buildTicks)
          ) {
            continue;
          }

          const dx = world.posX[j]! - world.posX[i]!;
          const dz = world.posZ[j]! - world.posZ[i]!;
          const distSq = dx * dx + dz * dz;

          if (
            bestDropsite === -1 ||
            distSq < bestDropsiteDistSq ||
            (distSq === bestDropsiteDistSq && j < bestDropsite)
          ) {
            bestDropsite = j;
            bestDropsiteDistSq = distSq;
          }
        }

        if (bestDropsite >= 0) {
          const dropsiteX = world.posX[bestDropsite]!;
          const dropsiteZ = world.posZ[bestDropsite]!;
          const dropsiteGoalCell = cellOf(dropsiteX, dropsiteZ);

          if (world.unitField[i]?.goalCell !== dropsiteGoalCell) {
            assignFieldGoal(
              world,
              i,
              dropsiteX,
              dropsiteZ,
              UNIT_TYPES[world.unitType[bestDropsite]!]!.footprint,
            );
          }

          world.mode[i] = MODE_RETURNING;
        } else {
          clearWorkerTask(world, i);
        }

        continue;
      }

      let target = resolveId(world, world.taskTarget[i]!);

      if (
        target < 0 ||
        world.dying[target] === 1 ||
        world.hp[target] === 0 ||
        UNIT_TYPES[world.unitType[target]!]!.resource < 0
      ) {
        const searchX = world.posX[i]!;
        const searchZ = world.posZ[i]!;
        const requiredResource = world.carried[i]! > 0 ? world.carriedResource[i]! : -1;
        const searchRadius = Math.ceil(NODE_RETARGET_RADIUS / GRID_CELL);
        const rawCellX = Math.floor(searchX / GRID_CELL);
        const rawCellZ = Math.floor(searchZ / GRID_CELL);
        const cellX = rawCellX < 0 ? 0 : rawCellX >= GRID_DIM ? GRID_DIM - 1 : rawCellX;
        const cellZ = rawCellZ < 0 ? 0 : rawCellZ >= GRID_DIM ? GRID_DIM - 1 : rawCellZ;
        const minCellX = cellX > searchRadius ? cellX - searchRadius : 0;
        const maxCellX = cellX < GRID_DIM - 1 - searchRadius ? cellX + searchRadius : GRID_DIM - 1;
        const minCellZ = cellZ > searchRadius ? cellZ - searchRadius : 0;
        const maxCellZ = cellZ < GRID_DIM - 1 - searchRadius ? cellZ + searchRadius : GRID_DIM - 1;
        let bestNode = -1;
        let bestNodeDistSq = retargetRangeSq;

        // The depleted node's resource row may be gone; loaded workers keep their
        // carried resource, while empty workers accept any nearby resource node.
        for (let neighborCellZ = minCellZ; neighborCellZ <= maxCellZ; neighborCellZ += 1) {
          for (let neighborCellX = minCellX; neighborCellX <= maxCellX; neighborCellX += 1) {
            const cell = neighborCellX + GRID_DIM * neighborCellZ;
            const start = world.cellStart[cell]!;
            const end = world.cellStart[cell + 1]!;

            for (let unitOffset = start; unitOffset < end; unitOffset += 1) {
              const j = world.cellUnits[unitOffset]!;
              const candidateStats = UNIT_TYPES[world.unitType[j]!]!;

              if (
                candidateStats.resource < 0 ||
                world.dying[j] === 1 ||
                world.hp[j] === 0 ||
                (requiredResource >= 0 && candidateStats.resource !== requiredResource)
              ) {
                continue;
              }

              const dx = world.posX[j]! - searchX;
              const dz = world.posZ[j]! - searchZ;
              const distSq = dx * dx + dz * dz;

              if (distSq > retargetRangeSq) {
                continue;
              }

              // Grid buckets are fixed order; equality keeps the lower dense-index tiebreak.
              if (
                bestNode === -1 ||
                distSq < bestNodeDistSq ||
                (distSq === bestNodeDistSq && j < bestNode)
              ) {
                bestNode = j;
                bestNodeDistSq = distSq;
              }
            }
          }
        }

        if (bestNode >= 0) {
          world.taskTarget[i] = unitIdAt(world, bestNode);
          world.gatherPosX[i] = world.posX[bestNode]!;
          world.gatherPosZ[i] = world.posZ[bestNode]!;
          target = bestNode;
        } else {
          if (world.carried[i]! > 0) {
            let bestDropsite = -1;
            let bestDropsiteDistSq = Number.POSITIVE_INFINITY;

            for (let j = 0; j < world.count; j += 1) {
              const dropsiteStats = UNIT_TYPES[world.unitType[j]!]!;

              if (
                !dropsiteStats.isDropsite ||
                world.owner[j] !== world.owner[i] ||
                world.dying[j] === 1 ||
                world.hp[j] === 0 ||
                !(world.buildProgress[j]! >= UNIT_TYPES[world.unitType[j]!]!.buildTicks)
              ) {
                continue;
              }

              const dx = world.posX[j]! - world.posX[i]!;
              const dz = world.posZ[j]! - world.posZ[i]!;
              const distSq = dx * dx + dz * dz;

              if (
                bestDropsite === -1 ||
                distSq < bestDropsiteDistSq ||
                (distSq === bestDropsiteDistSq && j < bestDropsite)
              ) {
                bestDropsite = j;
                bestDropsiteDistSq = distSq;
              }
            }

            if (bestDropsite >= 0) {
              const dropsiteX = world.posX[bestDropsite]!;
              const dropsiteZ = world.posZ[bestDropsite]!;
              const dropsiteGoalCell = cellOf(dropsiteX, dropsiteZ);

              if (world.unitField[i]?.goalCell !== dropsiteGoalCell) {
                assignFieldGoal(
                  world,
                  i,
                  dropsiteX,
                  dropsiteZ,
                  UNIT_TYPES[world.unitType[bestDropsite]!]!.footprint,
                );
              }

              world.mode[i] = MODE_RETURNING;
            } else {
              clearWorkerTask(world, i);
            }
          } else {
            const prospectDx = world.gatherPosX[i]! - world.posX[i]!;
            const prospectDz = world.gatherPosZ[i]! - world.posZ[i]!;
            const prospectThreshold = NODE_RETARGET_RADIUS * 0.5;

            if (
              prospectDx * prospectDx + prospectDz * prospectDz >
              prospectThreshold * prospectThreshold
            ) {
              const prospectGoalCell = cellOf(world.gatherPosX[i]!, world.gatherPosZ[i]!);

              world.taskTarget[i] = NO_TARGET;
              // En route to prospect: this scan re-runs each tick as they travel and adopts
              // the first node that comes into radius.
              if (world.unitField[i]?.goalCell !== prospectGoalCell) {
                assignFieldGoal(world, i, world.gatherPosX[i]!, world.gatherPosZ[i]!);
              }
            } else {
              clearWorkerTask(world, i);
            }
          }

          continue;
        }
      }

      const nodeStats = UNIT_TYPES[world.unitType[target]!]!;
      const dx = world.posX[target]! - world.posX[i]!;
      const dz = world.posZ[target]! - world.posZ[i]!;
      const distSq = dx * dx + dz * dz;
      const reach = workerReach + nodeStats.bodyRadius;

      if (distSq <= reach * reach) {
        world.moving[i] = 0;
        world.unitField[i] = null;
        setFacingToward(world, i, world.posX[target]!, world.posZ[target]!);

        if (world.attackCooldown[i] === 0) {
          const take = Math.min(
            GATHER_PER_STRIKE,
            world.hp[target]!,
            CARRY_CAPACITY - world.carried[i]!,
          );

          world.hp[target] = world.hp[target]! - take;
          if (world.hp[target] === 0) {
            killUnit(world, target);
          }

          world.carried[i] = world.carried[i]! + take;
          world.carriedResource[i] = nodeStats.resource;
          world.gatherPosX[i] = world.posX[target]!;
          world.gatherPosZ[i] = world.posZ[target]!;
          // The shared cooldown is correct: a villager cannot chop and fight in the same breath.
          world.attackCooldown[i] = GATHER_COOLDOWN_TICKS;
        }
      } else {
        const targetX = world.posX[target]!;
        const targetZ = world.posZ[target]!;
        const targetGoalCell = cellOf(targetX, targetZ);

        // Resource nodes are STATIC targets: their goal cells do not move, so workers can
        // share cached fields instead of direct-seeking through terrain.
        if (world.unitField[i]?.goalCell !== targetGoalCell) {
          assignFieldGoal(world, i, targetX, targetZ);
        }
      }
    } else if (world.mode[i] === MODE_RETURNING) {
      let depositDropsite = -1;

      // Dropsites are buildings and few; scanning them every returning tick keeps arrival
      // deterministic without adding a per-tick-per-unit broadphase.
      for (let j = 0; j < world.count; j += 1) {
        const dropsiteStats = UNIT_TYPES[world.unitType[j]!]!;

        if (
          !dropsiteStats.isDropsite ||
          world.owner[j] !== world.owner[i] ||
          world.dying[j] === 1 ||
          world.hp[j] === 0 ||
          !(world.buildProgress[j]! >= UNIT_TYPES[world.unitType[j]!]!.buildTicks)
        ) {
          continue;
        }

        const dx = world.posX[j]! - world.posX[i]!;
        const dz = world.posZ[j]! - world.posZ[i]!;
        const distSq = dx * dx + dz * dz;
        const reach = workerReach + dropsiteStats.bodyRadius;

        if (distSq <= reach * reach) {
          depositDropsite = j;
          break;
        }
      }

      if (depositDropsite >= 0) {
        const owner = world.owner[i]!;
        const resource = world.carriedResource[i]!;

        world.stockpiles[owner * RESOURCE_COUNT + resource] =
          world.stockpiles[owner * RESOURCE_COUNT + resource]! + world.carried[i]!;
        world.carried[i] = 0;

        const target = resolveId(world, world.taskTarget[i]!);

        if (
          target >= 0 &&
          world.dying[target] === 0 &&
          world.hp[target]! > 0 &&
          UNIT_TYPES[world.unitType[target]!]!.resource >= 0
        ) {
          const targetX = world.posX[target]!;
          const targetZ = world.posZ[target]!;
          const targetGoalCell = cellOf(targetX, targetZ);

          world.mode[i] = MODE_GATHERING;
          world.gatherPosX[i] = targetX;
          world.gatherPosZ[i] = targetZ;

          if (world.unitField[i]?.goalCell !== targetGoalCell) {
            assignFieldGoal(world, i, targetX, targetZ);
          }
        } else {
          // Deposit-then-return-to-patch: keep prospect memory so the dead-node handling
          // walks back from the dropsite instead of clocking out at the town center.
          world.mode[i] = MODE_GATHERING;
          world.taskTarget[i] = NO_TARGET;
          world.moving[i] = 0;
          world.unitField[i] = null;
        }

        continue;
      }

      if (world.moving[i] === 0) {
        let bestDropsite = -1;
        let bestDropsiteDistSq = Number.POSITIVE_INFINITY;

        for (let j = 0; j < world.count; j += 1) {
          const dropsiteStats = UNIT_TYPES[world.unitType[j]!]!;

          if (
            !dropsiteStats.isDropsite ||
            world.owner[j] !== world.owner[i] ||
            world.dying[j] === 1 ||
            world.hp[j] === 0 ||
            !(world.buildProgress[j]! >= UNIT_TYPES[world.unitType[j]!]!.buildTicks)
          ) {
            continue;
          }

          const dx = world.posX[j]! - world.posX[i]!;
          const dz = world.posZ[j]! - world.posZ[i]!;
          const distSq = dx * dx + dz * dz;

          if (
            bestDropsite === -1 ||
            distSq < bestDropsiteDistSq ||
            (distSq === bestDropsiteDistSq && j < bestDropsite)
          ) {
            bestDropsite = j;
            bestDropsiteDistSq = distSq;
          }
        }

        if (bestDropsite >= 0) {
          const dropsiteX = world.posX[bestDropsite]!;
          const dropsiteZ = world.posZ[bestDropsite]!;
          const dropsiteGoalCell = cellOf(dropsiteX, dropsiteZ);

          if (world.unitField[i]?.goalCell !== dropsiteGoalCell) {
            assignFieldGoal(
              world,
              i,
              dropsiteX,
              dropsiteZ,
              UNIT_TYPES[world.unitType[bestDropsite]!]!.footprint,
            );
          }
        } else {
          // A player with no dropsites has bigger problems; the villager stands carrying.
          clearWorkerTask(world, i);
        }
      }
    } else if (world.mode[i] === MODE_BUILDING) {
      const target = resolveId(world, world.taskTarget[i]!);

      if (target < 0 || world.dying[target] === 1 || world.hp[target] === 0) {
        clearWorkerTask(world, i);
        continue;
      }

      const siteStats = UNIT_TYPES[world.unitType[target]!]!;

      if (world.buildProgress[target]! >= siteStats.buildTicks) {
        clearWorkerTask(world, i);
        continue;
      }

      const dx = world.posX[target]! - world.posX[i]!;
      const dz = world.posZ[target]! - world.posZ[i]!;
      const distSq = dx * dx + dz * dz;
      const reach = workerReach + siteStats.bodyRadius;

      if (distSq <= reach * reach) {
        world.moving[i] = 0;
        world.unitField[i] = null;
        setFacingToward(world, i, world.posX[target]!, world.posZ[target]!);

        if (world.attackCooldown[i] === 0) {
          const progress = world.buildProgress[target]! + BUILD_PER_STRIKE;

          world.buildProgress[target] =
            progress > siteStats.buildTicks ? siteStats.buildTicks : progress;
          // The shared cooldown means a villager cannot hammer and chop/fight in the same breath; N builders in reach stack N strikes per cooldown window.
          world.attackCooldown[i] = GATHER_COOLDOWN_TICKS;
        }
      } else {
        const targetX = world.posX[target]!;
        const targetZ = world.posZ[target]!;
        const targetGoalCell = cellOf(targetX, targetZ);

        // Building sites are static targets sharing cached fields.
        if (world.unitField[i]?.goalCell !== targetGoalCell) {
          assignFieldGoal(world, i, targetX, targetZ, siteStats.footprint);
        }
      }
    } else if (world.mode[i] === MODE_PRAYING) {
      const target = resolveId(world, world.taskTarget[i]!);
      tickPrayerTask(world, i, target, workerReach);
    }
  }

  tickGreekFavor(world);

  // 6. Production countdown - research occupies its building; queued units resume
  // on the completion tick. Completed spawns append after producedThrough.
  const producedThrough = world.count;

  for (let i = 0; i < producedThrough; i += 1) {
    if (tickBuildingResearch(world, i)) {
      continue;
    }

    // A building destroyed mid-train loses its entire queue with no refund.
    if (world.trainRemaining[i] === 0 || world.dying[i] === 1 || world.hp[i] === 0) {
      continue;
    }
    world.trainRemaining[i] = world.trainRemaining[i]! - 1;
    if (world.trainRemaining[i] !== 0) continue;
    // Classic buildings have a front-door exit on their -Z side. Their visible meshes overhang
    // the smaller logical footprints, so each producer owns an explicit model-clear offset.
    const producerStats = UNIT_TYPES[world.unitType[i]!]!;
    const cell = walkableCellNear(
      world,
      world.posX[i]!,
      world.posZ[i]! - producerStats.trainExitOffset,
    );

    const completedType = activeTrainType(world, i);
    if (completedType === NO_UNIT_TYPE) {
      world.trainRemaining[i] = 0;
      continue;
    }

    spawnUnit(
      world,
      (cell % MAP_TILES) + 0.5,
      Math.floor(cell / MAP_TILES) + 0.5,
      0,
      0,
      world.owner[i]!,
      completedType,
    );
    finishActiveProduction(world, i, (unitType) => UNIT_TYPES[unitType]!.buildTicks);
  }

  // 7. Compute pushes from start-of-tick positions only; forces never read partially-updated state.
  for (let i = 0; i < world.count; i += 1) {
    const x = world.posX[i]!;
    const z = world.posZ[i]!;
    const stats = UNIT_TYPES[world.unitType[i]!]!;
    const step = stats.movementSpeed * TICK_S;
    const wasMoving = world.moving[i] === 1;
    let pushX = 0;
    let pushZ = 0;

    if (stats.isStatic) {
      // Static nodes stay in the grid as separation sources, but never accumulate pushes.
      world.pushX[i] = 0;
      world.pushZ[i] = 0;
      continue;
    }

    if (world.moving[i] === 0) {
      pushX = 0;
      pushZ = 0;
    } else {
      const dx = world.moveTargetX[i]! - x;
      const dz = world.moveTargetZ[i]! - z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const field = world.unitField[i] ?? null;
      const canApproachDirectly =
        dist <= FINAL_APPROACH_DIST &&
        (field === null ||
          hasWalkableDirectPath(world, x, z, world.moveTargetX[i]!, world.moveTargetZ[i]!, dist));

      // Fields quantize to tiles; a clear last stretch uses the exact line so arrival stays
      // bit-exact. If terrain blocks that segment, keep following the field around it.
      if (canApproachDirectly) {
        if (dist <= step) {
          pushX = dx;
          pushZ = dz;
          world.moving[i] = 0;
        } else {
          pushX = (dx / dist) * step;
          pushZ = (dz / dist) * step;
        }
      } else {
        // Most moving units follow their cached goal field.
        if (field !== null) {
          sampleFlowDirection(field, x, z, sampledFlowDirection);
          const fdx = sampledFlowDirection[0]!;
          const fdz = sampledFlowDirection[1]!;

          if (fdx !== 0 || fdz !== 0) {
            pushX = fdx * step;
            pushZ = fdz * step;
          } else {
            // Unreachable pockets or unwalkable starts degrade to M3-step-1 behavior instead of freezing.
            pushX = (dx / dist) * step;
            pushZ = (dz / dist) * step;
          }
        } else {
          // Belt-and-suspenders: moving units should have a field, but direct seek remains valid.
          pushX = (dx / dist) * step;
          pushZ = (dz / dist) * step;
        }
      }
    }

    if (wasMoving && (pushX !== 0 || pushZ !== 0)) {
      setFacingToward(world, i, x + pushX, z + pushZ);
    }

    // Idle units are separated too, so arriving crowds spread out instead of stacking.
    let separationX = 0;
    let separationZ = 0;
    const rawCellX = Math.floor(x / GRID_CELL);
    const rawCellZ = Math.floor(z / GRID_CELL);
    const cellX = rawCellX < 0 ? 0 : rawCellX >= GRID_DIM ? GRID_DIM - 1 : rawCellX;
    const cellZ = rawCellZ < 0 ? 0 : rawCellZ >= GRID_DIM ? GRID_DIM - 1 : rawCellZ;
    const minCellX = cellX > 0 ? cellX - 1 : 0;
    const maxCellX = cellX < GRID_DIM - 1 ? cellX + 1 : GRID_DIM - 1;
    const minCellZ = cellZ > 0 ? cellZ - 1 : 0;
    const maxCellZ = cellZ < GRID_DIM - 1 ? cellZ + 1 : GRID_DIM - 1;

    // Radius 0.8 is smaller than the 2-unit cell size, so the 3x3 neighborhood always suffices.
    for (let neighborCellZ = minCellZ; neighborCellZ <= maxCellZ; neighborCellZ += 1) {
      for (let neighborCellX = minCellX; neighborCellX <= maxCellX; neighborCellX += 1) {
        const cell = neighborCellX + GRID_DIM * neighborCellZ;
        const start = world.cellStart[cell]!;
        const end = world.cellStart[cell + 1]!;

        for (let unitOffset = start; unitOffset < end; unitOffset += 1) {
          const j = world.cellUnits[unitOffset]!;

          if (j === i) {
            continue;
          }

          let dx = x - world.posX[j]!;
          let dz = z - world.posZ[j]!;
          let distSq = dx * dx + dz * dz;

          if (distSq >= SEPARATION_RADIUS * SEPARATION_RADIUS) {
            continue;
          }

          if (distSq < 1e-12) {
            // Any fixed function of (i, j) works here; it must not be random or order-dependent.
            const pairSign = i > j ? 1e-3 : -1e-3;

            dx = pairSign;
            dz = (i + j) % 2 === 0 ? pairSign : -pairSign;
            distSq = dx * dx + dz * dz;
          }

          const dist = Math.sqrt(distSq);
          const strength = 1 - dist / SEPARATION_RADIUS;

          separationX += (dx / dist) * strength * SEPARATION_MAX_STEP;
          separationZ += (dz / dist) * strength * SEPARATION_MAX_STEP;
        }
      }
    }

    const separationDistSq = separationX * separationX + separationZ * separationZ;

    if (separationDistSq > SEPARATION_MAX_STEP * SEPARATION_MAX_STEP) {
      // A crowd of N neighbors must not multiply the push.
      const scale = SEPARATION_MAX_STEP / Math.sqrt(separationDistSq);

      separationX *= scale;
      separationZ *= scale;
    }

    world.pushX[i] = pushX + separationX;
    world.pushZ[i] = pushZ + separationZ;
  }

  // 8. Apply pushes and clamp back into map bounds; separation can push units outward where seek never could.
  for (let i = 0; i < world.count; i += 1) {
    if (UNIT_TYPES[world.unitType[i]!]!.isStatic) {
      // Mobile units flowed around static sources during compute; the source itself never moves.
      continue;
    }

    const oldX = world.posX[i]!;
    const oldZ = world.posZ[i]!;
    const x = oldX + world.pushX[i]!;
    const z = oldZ + world.pushZ[i]!;
    const nx = x < 0 ? 0 : x > SIM_MAP_SIZE ? SIM_MAP_SIZE : x;
    const nz = z < 0 ? 0 : z > SIM_MAP_SIZE ? SIM_MAP_SIZE : z;
    if (isWalkableStep(world, oldX, oldZ, nx, nz)) {
      world.posX[i] = nx;
      world.posZ[i] = nz;
      continue;
    }

    // Axis sliding turns head-on wall hits into smooth wall-following; the x-then-z
    // preference is arbitrary but fixed for determinism.
    if (nx !== oldX && isWalkableStep(world, oldX, oldZ, nx, oldZ)) {
      world.posX[i] = nx;
      world.posZ[i] = oldZ;
      continue;
    }

    if (nz !== oldZ && isWalkableStep(world, oldX, oldZ, oldX, nz)) {
      world.posX[i] = oldX;
      world.posZ[i] = nz;
    }
  }

  applyDeaths(world);

  // Annihilation, in-sim, hashed: the UI reads it, never computes it.
  if (world.contested && world.winner === -1) {
    // Neutral forests must not prevent victory or count as armies in a draw.
    let liveArmies = 0;
    let liveOwner = -1;
    let singleOwner = true;

    for (let i = 0; i < world.count; i += 1) {
      const owner = world.owner[i]!;

      if (owner === NEUTRAL_OWNER) {
        continue;
      }

      liveArmies += 1;

      if (liveOwner === -1) {
        liveOwner = owner;
      } else if (owner !== liveOwner) {
        singleOwner = false;
      }
    }

    if (liveArmies === 0) {
      // Mutual annihilation is a real outcome: symmetric duels genuinely
      // double-KO on synchronized cooldowns. A draw, not an eternal stalemate.
      world.winner = MATCH_DRAW;
    } else if (singleOwner) {
      world.winner = liveOwner;
    }
  }

  world.tick += 1;
}

function dealDamage(world: World, index: number, damage: number): void {
  // THE strike seam: "decided to hit" is upstream, "damage lands" is here.
  // Deterministic projectile flight will insert between the two when ranged units arrive.
  world.hp[index] = Math.max(0, world.hp[index]! - damage);

  if (world.hp[index] === 0) {
    killUnit(world, index);
  }
}

function applyDeaths(world: World): void {
  const deathCount = world.pendingDeathCount;

  if (deathCount === 0) {
    return;
  }

  let restoredFootprint = false;

  // Fixed order for determinism. Removing high indices first means a swap can
  // never move a unit that is itself pending removal.
  world.pendingDeaths.subarray(0, deathCount).sort();

  for (let deathOffset = deathCount - 1; deathOffset >= 0; deathOffset -= 1) {
    const i = world.pendingDeaths[deathOffset]!;
    const last = world.count - 1;
    const handle = world.handleOf[i]!;
    const footprint = UNIT_TYPES[world.unitType[i]!]!.footprint;
    const eventIndex = world.deathEventCount;

    world.deathEventIds[eventIndex] = unitIdAt(world, i);
    world.deathEventTypes[eventIndex] = world.unitType[i]!;
    world.deathEventPosX[eventIndex] = world.posX[i]!;
    world.deathEventPosZ[eventIndex] = world.posZ[i]!;
    world.deathEventFacingX[eventIndex] = world.facingX[i]!;
    world.deathEventFacingZ[eventIndex] = world.facingZ[i]!;
    world.deathEventOwners[eventIndex] = world.owner[i]!;
    world.deathEventCount = eventIndex + 1;

    // Building-owned research is canceled before the producer's components disappear.
    cancelBuildingResearch(world, i);

    if (footprint > 0) {
      // Exact because building centers are constructed from integer origin tiles.
      const tileX = Math.round(world.posX[i]! - footprint / 2);
      const tileZ = Math.round(world.posZ[i]! - footprint / 2);

      // Rubble does not obstruct: destroyed buildings unblock immediately.
      for (let z = tileZ; z < tileZ + footprint; z += 1) {
        for (let x = tileX; x < tileX + footprint; x += 1) {
          world.walkable[z * MAP_TILES + x] = 1;
        }
      }

      restoredFootprint = true;
    }

    world.slotOf[handle] = -1;
    world.generation[handle] = (world.generation[handle]! + 1) & 0xffff;
    world.freeHandles[world.freeHandleCount] = handle;
    world.freeHandleCount += 1;

    if (i !== last) {
      // LOUD component-copy checklist: EVERY future per-unit component (owner, hp,
      // cooldown...) must be added here. Missing one array is a delayed desync, the worst kind.
      world.posX[i] = world.posX[last]!;
      world.posZ[i] = world.posZ[last]!;
      world.velX[i] = world.velX[last]!;
      world.velZ[i] = world.velZ[last]!;
      world.moveTargetX[i] = world.moveTargetX[last]!;
      world.moveTargetZ[i] = world.moveTargetZ[last]!;
      world.moving[i] = world.moving[last]!;
      world.facingX[i] = world.facingX[last]!;
      world.facingZ[i] = world.facingZ[last]!;
      world.owner[i] = world.owner[last]!;
      world.unitType[i] = world.unitType[last]!;
      world.hp[i] = world.hp[last]!;
      world.buildProgress[i] = world.buildProgress[last]!;
      copyProductionQueue(world, i, last);
      world.researchId[i] = world.researchId[last]!;
      world.researchChoice[i] = world.researchChoice[last]!;
      world.researchRemaining[i] = world.researchRemaining[last]!;
      world.attackCooldown[i] = world.attackCooldown[last]!;
      world.attackTarget[i] = world.attackTarget[last]!;
      world.attackOrdered[i] = world.attackOrdered[last]!;
      world.mode[i] = world.mode[last]!;
      world.carried[i] = world.carried[last]!;
      world.carriedResource[i] = world.carriedResource[last]!;
      world.taskTarget[i] = world.taskTarget[last]!;
      world.gatherPosX[i] = world.gatherPosX[last]!;
      world.gatherPosZ[i] = world.gatherPosZ[last]!;
      world.selectable[i] = world.selectable[last]!;
      world.selected[i] = world.selected[last]!;
      world.unitField[i] = world.unitField[last] ?? null;

      const movedHandle = world.handleOf[last]!;

      world.handleOf[i] = movedHandle;
      world.slotOf[movedHandle] = i;
    }

    world.unitField[last] = null;
    clearProductionQueue(world, last);
    world.count -= 1;
    world.dying[i] = 0;
    world.dying[last] = 0;
  }

  world.pendingDeathCount = 0;

  if (restoredFootprint) {
    // One invalidation per death batch, not per building.
    flushFlowFields(world);
  }
}

function applyPendingCommands(world: World): void {
  for (let i = 0; i < world.commands.length; ) {
    const command = world.commands[i]!;

    if (command.tick > world.tick) {
      i += 1;
      continue;
    }

    // Late commands apply ASAP instead of dropping; deterministic because queue order is fixed.
    if (command.type === COMMAND_MOVE) {
      let targetX = command.targetX;
      let targetZ = command.targetZ;
      let goalCell = cellOf(targetX, targetZ);

      if (world.walkable[goalCell] !== 1) {
        const goalTileX = goalCell % MAP_TILES;
        const goalTileZ = Math.floor(goalCell / MAP_TILES);
        let remappedCell = -1;

        // Fixed scan order is determinism; first hit is not the euclidean-nearest
        // but is stable and close enough - AoM-style "move to the closest reachable spot".
        for (let r = 1; r <= GOAL_REMAP_RADIUS && remappedCell === -1; r += 1) {
          for (let dz = -r; dz <= r && remappedCell === -1; dz += 1) {
            for (let dx = -r; dx <= r; dx += 1) {
              if (Math.abs(dx) !== r && Math.abs(dz) !== r) {
                continue;
              }

              const tileX = goalTileX + dx;
              const tileZ = goalTileZ + dz;

              if (tileX < 0 || tileX >= MAP_TILES || tileZ < 0 || tileZ >= MAP_TILES) {
                continue;
              }

              const candidate = tileZ * MAP_TILES + tileX;

              if (world.walkable[candidate] === 1) {
                remappedCell = candidate;
                targetX = tileX + 0.5;
                targetZ = tileZ + 0.5;
                break;
              }
            }
          }
        }

        if (remappedCell === -1) {
          // Clicked deep inside a mountain; leave existing orders untouched.
        } else {
          goalCell = remappedCell;
        }
      }

      if (world.walkable[goalCell] === 1) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          // THE ownership validation - one place, every client, deterministic. The relay stays
          // dumb; forged or mis-addressed commands die here identically everywhere.
          if (world.owner[index] !== command.issuer) continue;
          // Carried resources persist across interrupts: a hauler keeps the load.
          clearWorkerTask(world, index);
          assignFieldGoal(world, index, targetX, targetZ);
        }
      }
    } else if (command.type === COMMAND_STOP) {
      for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
        const id = command.unitIds[unitIndex]!;
        const index = resolveId(world, id);

        if (index < 0) continue;
        // THE ownership validation - one place, every client, deterministic. The relay stays
        // dumb; forged or mis-addressed commands die here identically everywhere.
        if (world.owner[index] !== command.issuer) continue;
        // Carried resources persist across interrupts: a hauler keeps the load.
        clearWorkerTask(world, index);
      }
    } else if (command.type === COMMAND_ATTACK) {
      const target = resolveId(world, command.targetId);

      if (
        target >= 0 &&
        world.owner[target] !== NEUTRAL_OWNER &&
        world.owner[target] !== command.issuer &&
        isEntityVisibleTo(world, command.issuer, target)
      ) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          // THE ownership validation - one place, every client, deterministic. The relay stays
          // dumb; forged or mis-addressed commands die here identically everywhere.
          if (world.owner[index] !== command.issuer) continue;
          // Carried resources persist across interrupts: a hauler keeps the load.
          clearWorkerTask(world, index);
          world.attackTarget[index] = command.targetId;
          world.attackOrdered[index] = 1;
          world.moveTargetX[index] = world.posX[target]!;
          world.moveTargetZ[index] = world.posZ[target]!;
        }
      }
    } else if (command.type === COMMAND_GATHER) {
      const target = resolveId(world, command.targetId);

      if (
        target >= 0 &&
        world.dying[target] === 0 &&
        world.hp[target]! > 0 &&
        UNIT_TYPES[world.unitType[target]!]!.resource >= 0
      ) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          // THE ownership validation - one place, every client, deterministic. The relay stays
          // dumb; forged or mis-addressed commands die here identically everywhere.
          if (world.owner[index] !== command.issuer) continue;
          // Militia in a mixed selection are silently skipped, not treated as an error.
          if ((UNIT_TYPES[world.unitType[index]!]!.classes & UNIT_CLASS_WORKER) === 0) continue;
          assignGatherTask(
            world,
            index,
            command.targetId,
            world.posX[target]!,
            world.posZ[target]!,
          );
        }
      }
    } else if (command.type === COMMAND_BUILD) {
      const target = resolveId(world, command.targetId);

      if (
        target >= 0 &&
        world.dying[target] === 0 &&
        world.hp[target]! > 0 &&
        world.owner[target] === command.issuer &&
        UNIT_TYPES[world.unitType[target]!]!.footprint > 0 &&
        world.buildProgress[target]! < UNIT_TYPES[world.unitType[target]!]!.buildTicks
      ) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          // THE ownership validation - one place, every client, deterministic. The relay stays
          // dumb; forged or mis-addressed commands die here identically everywhere.
          if (world.owner[index] !== command.issuer) continue;
          // Militia in a mixed selection are silently skipped, not treated as an error.
          if ((UNIT_TYPES[world.unitType[index]!]!.classes & UNIT_CLASS_WORKER) === 0) continue;
          assignWorkerTask(world, index, MODE_BUILDING, command.targetId);
        }
      }
    } else if (command.type === COMMAND_PRAY) {
      const target = resolveId(world, command.targetId);

      if (isValidPrayerTarget(world, target, command.issuer)) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          if (world.owner[index] !== command.issuer) continue;
          const workerStats = UNIT_TYPES[world.unitType[index]!]!;
          if (
            (workerStats.classes & UNIT_CLASS_WORKER) === 0 ||
            workerStats.culture !== CULTURE_GREEK
          ) {
            continue;
          }
          assignWorkerTask(world, index, MODE_PRAYING, command.targetId);
        }
      }
    } else if (command.type === COMMAND_TRAIN) {
      const building = resolveId(world, command.buildingId);

      if (
        building >= 0 &&
        world.dying[building] === 0 &&
        world.hp[building]! > 0 &&
        world.owner[building] === command.issuer
      ) {
        const producerStats = UNIT_TYPES[world.unitType[building]!]!;
        const trainOptions = TRAIN_OPTIONS_BY_PRODUCER[producerStats.id];

        if (
          trainOptions !== undefined &&
          trainOptions.some((option) => option.type === command.unitType) &&
          world.buildProgress[building]! >= producerStats.buildTicks &&
          world.trainQueueLength[building]! < MAX_TRAIN_QUEUE &&
          !isBuildingResearching(world, building) &&
          isTypeAvailableToPlayer(
            world,
            command.issuer,
            command.unitType,
            world.unitType[building]!,
          )
        ) {
          const unitStats = UNIT_TYPES[command.unitType]!;
          const foodIndex = command.issuer * RESOURCE_COUNT + FOOD;
          const woodIndex = command.issuer * RESOURCE_COUNT + WOOD;
          const goldIndex = command.issuer * RESOURCE_COUNT + GOLD;
          const favorIndex = command.issuer * RESOURCE_COUNT + FAVOR;

          if (
            world.stockpiles[foodIndex]! >= unitStats.costFood &&
            world.stockpiles[woodIndex]! >= unitStats.costWood &&
            world.stockpiles[goldIndex]! >= unitStats.costGold &&
            world.stockpiles[favorIndex]! >= unitStats.costFavor
          ) {
            let pop = 0;
            let popCap = 0;

            // Command-rate scan is cheap, and counting promises here keeps cap validation local.
            for (let j = 0; j < world.count; j += 1) {
              if (world.owner[j] !== command.issuer || world.dying[j] === 1 || world.hp[j] === 0) {
                continue;
              }

              const js = UNIT_TYPES[world.unitType[j]!]!;

              pop += js.populationCost;
              // Every queued order is a promised unit; sum its own cost so mixed queues cannot
              // overshoot the cap in the same turn.
              const queueStart = j * MAX_TRAIN_QUEUE;
              for (let queueIndex = 0; queueIndex < world.trainQueueLength[j]!; queueIndex += 1) {
                pop += UNIT_TYPES[world.trainQueueTypes[queueStart + queueIndex]!]!.populationCost;
              }
              if (js.footprint > 0 && world.buildProgress[j]! >= js.buildTicks) {
                popCap += js.popBonus;
              }
            }

            if (pop + unitStats.populationCost <= popCap) {
              world.stockpiles[foodIndex] = world.stockpiles[foodIndex]! - unitStats.costFood;
              world.stockpiles[woodIndex] = world.stockpiles[woodIndex]! - unitStats.costWood;
              world.stockpiles[goldIndex] = world.stockpiles[goldIndex]! - unitStats.costGold;
              world.stockpiles[favorIndex] = world.stockpiles[favorIndex]! - unitStats.costFavor;

              enqueueProduction(world, building, command.unitType, unitStats.buildTicks);
            }
          }
        }
      }
    } else if (command.type === COMMAND_CANCEL_TRAIN) {
      const building = resolveId(world, command.buildingId);

      if (
        building >= 0 &&
        world.dying[building] === 0 &&
        world.hp[building]! > 0 &&
        world.owner[building] === command.issuer
      ) {
        const cancelledType = cancelProduction(
          world,
          building,
          command.queueIndex,
          (unitType) => UNIT_TYPES[unitType]!.buildTicks,
        );

        if (cancelledType !== NO_UNIT_TYPE) {
          const stats = UNIT_TYPES[cancelledType]!;
          const resourceStart = command.issuer * RESOURCE_COUNT;

          world.stockpiles[resourceStart + FOOD] =
            world.stockpiles[resourceStart + FOOD]! + stats.costFood;
          world.stockpiles[resourceStart + WOOD] =
            world.stockpiles[resourceStart + WOOD]! + stats.costWood;
          world.stockpiles[resourceStart + GOLD] =
            world.stockpiles[resourceStart + GOLD]! + stats.costGold;
          world.stockpiles[resourceStart + FAVOR] =
            world.stockpiles[resourceStart + FAVOR]! + stats.costFavor;
        }
      }
    } else if (command.type === COMMAND_ADVANCE_AGE) {
      const building = resolveId(world, command.buildingId);

      tryStartAgeAdvance(world, command.issuer, building, command.minorGod);
    } else if (command.type === COMMAND_CHEAT) {
      const playerId = command.issuer;
      const playerSlot = world.playerSlotById[playerId] ?? -1;

      if (playerSlot !== -1) {
        if (command.cheat === CHEAT_ADD_FOOD) {
          addCheatResource(world, playerId, FOOD);
        } else if (command.cheat === CHEAT_ADD_WOOD) {
          addCheatResource(world, playerId, WOOD);
        } else if (command.cheat === CHEAT_ADD_GOLD) {
          addCheatResource(world, playerId, GOLD);
        } else if (command.cheat === CHEAT_FULL_FAVOR) {
          world.stockpiles[playerId * RESOURCE_COUNT + FAVOR] = favorCapForMajorGod(
            world.playerMajorGod[playerId]!,
          );
        } else if (command.cheat === CHEAT_REVEAL_MAP) {
          const start = playerSlot * VISIBILITY_TILES;
          world.visibility.fill(VIS_EXPLORED, start, start + VISIBILITY_TILES);
        }
      }
    } else if (command.type === COMMAND_PLACE) {
      const buildingType = command.buildingType;
      const buildingStats = UNIT_TYPES[buildingType];
      const foodIndex = command.issuer * RESOURCE_COUNT + FOOD;
      const woodIndex = command.issuer * RESOURCE_COUNT + WOOD;
      const goldIndex = command.issuer * RESOURCE_COUNT + GOLD;
      const favorIndex = command.issuer * RESOURCE_COUNT + FAVOR;

      // The engine's ghost preview pre-validates, so failures here are stale-by-input-delay races —
      // e.g. two players placing on the same tiles in one turn: the first (playerId order) wins,
      // the second's command finds tiles occupied and dies silently. This is the desired lockstep semantics.
      if (
        buildingStats !== undefined &&
        buildingStats.footprint > 0 &&
        isTypeAvailableToPlayer(
          world,
          command.issuer,
          buildingType,
          workerTypeForCulture(cultureForMajorGod(world.playerMajorGod[command.issuer]!)),
        ) &&
        isFootprintVisibleTo(
          world,
          command.issuer,
          command.tileX,
          command.tileZ,
          buildingStats.footprint,
        ) &&
        canPlaceBuilding(world, command.tileX, command.tileZ, buildingType) &&
        world.stockpiles[foodIndex]! >= buildingStats.costFood &&
        world.stockpiles[woodIndex]! >= buildingStats.costWood &&
        world.stockpiles[goldIndex]! >= buildingStats.costGold &&
        world.stockpiles[favorIndex]! >= buildingStats.costFavor
      ) {
        world.stockpiles[foodIndex] = world.stockpiles[foodIndex]! - buildingStats.costFood;
        world.stockpiles[woodIndex] = world.stockpiles[woodIndex]! - buildingStats.costWood;
        world.stockpiles[goldIndex] = world.stockpiles[goldIndex]! - buildingStats.costGold;
        world.stockpiles[favorIndex] = world.stockpiles[favorIndex]! - buildingStats.costFavor;
        spawnBuilding(world, command.tileX, command.tileZ, command.issuer, buildingType, false);
      }
    }

    // Rare path, allocation acceptable: command queue handling runs at click rate.
    world.commands.splice(i, 1);
  }
}

function addCheatResource(world: World, playerId: number, resource: number): void {
  const index = playerId * RESOURCE_COUNT + resource;
  world.stockpiles[index] = Math.min(0xffffffff, world.stockpiles[index]! + 1_000);
}
