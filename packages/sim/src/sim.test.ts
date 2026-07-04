import { describe, expect, test } from "bun:test";
import { createPcg32, nextFloat, nextU32 } from "./math/prng";
import {
  clearSelection,
  createWorld,
  setSelected,
  SIM_MAP_SIZE,
  spawnUnits,
  tickWorld,
} from "./ecs/world";
import { createSnapshot, writeSnapshot } from "./snapshot";

describe("sim", () => {
  test("pcg32 is repeatable and bounded", () => {
    const a = createPcg32(42, 7);
    const b = createPcg32(42, 7);
    const c = createPcg32(42, 8);
    let differs = false;

    for (let i = 0; i < 8; i += 1) {
      const av = nextU32(a);
      const bv = nextU32(b);
      const cv = nextU32(c);

      expect(av).toBe(bv);
      differs = differs || av !== cv;
    }

    expect(differs).toBe(true);

    const rng = createPcg32(11);

    for (let i = 0; i < 1000; i += 1) {
      const value = nextFloat(rng);

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  test("world ticks deterministically", () => {
    const a = createWorld(42);
    const b = createWorld(42);

    spawnUnits(a, 1000);
    spawnUnits(b, 1000);

    for (let tick = 0; tick < 200; tick += 1) {
      tickWorld(a);
      tickWorld(b);
    }

    for (const index of [0, 1, 17, 255, 999]) {
      expect(a.posX[index]).toBe(b.posX[index]);
      expect(a.posZ[index]).toBe(b.posZ[index]);
      expect(a.velX[index]).toBe(b.velX[index]);
      expect(a.velZ[index]).toBe(b.velZ[index]);
    }

    expect(a.posX.every((value, index) => value === b.posX[index])).toBe(true);
    expect(a.posZ.every((value, index) => value === b.posZ[index])).toBe(true);
    expect(a.velX.every((value, index) => value === b.velX[index])).toBe(true);
    expect(a.velZ.every((value, index) => value === b.velZ[index])).toBe(true);
  });

  test("drifting units stay in bounds", () => {
    const world = createWorld(42);

    spawnUnits(world, 1000);

    for (let tick = 0; tick < 2000; tick += 1) {
      tickWorld(world);
    }

    for (let i = 0; i < world.count; i += 1) {
      expect(world.posX[i]!).toBeGreaterThanOrEqual(0);
      expect(world.posX[i]!).toBeLessThanOrEqual(SIM_MAP_SIZE);
      expect(world.posZ[i]!).toBeGreaterThanOrEqual(0);
      expect(world.posZ[i]!).toBeLessThanOrEqual(SIM_MAP_SIZE);
    }
  });

  test("snapshot copies tick count and narrows render values", () => {
    const world = createWorld(42);
    const snapshot = createSnapshot(1000);

    spawnUnits(world, 1000);
    tickWorld(world);
    writeSnapshot(world, snapshot);

    expect(snapshot.tick).toBe(world.tick);
    expect(snapshot.count).toBe(world.count);

    for (const index of [0, 17, 255, 999]) {
      expect(snapshot.posX[index]).toBe(Math.fround(world.posX[index]!));
      expect(snapshot.posZ[index]).toBe(Math.fround(world.posZ[index]!));
      expect(snapshot.selected[index]).toBe(0);
    }
  });

  test("selection writes to snapshots and can be cleared", () => {
    const world = createWorld(42);
    const snapshot = createSnapshot(16);

    spawnUnits(world, 10);
    setSelected(world, 5, true);
    writeSnapshot(world, snapshot);

    expect(snapshot.selected[5]).toBe(1);

    clearSelection(world);
    writeSnapshot(world, snapshot);

    expect(snapshot.selected[5]).toBe(0);
  });
});
