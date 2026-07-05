import { describe, expect, test } from "bun:test";
import { COMMAND_MOVE, COMMAND_STOP, enqueueCommand } from "./commands";
import { createPcg32, nextFloat, nextU32 } from "./math/prng";
import {
  clearSelection,
  createWorld,
  SEPARATION_RADIUS,
  setSelected,
  SIM_MAP_SIZE,
  spawnUnit,
  spawnUnits,
  tickWorld,
  type World,
} from "./ecs/world";
import { hashWorld } from "./hash";
import { createSnapshot, writeSnapshot } from "./snapshot";
import { computeWalkable, MAP_TILES, VERTS_PER_ROW, WALKABLE_MAX_SLOPE } from "./terrain";

function distance(world: World, a: number, b: number): number {
  const dx = world.posX[a]! - world.posX[b]!;
  const dz = world.posZ[a]! - world.posZ[b]!;
  return Math.sqrt(dx * dx + dz * dz);
}

// Movement tests flatten walkability to isolate movement mechanics from the
// seed's random rock placement; walkability has its own tests below.
function flatWorld(seed: number): World {
  const world = createWorld(seed);
  world.walkable.fill(1);
  return world;
}

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

describe("walkability", () => {
  function rampHeights(perTile: number): Float32Array {
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);

    for (let z = 0; z < VERTS_PER_ROW; z += 1) {
      for (let x = 0; x < VERTS_PER_ROW; x += 1) {
        heights[z * VERTS_PER_ROW + x] = z * perTile;
      }
    }

    return heights;
  }

  test("threshold sits where these tests assume it does", () => {
    // The ramp tests below use 0.5 and 0.75 (exact in binary) as clearly-below
    // and clearly-above probes; if the constant moves past either, they lose
    // their meaning silently.
    expect(WALKABLE_MAX_SLOPE).toBeGreaterThan(0.5);
    expect(WALKABLE_MAX_SLOPE).toBeLessThan(0.75);
  });

  test("flat terrain is fully walkable", () => {
    const walkable = computeWalkable(new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW));

    expect(walkable.length).toBe(MAP_TILES * MAP_TILES);
    expect(walkable.every((tile) => tile === 1)).toBe(true);
  });

  test("gentle ramps are walkable, steep ramps are not", () => {
    // 0.5 and 0.75 per tile are dyadic fractions, so the f32 height grid holds
    // them exactly and the edge deltas compare exactly against the threshold.
    expect(computeWalkable(rampHeights(0.5)).every((tile) => tile === 1)).toBe(true);
    expect(computeWalkable(rampHeights(0.75)).every((tile) => tile === 0)).toBe(true);
  });

  test("a cliff produces an unwalkable band at the step row, addressed row = z", () => {
    const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);

    for (let z = 128; z < VERTS_PER_ROW; z += 1) {
      for (let x = 0; x < VERTS_PER_ROW; x += 1) {
        heights[z * VERTS_PER_ROW + x] = 12;
      }
    }

    const walkable = computeWalkable(heights);

    // Only tiles spanning the cliff edge (corner rows 127 and 128) are steep.
    expect(walkable[127 * MAP_TILES + 10]).toBe(0);
    expect(walkable[50 * MAP_TILES + 10]).toBe(1);
    expect(walkable[200 * MAP_TILES + 10]).toBe(1);
    // The transposed tile must stay walkable, pinning row-major z addressing.
    expect(walkable[10 * MAP_TILES + 127]).toBe(1);
  });
});

describe("commands and separation", () => {
  test("an isolated unit arrives exactly and stops", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 10, 10, 0, 0);

    enqueueCommand(world, { tick: 1, type: COMMAND_MOVE, unitIds: [id], targetX: 20, targetZ: 10 });

    for (let tick = 0; tick < 80; tick += 1) {
      tickWorld(world);
    }

    // The arrive-snap makes exact equality valid — and keeps all lockstep
    // clients on identical bits instead of asymptotically-close floats.
    expect(world.posX[id]).toBe(20);
    expect(world.posZ[id]).toBe(10);
    expect(world.moving[id]).toBe(0);
  });

  test("exactly stacked units separate to the separation radius", () => {
    const world = flatWorld(7);
    spawnUnit(world, 100, 100, 0, 0);
    spawnUnit(world, 100, 100, 0, 0);

    for (let tick = 0; tick < 60; tick += 1) {
      tickWorld(world);
    }

    expect(distance(world, 0, 1)).toBeGreaterThanOrEqual(SEPARATION_RADIUS - 0.05);
  });

  test("a group move arrives as a spread crowd, not a point", () => {
    const world = flatWorld(7);
    const ids: number[] = [];

    for (let i = 0; i < 24; i += 1) {
      ids.push(spawnUnit(world, 50 + (i % 6), 50 + Math.floor(i / 6), 0, 0));
    }

    // ~70 world units of travel at 0.15/tick needs ~470 ticks; 600 leaves
    // slack for crowd jostling without masking a unit that never arrives.
    enqueueCommand(world, {
      tick: 1,
      type: COMMAND_MOVE,
      unitIds: ids,
      targetX: 100,
      targetZ: 100,
    });

    for (let tick = 0; tick < 600; tick += 1) {
      tickWorld(world);
    }

    let minPair = Infinity;

    for (let i = 0; i < ids.length; i += 1) {
      const fromTarget = Math.sqrt((world.posX[i]! - 100) ** 2 + (world.posZ[i]! - 100) ** 2);

      expect(fromTarget).toBeLessThan(6);

      for (let j = i + 1; j < ids.length; j += 1) {
        minPair = Math.min(minPair, distance(world, i, j));
      }
    }

    expect(minPair).toBeGreaterThan(0.4);
  });

  test("an arriving unit shoves an idle bystander aside", () => {
    const world = flatWorld(7);
    const idle = spawnUnit(world, 100, 100, 0, 0);
    const mover = spawnUnit(world, 94, 100, 0, 0);

    enqueueCommand(world, {
      tick: 1,
      type: COMMAND_MOVE,
      unitIds: [mover],
      targetX: 106,
      targetZ: 100,
    });

    for (let tick = 0; tick < 120; tick += 1) {
      tickWorld(world);
    }

    const idleDisplacement = Math.sqrt(
      (world.posX[idle]! - 100) ** 2 + (world.posZ[idle]! - 100) ** 2,
    );

    expect(idleDisplacement).toBeGreaterThan(0.1);
  });

  test("separation never pushes units out of bounds", () => {
    const world = flatWorld(7);

    for (let i = 0; i < 5; i += 1) {
      spawnUnit(world, 0.2, 0.2, 0, 0);
    }

    for (let tick = 0; tick < 100; tick += 1) {
      tickWorld(world);
    }

    for (let i = 0; i < world.count; i += 1) {
      expect(world.posX[i]!).toBeGreaterThanOrEqual(0);
      expect(world.posX[i]!).toBeLessThanOrEqual(SIM_MAP_SIZE);
      expect(world.posZ[i]!).toBeGreaterThanOrEqual(0);
      expect(world.posZ[i]!).toBeLessThanOrEqual(SIM_MAP_SIZE);
    }
  });

  test("scripted commands stay hash-identical across two worlds", () => {
    // The M3 exit-criteria test: same seed, same command script, compare the
    // full state hash EVERY tick so the first divergent tick names itself —
    // the same shape M4's desync detection will use.
    const script = (world: World): void => {
      const ids: number[] = [];

      for (let i = 0; i < 100; i += 1) {
        ids.push(spawnUnit(world, 30 + (i % 10), 30 + Math.floor(i / 10), 0, 0));
      }

      enqueueCommand(world, {
        tick: 3,
        type: COMMAND_MOVE,
        unitIds: ids,
        targetX: 200,
        targetZ: 60,
      });
      enqueueCommand(world, {
        tick: 30,
        type: COMMAND_STOP,
        unitIds: ids.slice(0, 50),
      });
      enqueueCommand(world, {
        tick: 50,
        type: COMMAND_MOVE,
        unitIds: ids.slice(0, 50),
        targetX: 60,
        targetZ: 200,
      });
    };

    const a = createWorld(42);
    const b = createWorld(42);

    script(a);
    script(b);

    for (let tick = 0; tick < 200; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });

  test("hash ignores selection but sees gameplay changes", () => {
    const world = flatWorld(42);
    spawnUnits(world, 10);

    const before = hashWorld(world);

    setSelected(world, 3, true);
    expect(hashWorld(world)).toBe(before);

    enqueueCommand(world, {
      tick: 1,
      type: COMMAND_MOVE,
      unitIds: [3],
      targetX: 50,
      targetZ: 50,
    });
    tickWorld(world);
    expect(hashWorld(world)).not.toBe(before);

    // Purity: hashing twice with no mutation in between is stable.
    expect(hashWorld(world)).toBe(hashWorld(world));
  });
});
