// Determinism rules: allowed math is + - * /, Math.sqrt/fround/abs/min/max/floor/ceil/
// trunc/sign, integer ops, and comparisons. Banned: transcendental Math functions,
// Math.random, Date, wall-clock or DOM state, and unordered iteration.
import {
  COMMAND_ATTACK,
  COMMAND_BUILD,
  COMMAND_GATHER,
  COMMAND_MOVE,
  COMMAND_PLACE,
  COMMAND_STOP,
  COMMAND_TRAIN,
  type Command,
} from "../commands";
import { buildFlowField, cellOf, type FlowField } from "../flow";
import { createPcg32, nextFloat, type Pcg32 } from "../math/prng";
import { computeWalkable, generateHeightmap, MAP_TILES } from "../terrain";
import { idGeneration, idIndex, packId } from "./id";
import {
  BUILD_PER_STRIKE,
  CARRY_CAPACITY,
  FOOD,
  GATHER_COOLDOWN_TICKS,
  GATHER_PER_STRIKE,
  LEASH_FACTOR,
  NODE_RETARGET_RADIUS,
  RESOURCE_COUNT,
  TYPE_BERRY,
  TYPE_TOWN_CENTER,
  TYPE_TREE,
  TYPE_VILLAGER,
  UNIT_TYPES,
  WOOD,
} from "./types";

export const TICK_HZ = 20;
export const TICK_S = 0.05;
export const SIM_MAP_SIZE = MAP_TILES;
export const MAX_UNITS = 10_000;
// Players use real ids < 256, but stockpiles index by actual id; a 256-wide
// array is 2 KB, cheaper than an id-to-slot map.
export const NEUTRAL_OWNER = 255;
export const MAX_PLAYERS = 8;
export const UNIT_SPEED = 3;
// Packed id 0 is VALID (handle 0, gen 0), so the no-target sentinel must be an
// impossible handle. 0xffff exceeds MAX_UNITS.
export const NO_TARGET = 0xffffffff;
export const MODE_IDLE = 0;
export const MODE_GATHERING = 1;
export const MODE_RETURNING = 2;
export const MODE_BUILDING = 3;
// world.winner values: -1 = match ongoing, >= 0 = that player id won,
// MATCH_DRAW = everyone is dead (mutual annihilation).
export const MATCH_DRAW = -2;
const FIELD_CACHE_SIZE = 8;
const FINAL_APPROACH_DIST = 2;
const GOAL_REMAP_RADIUS = 8;
const GRID_CELL = 2;
const GRID_DIM = SIM_MAP_SIZE / GRID_CELL;
const GRID_CELLS = GRID_DIM * GRID_DIM;
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
const MAX_TARGET_BODY_RADIUS = (() => {
  let maxRadius = 0;

  for (let type = 0; type < UNIT_TYPES.length; type += 1) {
    maxRadius = Math.max(maxRadius, UNIT_TYPES[type]!.bodyRadius);
  }

  return maxRadius;
})();

export interface World {
  tick: number;
  count: number;
  rng: Pcg32;
  heights: Float32Array;
  walkable: Uint8Array;
  posX: Float64Array;
  posZ: Float64Array;
  velX: Float64Array;
  velZ: Float64Array;
  moveTargetX: Float64Array;
  moveTargetZ: Float64Array;
  moving: Uint8Array;
  // Actual player ids, which are NOT guaranteed contiguous - lobby churn skips numbers;
  // 255 owners is plenty.
  owner: Uint8Array;
  stockpiles: Uint32Array;
  unitType: Uint8Array;
  hp: Uint16Array;
  buildProgress: Uint16Array;
  // Single-slot production: trainRemaining > 0 means the slot is busy; trainType is only meaningful then.
  trainType: Uint8Array;
  trainRemaining: Uint16Array;
  attackCooldown: Uint16Array;
  attackTarget: Uint32Array;
  attackOrdered: Uint8Array;
  mode: Uint8Array;
  carried: Uint16Array;
  carriedResource: Uint8Array;
  gatherNode: Uint32Array;
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
  const walkable = computeWalkable(heights);
  const slotOf = new Int32Array(MAX_UNITS);

  slotOf.fill(-1);

  return {
    tick: 0,
    count: 0,
    rng: createPcg32(seed),
    // One seed now derives the whole world: terrain and units can never disagree
    // about which map they're on.
    heights,
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
    owner: new Uint8Array(MAX_UNITS),
    stockpiles: new Uint32Array(256 * RESOURCE_COUNT),
    unitType: new Uint8Array(MAX_UNITS),
    hp: new Uint16Array(MAX_UNITS),
    buildProgress: new Uint16Array(MAX_UNITS),
    trainType: new Uint8Array(MAX_UNITS),
    trainRemaining: new Uint16Array(MAX_UNITS),
    attackCooldown: new Uint16Array(MAX_UNITS),
    attackTarget: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    attackOrdered: new Uint8Array(MAX_UNITS),
    mode: new Uint8Array(MAX_UNITS),
    carried: new Uint16Array(MAX_UNITS),
    carriedResource: new Uint8Array(MAX_UNITS),
    gatherNode: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
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

export function spawnUnit(
  world: World,
  x: number,
  z: number,
  vx: number,
  vz: number,
  owner = 0,
  type = 0,
): number {
  if (world.count >= MAX_UNITS) {
    throw new RangeError("World unit capacity exceeded.");
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
  world.owner[index] = owner;
  world.unitType[index] = type;
  world.hp[index] = UNIT_TYPES[type]!.maxHp;
  world.buildProgress[index] = 0;
  world.trainType[index] = 0;
  world.trainRemaining[index] = 0;
  world.attackCooldown[index] = 0;
  world.attackTarget[index] = NO_TARGET;
  world.attackOrdered[index] = 0;
  world.mode[index] = MODE_IDLE;
  world.carried[index] = 0;
  world.carriedResource[index] = 0;
  world.gatherNode[index] = NO_TARGET;
  world.gatherPosX[index] = 0;
  world.gatherPosZ[index] = 0;
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

function assignFieldGoal(world: World, index: number, targetX: number, targetZ: number): void {
  // MOVE keeps its walkable-goal remap before calling this. Chase targets are live entities whose
  // positions are definitionally reachable-adjacent, so remapping does not belong here.
  const goalCell = cellOf(targetX, targetZ);
  let fieldForGoal: FlowField | null = null;

  for (let cacheIndex = 0; cacheIndex < world.fieldCache.length; cacheIndex += 1) {
    const field = world.fieldCache[cacheIndex]!;

    if (field.goalCell === goalCell) {
      fieldForGoal = field;
      world.fieldCache.splice(cacheIndex, 1);
      world.fieldCache.push(field);
      break;
    }
  }

  if (fieldForGoal === null) {
    fieldForGoal = buildFlowField(world.walkable, goalCell);
    world.fieldCache.push(fieldForGoal);

    if (world.fieldCache.length > FIELD_CACHE_SIZE) {
      world.fieldCache.shift();
    }
  }

  world.unitField[index] = fieldForGoal;
  world.moveTargetX[index] = targetX;
  world.moveTargetZ[index] = targetZ;
  world.moving[index] = 1;
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
  }

  const baseCount = Math.floor(count / ownerCount);
  const extraCount = count % ownerCount;

  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
    const owner = ownerIds[ownerIndex]!;
    const [centerX, centerZ] = START_CORNERS[ownerIndex]!;
    const unitsForOwner = baseCount + (ownerIndex < extraCount ? 1 : 0);

    // Placed before units so the walkable-resample naturally keeps the army off the footprint;
    // deterministic order is preserved.
    spawnBuilding(world, centerX - 2, centerZ - 2, owner, TYPE_TOWN_CENTER);

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
      spawnUnit(world, x, z, 0, 0, owner);
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

export function spawnResourceNodes(world: World): void {
  // Fixed order: the rng stream and handle assignment depend on call order; do not reorder.
  // Reachability fields from both spawn corners (TCs already stamped — walkability is final).
  const fieldA = buildFlowField(world.walkable, walkableCellNear(world, 46, 46));
  const fieldB = buildFlowField(world.walkable, walkableCellNear(world, 210, 210));
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
}

export function tickWorld(world: World): void {
  // 1. Apply commands at the start of the tick.
  applyPendingCommands(world);

  // 2. Build a spatial grid from start-of-tick positions.
  world.cellCount.fill(0, 0, GRID_CELLS);

  for (let i = 0; i < world.count; i += 1) {
    const rawCellX = Math.floor(world.posX[i]! / GRID_CELL);
    const rawCellZ = Math.floor(world.posZ[i]! / GRID_CELL);
    const cellX = rawCellX < 0 ? 0 : rawCellX >= GRID_DIM ? GRID_DIM - 1 : rawCellX;
    const cellZ = rawCellZ < 0 ? 0 : rawCellZ >= GRID_DIM ? GRID_DIM - 1 : rawCellZ;
    const cell = cellX + GRID_DIM * cellZ;

    world.cellCount[cell] = world.cellCount[cell]! + 1;
  }

  world.cellStart[0] = 0;
  for (let cell = 0; cell < GRID_CELLS; cell += 1) {
    world.cellStart[cell + 1] = world.cellStart[cell]! + world.cellCount[cell]!;
  }

  world.cellCount.fill(0, 0, GRID_CELLS);

  for (let i = 0; i < world.count; i += 1) {
    const rawCellX = Math.floor(world.posX[i]! / GRID_CELL);
    const rawCellZ = Math.floor(world.posZ[i]! / GRID_CELL);
    const cellX = rawCellX < 0 ? 0 : rawCellX >= GRID_DIM ? GRID_DIM - 1 : rawCellX;
    const cellZ = rawCellZ < 0 ? 0 : rawCellZ >= GRID_DIM ? GRID_DIM - 1 : rawCellZ;
    const cell = cellX + GRID_DIM * cellZ;
    const offset = world.cellStart[cell]! + world.cellCount[cell]!;

    // Scatter runs in unit order, so each bucket's fixed neighbor order keeps float sums deterministic.
    world.cellUnits[offset] = i;
    world.cellCount[cell] = world.cellCount[cell]! + 1;
  }

  // 3. Combat needs the fresh spatial grid for acquisition and writes moveTarget/moving
  // that the movement compute then consumes.
  for (let i = 0; i < world.count; i += 1) {
    const stats = UNIT_TYPES[world.unitType[i]!]!;

    if (stats.isStatic) {
      // Trees don't fight; static rows never auto-acquire or strike.
      continue;
    }

    if (world.attackCooldown[i]! > 0) {
      world.attackCooldown[i] = world.attackCooldown[i]! - 1;
    }

    if (world.attackTarget[i] !== NO_TARGET) {
      const target = resolveId(world, world.attackTarget[i]!);

      if (target < 0) {
        world.attackTarget[i] = NO_TARGET;
        world.attackOrdered[i] = 0;
        world.moving[i] = 0;
        world.unitField[i] = null;
      } else {
        const dx = world.posX[target]! - world.posX[i]!;
        const dz = world.posZ[target]! - world.posZ[i]!;
        const distSq = dx * dx + dz * dz;
        const targetStats = UNIT_TYPES[world.unitType[target]!]!;
        const surfaceAttackRange = stats.attackRange + targetStats.bodyRadius;
        const attackRangeSq = surfaceAttackRange * surfaceAttackRange;

        // Range checks use target surface reach; large footprints are unwalkable, so center-range
        // melee would stop outside valid strike distance and orbit.
        if (distSq <= attackRangeSq) {
          world.moving[i] = 0;
          world.unitField[i] = null;

          if (world.attackCooldown[i] === 0) {
            dealDamage(world, target, stats.attackDamage);
            world.attackCooldown[i] = stats.attackCooldownTicks;
          }
        } else {
          const leashRange = stats.aggroRange * LEASH_FACTOR;
          const leashRangeSq = leashRange * leashRange;

          if (world.attackOrdered[i] === 1 || distSq <= leashRangeSq) {
            const targetX = world.posX[target]!;
            const targetZ = world.posZ[target]!;

            // STATIC targets - nodes and buildings - have goal cells that never move, so every
            // worker/attacker heading there shares one cached field. UNIT targets keep direct
            // seek: they move every tick, straight-line pursuit self-corrects, and per-tick
            // field builds would churn the tiny LRU.
            if (targetStats.isStatic) {
              const targetGoalCell = cellOf(targetX, targetZ);

              // Avoid re-running the cache lookup every tick for an unchanged static goal.
              if (world.unitField[i]?.goalCell !== targetGoalCell) {
                assignFieldGoal(world, i, targetX, targetZ);
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
      const aggroSearchRange = stats.aggroRange + MAX_TARGET_BODY_RADIUS;
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

            const dx = world.posX[j]! - x;
            const dz = world.posZ[j]! - z;
            const distSq = dx * dx + dz * dz;
            const surfaceAggroRange = stats.aggroRange + UNIT_TYPES[world.unitType[j]!]!.bodyRadius;

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

  // 4. Economy reads the same fresh grid as combat and writes moveTarget/moving for
  // movement to consume - the third costume for chase/strike.
  const villagerReach = UNIT_TYPES[TYPE_VILLAGER]!.attackRange;
  const retargetRangeSq = NODE_RETARGET_RADIUS * NODE_RETARGET_RADIUS;

  for (let i = 0; i < world.count; i += 1) {
    if (world.mode[i] === MODE_IDLE) {
      continue;
    }

    if (world.dying[i] === 1 || world.hp[i] === 0 || world.unitType[i] !== TYPE_VILLAGER) {
      continue;
    }

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
            assignFieldGoal(world, i, dropsiteX, dropsiteZ);
          }

          world.mode[i] = MODE_RETURNING;
        } else {
          world.mode[i] = MODE_IDLE;
          world.gatherNode[i] = NO_TARGET;
          world.gatherPosX[i] = 0;
          world.gatherPosZ[i] = 0;
          world.moving[i] = 0;
          world.unitField[i] = null;
        }

        continue;
      }

      let target = resolveId(world, world.gatherNode[i]!);

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
          world.gatherNode[i] = unitIdAt(world, bestNode);
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
                assignFieldGoal(world, i, dropsiteX, dropsiteZ);
              }

              world.mode[i] = MODE_RETURNING;
            } else {
              world.mode[i] = MODE_IDLE;
              world.gatherNode[i] = NO_TARGET;
              world.gatherPosX[i] = 0;
              world.gatherPosZ[i] = 0;
              world.moving[i] = 0;
              world.unitField[i] = null;
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

              world.gatherNode[i] = NO_TARGET;
              // En route to prospect: this scan re-runs each tick as they travel and adopts
              // the first node that comes into radius.
              if (world.unitField[i]?.goalCell !== prospectGoalCell) {
                assignFieldGoal(world, i, world.gatherPosX[i]!, world.gatherPosZ[i]!);
              }
            } else {
              world.mode[i] = MODE_IDLE;
              world.gatherNode[i] = NO_TARGET;
              world.gatherPosX[i] = 0;
              world.gatherPosZ[i] = 0;
              world.moving[i] = 0;
              world.unitField[i] = null;
            }
          }

          continue;
        }
      }

      const nodeStats = UNIT_TYPES[world.unitType[target]!]!;
      const dx = world.posX[target]! - world.posX[i]!;
      const dz = world.posZ[target]! - world.posZ[i]!;
      const distSq = dx * dx + dz * dz;
      const reach = villagerReach + nodeStats.bodyRadius;

      if (distSq <= reach * reach) {
        world.moving[i] = 0;
        world.unitField[i] = null;

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
        const reach = villagerReach + dropsiteStats.bodyRadius;

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

        const target = resolveId(world, world.gatherNode[i]!);

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
          world.gatherNode[i] = NO_TARGET;
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
            assignFieldGoal(world, i, dropsiteX, dropsiteZ);
          }
        } else {
          // A player with no dropsites has bigger problems; the villager stands carrying.
          world.mode[i] = MODE_IDLE;
          world.gatherNode[i] = NO_TARGET;
          world.gatherPosX[i] = 0;
          world.gatherPosZ[i] = 0;
          world.moving[i] = 0;
          world.unitField[i] = null;
        }
      }
    } else if (world.mode[i] === MODE_BUILDING) {
      const target = resolveId(world, world.gatherNode[i]!);

      if (target < 0 || world.dying[target] === 1 || world.hp[target] === 0) {
        world.mode[i] = MODE_IDLE;
        world.gatherNode[i] = NO_TARGET;
        world.gatherPosX[i] = 0;
        world.gatherPosZ[i] = 0;
        world.moving[i] = 0;
        world.unitField[i] = null;
        continue;
      }

      const siteStats = UNIT_TYPES[world.unitType[target]!]!;

      if (world.buildProgress[target]! >= siteStats.buildTicks) {
        world.mode[i] = MODE_IDLE;
        world.gatherNode[i] = NO_TARGET;
        world.gatherPosX[i] = 0;
        world.gatherPosZ[i] = 0;
        world.moving[i] = 0;
        world.unitField[i] = null;
        continue;
      }

      const dx = world.posX[target]! - world.posX[i]!;
      const dz = world.posZ[target]! - world.posZ[i]!;
      const distSq = dx * dx + dz * dz;
      const reach = villagerReach + siteStats.bodyRadius;

      if (distSq <= reach * reach) {
        world.moving[i] = 0;
        world.unitField[i] = null;

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
          assignFieldGoal(world, i, targetX, targetZ);
        }
      }
    }
  }

  // 5. Production countdown - spawns append at world.count and must not be iterated this tick.
  const producedThrough = world.count;

  for (let i = 0; i < producedThrough; i += 1) {
    // A building destroyed mid-train just loses the countdown - no refund, accepted M6 simplification.
    if (world.trainRemaining[i] === 0 || world.dying[i] === 1 || world.hp[i] === 0) continue;
    world.trainRemaining[i] = world.trainRemaining[i]! - 1;
    if (world.trainRemaining[i] !== 0) continue;
    // South edge first, then walkableCellNear's spiral - deterministic and footprint-safe.
    const footprint = UNIT_TYPES[world.unitType[i]!]!.footprint;
    const cell = walkableCellNear(world, world.posX[i]!, world.posZ[i]! + footprint / 2 + 1);

    spawnUnit(
      world,
      (cell % MAP_TILES) + 0.5,
      Math.floor(cell / MAP_TILES) + 0.5,
      0,
      0,
      world.owner[i]!,
      world.trainType[i]!,
    );
  }

  // 6. Compute pushes from start-of-tick positions only; forces never read partially-updated state.
  const step = UNIT_SPEED * TICK_S;

  for (let i = 0; i < world.count; i += 1) {
    const x = world.posX[i]!;
    const z = world.posZ[i]!;
    let pushX = 0;
    let pushZ = 0;

    if (UNIT_TYPES[world.unitType[i]!]!.isStatic) {
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

      // Fields quantize to tiles; the last stretch needs the exact line so arrival stays bit-exact.
      if (dist <= FINAL_APPROACH_DIST) {
        if (dist <= step) {
          pushX = dx;
          pushZ = dz;
          world.moving[i] = 0;
        } else {
          pushX = (dx / dist) * step;
          pushZ = (dz / dist) * step;
        }
      } else {
        const field = world.unitField[i] ?? null;

        // Most moving units follow their cached goal field.
        if (field !== null) {
          const cell = cellOf(x, z);
          const fdx = field.dirX[cell]!;
          const fdz = field.dirZ[cell]!;

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

  // 7. Apply pushes and clamp back into map bounds; separation can push units outward where seek never could.
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
    const curTile = cellOf(oldX, oldZ);
    const nextTile = cellOf(nx, nz);

    // Same-tile moves must stay legal or a unit spawned on rock can never leave.
    if (world.walkable[nextTile] === 1 || nextTile === curTile) {
      world.posX[i] = nx;
      world.posZ[i] = nz;
      continue;
    }

    const xSlideTile = cellOf(nx, oldZ);

    // Axis sliding turns head-on wall hits into smooth wall-following; the x-then-z
    // preference is arbitrary but fixed for determinism.
    if (world.walkable[xSlideTile] === 1 || xSlideTile === curTile) {
      world.posX[i] = nx;
      world.posZ[i] = oldZ;
      continue;
    }

    const zSlideTile = cellOf(oldX, nz);

    if (world.walkable[zSlideTile] === 1 || zSlideTile === curTile) {
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
      world.owner[i] = world.owner[last]!;
      world.unitType[i] = world.unitType[last]!;
      world.hp[i] = world.hp[last]!;
      world.buildProgress[i] = world.buildProgress[last]!;
      world.trainType[i] = world.trainType[last]!;
      world.trainRemaining[i] = world.trainRemaining[last]!;
      world.attackCooldown[i] = world.attackCooldown[last]!;
      world.attackTarget[i] = world.attackTarget[last]!;
      world.attackOrdered[i] = world.attackOrdered[last]!;
      world.mode[i] = world.mode[last]!;
      world.carried[i] = world.carried[last]!;
      world.carriedResource[i] = world.carriedResource[last]!;
      world.gatherNode[i] = world.gatherNode[last]!;
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
          world.mode[index] = MODE_IDLE;
          world.gatherNode[index] = NO_TARGET;
          world.gatherPosX[index] = 0;
          world.gatherPosZ[index] = 0;
          world.attackTarget[index] = NO_TARGET;
          world.attackOrdered[index] = 0;
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
        world.mode[index] = MODE_IDLE;
        world.gatherNode[index] = NO_TARGET;
        world.gatherPosX[index] = 0;
        world.gatherPosZ[index] = 0;
        world.attackTarget[index] = NO_TARGET;
        world.attackOrdered[index] = 0;
        world.moving[index] = 0;
        world.unitField[index] = null;
      }
    } else if (command.type === COMMAND_ATTACK) {
      const target = resolveId(world, command.targetId);

      if (
        target >= 0 &&
        world.owner[target] !== NEUTRAL_OWNER &&
        world.owner[target] !== command.issuer
      ) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          // THE ownership validation - one place, every client, deterministic. The relay stays
          // dumb; forged or mis-addressed commands die here identically everywhere.
          if (world.owner[index] !== command.issuer) continue;
          // Carried resources persist across interrupts: a hauler keeps the load.
          world.mode[index] = MODE_IDLE;
          world.gatherNode[index] = NO_TARGET;
          world.gatherPosX[index] = 0;
          world.gatherPosZ[index] = 0;
          world.attackTarget[index] = command.targetId;
          world.attackOrdered[index] = 1;
          world.moving[index] = 0;
          world.unitField[index] = null;
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
          if (world.unitType[index] !== TYPE_VILLAGER) continue;
          world.mode[index] = MODE_GATHERING;
          world.gatherNode[index] = command.targetId;
          world.gatherPosX[index] = world.posX[target]!;
          world.gatherPosZ[index] = world.posZ[target]!;
          world.attackTarget[index] = NO_TARGET;
          world.attackOrdered[index] = 0;
          world.moving[index] = 0;
          world.unitField[index] = null;
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
          if (world.unitType[index] !== TYPE_VILLAGER) continue;
          world.mode[index] = MODE_BUILDING;
          world.gatherNode[index] = command.targetId;
          world.gatherPosX[index] = world.posX[target]!;
          world.gatherPosZ[index] = world.posZ[target]!;
          world.attackTarget[index] = NO_TARGET;
          world.attackOrdered[index] = 0;
          world.moving[index] = 0;
          world.unitField[index] = null;
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

        if (
          // trains >= 0 first: a forged unitType of -1 must die here, not index UNIT_TYPES[-1] below.
          producerStats.trains >= 0 &&
          producerStats.trains === command.unitType &&
          world.buildProgress[building]! >= producerStats.buildTicks &&
          world.trainRemaining[building] === 0
        ) {
          const unitStats = UNIT_TYPES[command.unitType]!;
          const foodIndex = command.issuer * RESOURCE_COUNT + FOOD;
          const woodIndex = command.issuer * RESOURCE_COUNT + WOOD;

          if (
            world.stockpiles[foodIndex]! >= unitStats.costFood &&
            world.stockpiles[woodIndex]! >= unitStats.costWood
          ) {
            let pop = 0;
            let popCap = 0;

            // Command-rate scan is cheap, and counting promises here keeps cap validation local.
            for (let j = 0; j < world.count; j += 1) {
              if (world.owner[j] !== command.issuer || world.dying[j] === 1 || world.hp[j] === 0) {
                continue;
              }

              const js = UNIT_TYPES[world.unitType[j]!]!;

              if (js.footprint === 0) pop += 1;
              // An in-flight train slot is a promised unit; counting it stops two buildings from overshooting the cap in the same turn.
              if (world.trainRemaining[j]! > 0) pop += 1;
              if (js.footprint > 0 && world.buildProgress[j]! >= js.buildTicks) {
                popCap += js.popBonus;
              }
            }

            if (pop + 1 <= popCap) {
              world.stockpiles[foodIndex] = world.stockpiles[foodIndex]! - unitStats.costFood;
              world.stockpiles[woodIndex] = world.stockpiles[woodIndex]! - unitStats.costWood;
              world.trainType[building] = command.unitType;
              world.trainRemaining[building] = unitStats.buildTicks;
            }
          }
        }
      }
    } else if (command.type === COMMAND_PLACE) {
      const buildingType = command.buildingType;
      const buildingStats = UNIT_TYPES[buildingType];
      const foodIndex = command.issuer * RESOURCE_COUNT + FOOD;
      const woodIndex = command.issuer * RESOURCE_COUNT + WOOD;

      // The engine's ghost preview pre-validates, so failures here are stale-by-input-delay races —
      // e.g. two players placing on the same tiles in one turn: the first (playerId order) wins,
      // the second's command finds tiles occupied and dies silently. This is the desired lockstep semantics.
      if (
        buildingStats !== undefined &&
        buildingStats.footprint > 0 &&
        canPlaceBuilding(world, command.tileX, command.tileZ, buildingType) &&
        world.stockpiles[foodIndex]! >= buildingStats.costFood &&
        world.stockpiles[woodIndex]! >= buildingStats.costWood
      ) {
        world.stockpiles[foodIndex] = world.stockpiles[foodIndex]! - buildingStats.costFood;
        world.stockpiles[woodIndex] = world.stockpiles[woodIndex]! - buildingStats.costWood;
        spawnBuilding(world, command.tileX, command.tileZ, command.issuer, buildingType, false);
      }
    }

    // Rare path, allocation acceptable: command queue handling runs at click rate.
    world.commands.splice(i, 1);
  }
}
