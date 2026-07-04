// Determinism rules: allowed math is + - * /, Math.sqrt/fround/abs/min/max/floor/ceil/
// trunc/sign, integer ops, and comparisons. Banned: transcendental Math functions,
// Math.random, Date, wall-clock or DOM state, and unordered iteration.
import { createPcg32, nextFloat, type Pcg32 } from "../math/prng";

export const TICK_HZ = 20;
export const TICK_S = 0.05;
export const SIM_MAP_SIZE = 256;
export const MAX_UNITS = 2048;

export interface World {
  tick: number;
  count: number;
  rng: Pcg32;
  posX: Float64Array;
  posZ: Float64Array;
  velX: Float64Array;
  velZ: Float64Array;
  selectable: Uint8Array;
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
    selectable: new Uint8Array(MAX_UNITS),
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
  world.selectable[id] = 1;
  world.count += 1;
  return id;
}

export function spawnDriftingUnits(world: World, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const x = 8 + nextFloat(world.rng) * (SIM_MAP_SIZE - 16);
    const z = 8 + nextFloat(world.rng) * (SIM_MAP_SIZE - 16);
    const vx = (nextFloat(world.rng) - 0.5) * 1.2;
    const vz = (nextFloat(world.rng) - 0.5) * 1.2;

    spawnUnit(world, x, z, vx, vz);
  }
}

export function tickWorld(world: World): void {
  // Fixed dense iteration order is a determinism rule.
  for (let i = 0; i < world.count; i += 1) {
    let x = world.posX[i]! + world.velX[i]! * TICK_S;
    let z = world.posZ[i]! + world.velZ[i]! * TICK_S;
    let vx = world.velX[i]!;
    let vz = world.velZ[i]!;

    if (x < 0) {
      x = -x;
      vx = -vx;
    }

    if (x > SIM_MAP_SIZE) {
      x = 2 * SIM_MAP_SIZE - x;
      vx = -vx;
    }

    if (z < 0) {
      z = -z;
      vz = -vz;
    }

    if (z > SIM_MAP_SIZE) {
      z = 2 * SIM_MAP_SIZE - z;
      vz = -vz;
    }

    world.posX[i] = x;
    world.posZ[i] = z;
    world.velX[i] = vx;
    world.velZ[i] = vz;
  }

  world.tick += 1;
}
