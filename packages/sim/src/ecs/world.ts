// Determinism rules: allowed math is + - * /, Math.sqrt/fround/abs/min/max/floor/ceil/
// trunc/sign, integer ops, and comparisons. Banned: transcendental Math functions,
// Math.random, Date, wall-clock or DOM state, and unordered iteration.
import { COMMAND_MOVE, COMMAND_STOP, type Command } from "../commands";
import { buildFlowField, cellOf, type FlowField } from "../flow";
import { createPcg32, nextFloat, type Pcg32 } from "../math/prng";
import { computeWalkable, generateHeightmap, MAP_TILES } from "../terrain";
import { idGeneration, idIndex, packId } from "./id";

export const TICK_HZ = 20;
export const TICK_S = 0.05;
export const SIM_MAP_SIZE = MAP_TILES;
export const MAX_UNITS = 10_000;
export const UNIT_SPEED = 3;
const FIELD_CACHE_SIZE = 8;
const FINAL_APPROACH_DIST = 2;
const GOAL_REMAP_RADIUS = 8;
const GRID_CELL = 2;
const GRID_DIM = SIM_MAP_SIZE / GRID_CELL;
const GRID_CELLS = GRID_DIM * GRID_DIM;
export const SEPARATION_RADIUS = 0.8;
// Slightly under the 0.15 move step so movers still make net progress through a crowd.
const SEPARATION_MAX_STEP = 0.12;

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

export function spawnUnit(world: World, x: number, z: number, vx: number, vz: number): number {
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
  world.selectable[index] = 1;
  world.selected[index] = 0;
  world.count += 1;
  // Numerically identical while generations are 0; callers holding "indices" from spawnUnit
  // are already holding valid packed ids.
  return packId(handle, world.generation[handle]!);
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

export function spawnUnits(world: World, count: number): void {
  for (let i = 0; i < count; i += 1) {
    let x = 0;
    let z = 0;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      x = 8 + nextFloat(world.rng) * (SIM_MAP_SIZE - 16);
      z = 8 + nextFloat(world.rng) * (SIM_MAP_SIZE - 16);

      if (world.walkable[cellOf(x, z)] === 1) {
        break;
      }
    }

    // Drift was M1 scaffolding to exercise interpolation; M3 units stand still until commanded.
    // Spawn retry consumes a seed-derived, deterministic number of rng draws; spawn layout
    // shifts vs. step 2, acceptable before anything persists.
    spawnUnit(world, x, z, 0, 0);
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

  // 3. Compute pushes from start-of-tick positions only; forces never read partially-updated state.
  const step = UNIT_SPEED * TICK_S;

  for (let i = 0; i < world.count; i += 1) {
    const x = world.posX[i]!;
    const z = world.posZ[i]!;
    let pushX = 0;
    let pushZ = 0;

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

  // 4. Apply pushes and clamp back into map bounds; separation can push units outward where seek never could.
  for (let i = 0; i < world.count; i += 1) {
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

  world.tick += 1;
}

function applyDeaths(world: World): void {
  const deathCount = world.pendingDeathCount;

  if (deathCount === 0) {
    return;
  }

  // Fixed order for determinism. Removing high indices first means a swap can
  // never move a unit that is itself pending removal.
  world.pendingDeaths.subarray(0, deathCount).sort();

  for (let deathOffset = deathCount - 1; deathOffset >= 0; deathOffset -= 1) {
    const i = world.pendingDeaths[deathOffset]!;
    const last = world.count - 1;
    const handle = world.handleOf[i]!;

    world.slotOf[handle] = -1;
    world.generation[handle] = (world.generation[handle]! + 1) & 0xffff;
    world.freeHandles[world.freeHandleCount] = handle;
    world.freeHandleCount += 1;

    if (i !== last) {
      // EVERY future per-unit component (owner, hp, cooldown...) must be added
      // here. Missing one array is a delayed desync, the worst kind.
      world.posX[i] = world.posX[last]!;
      world.posZ[i] = world.posZ[last]!;
      world.velX[i] = world.velX[last]!;
      world.velZ[i] = world.velZ[last]!;
      world.moveTargetX[i] = world.moveTargetX[last]!;
      world.moveTargetZ[i] = world.moveTargetZ[last]!;
      world.moving[i] = world.moving[last]!;
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
      let commandField: FlowField | null = null;

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
        for (let cacheIndex = 0; cacheIndex < world.fieldCache.length; cacheIndex += 1) {
          const field = world.fieldCache[cacheIndex]!;

          if (field.goalCell === goalCell) {
            commandField = field;
            world.fieldCache.splice(cacheIndex, 1);
            world.fieldCache.push(field);
            break;
          }
        }

        if (commandField === null) {
          commandField = buildFlowField(world.walkable, goalCell);
          world.fieldCache.push(commandField);

          if (world.fieldCache.length > FIELD_CACHE_SIZE) {
            world.fieldCache.shift();
          }
        }

        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          world.moveTargetX[index] = targetX;
          world.moveTargetZ[index] = targetZ;
          world.moving[index] = 1;
          world.unitField[index] = commandField;
        }
      }
    } else if (command.type === COMMAND_STOP) {
      for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
        const id = command.unitIds[unitIndex]!;
        const index = resolveId(world, id);

        if (index < 0) continue;
        world.moving[index] = 0;
        world.unitField[index] = null;
      }
    }

    // Rare path, allocation acceptable: command queue handling runs at click rate.
    world.commands.splice(i, 1);
  }
}
