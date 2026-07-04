// Determinism rules: allowed math is + - * /, Math.sqrt/fround/abs/min/max/floor/ceil/
// trunc/sign, integer ops, and comparisons. Banned: transcendental Math functions,
// Math.random, Date, wall-clock or DOM state, and unordered iteration.
import { COMMAND_MOVE, COMMAND_STOP, type Command } from "../commands";
import { createPcg32, nextFloat, type Pcg32 } from "../math/prng";

export const TICK_HZ = 20;
export const TICK_S = 0.05;
export const SIM_MAP_SIZE = 256;
export const MAX_UNITS = 10_000;
export const UNIT_SPEED = 3;

export interface World {
  tick: number;
  count: number;
  rng: Pcg32;
  posX: Float64Array;
  posZ: Float64Array;
  velX: Float64Array;
  velZ: Float64Array;
  moveTargetX: Float64Array;
  moveTargetZ: Float64Array;
  moving: Uint8Array;
  selectable: Uint8Array;
  selected: Uint8Array;
  commands: Command[];
}

export function createWorld(seed: number): World {
  return {
    tick: 0,
    count: 0,
    rng: createPcg32(seed),
    // SoA typed arrays: cache-friendly linear iteration, zero per-tick allocation, and
    // trivially hashable for future desync detection.
    posX: new Float64Array(MAX_UNITS),
    posZ: new Float64Array(MAX_UNITS),
    velX: new Float64Array(MAX_UNITS),
    velZ: new Float64Array(MAX_UNITS),
    moveTargetX: new Float64Array(MAX_UNITS),
    moveTargetZ: new Float64Array(MAX_UNITS),
    moving: new Uint8Array(MAX_UNITS),
    selectable: new Uint8Array(MAX_UNITS),
    // Per-client UI state in multiplayer eventually, but a plain component in M1.
    selected: new Uint8Array(MAX_UNITS),
    commands: [],
  };
}

export function spawnUnit(world: World, x: number, z: number, vx: number, vz: number): number {
  if (world.count >= MAX_UNITS) {
    throw new RangeError("World unit capacity exceeded.");
  }

  const id = world.count;

  world.posX[id] = x;
  world.posZ[id] = z;
  world.velX[id] = vx;
  world.velZ[id] = vz;
  world.moveTargetX[id] = 0;
  world.moveTargetZ[id] = 0;
  world.moving[id] = 0;
  world.selectable[id] = 1;
  world.selected[id] = 0;
  world.count += 1;
  return id;
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
    const x = 8 + nextFloat(world.rng) * (SIM_MAP_SIZE - 16);
    const z = 8 + nextFloat(world.rng) * (SIM_MAP_SIZE - 16);

    // Drift was M1 scaffolding to exercise interpolation; M3 units stand still until commanded.
    spawnUnit(world, x, z, 0, 0);
  }
}

export function tickWorld(world: World): void {
  applyPendingCommands(world);

  // Fixed dense iteration order is a determinism rule.
  for (let i = 0; i < world.count; i += 1) {
    if (world.moving[i] === 0) {
      continue;
    }

    const dx = world.moveTargetX[i]! - world.posX[i]!;
    const dz = world.moveTargetZ[i]! - world.posZ[i]!;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const step = UNIT_SPEED * TICK_S;

    if (dist <= step) {
      world.posX[i] = world.moveTargetX[i]!;
      world.posZ[i] = world.moveTargetZ[i]!;
      world.moving[i] = 0;
    } else {
      // No bounds clamp needed: straight lines toward in-bounds targets cannot exit the map,
      // and command targets get clamped at the engine boundary in the next chunk.
      world.posX[i] = world.posX[i]! + (dx / dist) * step;
      world.posZ[i] = world.posZ[i]! + (dz / dist) * step;
    }
  }

  world.tick += 1;
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
      for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
        const id = command.unitIds[unitIndex]!;

        if (id >= 0 && id < world.count) {
          world.moveTargetX[id] = command.targetX;
          world.moveTargetZ[id] = command.targetZ;
          world.moving[id] = 1;
        }
      }
    } else if (command.type === COMMAND_STOP) {
      for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
        const id = command.unitIds[unitIndex]!;

        if (id >= 0 && id < world.count) {
          world.moving[id] = 0;
        }
      }
    }

    // Rare path, allocation acceptable: command queue handling runs at click rate.
    world.commands.splice(i, 1);
  }
}
