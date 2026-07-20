import { describe, expect, test } from "bun:test";
import {
  COMMAND_ATTACK,
  COMMAND_BUILD,
  COMMAND_GATHER,
  COMMAND_MOVE,
  COMMAND_PLACE,
  COMMAND_STOP,
  COMMAND_TRAIN,
  enqueueCommand,
} from "./commands";
import { idGeneration, idIndex, packId } from "./ecs/id";
import { registerPlayer } from "./ecs/players";
import { MAX_TRAIN_QUEUE } from "./ecs/production";
import { AGE_CLASSICAL, GOD_RA, GOD_ZEUS } from "./ecs/progression";
import { CULTURE_GREEK } from "./content/unit-type-schema";
import {
  CARRY_CAPACITY,
  FAVOR,
  FOOD,
  GOLD,
  LEASH_FACTOR,
  RESOURCE_COUNT,
  TYPE_BERRY,
  TYPE_GREEK_HOUSE as TYPE_HOUSE,
  TYPE_GREEK_MILITARY_ACADEMY as TYPE_BARRACKS,
  TYPE_GREEK_TOWN_CENTER as TYPE_TOWN_CENTER,
  TYPE_GREEK_VILLAGER as TYPE_VILLAGER,
  TYPE_EGYPTIAN_LABORER,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_HOPLITE,
  TYPE_GOLD_MINE,
  TYPE_MILITIA,
  TYPE_MINOTAUR,
  TYPE_SPEARMAN,
  TYPE_TREE,
  UNIT_TYPES,
  WOOD,
} from "./ecs/types";
import { createPcg32, nextFloat, nextU32 } from "./math/prng";
import {
  canPlaceBuilding,
  clearSelection,
  createPlayableWorld,
  createWorld,
  killUnit,
  MATCH_DRAW,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_IDLE,
  NEUTRAL_OWNER,
  NO_TARGET,
  resolveId,
  spawnBuilding,
  spawnResourceNodes,
  SEPARATION_RADIUS,
  setSelected,
  SIM_MAP_SIZE,
  spawnUnit,
  spawnUnits,
  tickWorld,
  unitIdAt,
  type World,
} from "./ecs/world";
import { hashWorld } from "./hash";
import { createSnapshot, writeSnapshot } from "./snapshot";
import { computeWalkable, MAP_TILES, VERTS_PER_ROW, WALKABLE_MAX_SLOPE } from "./terrain";
import { updateVisibility, VIS_EXPLORED, VIS_VISIBLE } from "./visibility";

function distance(world: World, a: number, b: number): number {
  const dx = world.posX[a]! - world.posX[b]!;
  const dz = world.posZ[a]! - world.posZ[b]!;
  return Math.sqrt(dx * dx + dz * dz);
}

// Movement tests flatten walkability to isolate movement mechanics from the
// seed's random rock placement; walkability has its own tests below.
function flatWorld(seed: number, playerIds: readonly number[] = [0]): World {
  const world = createWorld(seed);

  for (const playerId of playerIds) {
    registerPlayer(world, playerId);
  }

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
      expect(a.facingX[index]).toBe(b.facingX[index]);
      expect(a.facingZ[index]).toBe(b.facingZ[index]);
    }

    expect(a.posX.every((value, index) => value === b.posX[index])).toBe(true);
    expect(a.posZ.every((value, index) => value === b.posZ[index])).toBe(true);
    expect(a.velX.every((value, index) => value === b.velX[index])).toBe(true);
    expect(a.velZ.every((value, index) => value === b.velZ[index])).toBe(true);
    expect(a.facingX.every((value, index) => value === b.facingX[index])).toBe(true);
    expect(a.facingZ.every((value, index) => value === b.facingZ[index])).toBe(true);
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

    spawnUnits(world, 1000);
    const snapshot = createSnapshot(world.count);
    world.facingX[17] = 0.25;
    world.facingZ[17] = -0.75;
    tickWorld(world);
    world.mode[17] = MODE_GATHERING;
    world.moving[17] = 0;
    world.unitType[18] = TYPE_BERRY;
    world.taskTarget[17] = unitIdAt(world, 18);
    world.attackCooldown[17] = 7;
    writeSnapshot(world, snapshot);

    expect(snapshot.tick).toBe(world.tick);
    expect(snapshot.count).toBe(world.count);

    for (const index of [0, 17, 255, 999]) {
      expect(snapshot.posX[index]).toBe(Math.fround(world.posX[index]!));
      expect(snapshot.posZ[index]).toBe(Math.fround(world.posZ[index]!));
      expect(snapshot.selected[index]).toBe(0);
      expect(snapshot.facingX[index]).toBe(Math.fround(world.facingX[index]!));
      expect(snapshot.facingZ[index]).toBe(Math.fround(world.facingZ[index]!));
    }

    expect(snapshot.mode[17]).toBe(MODE_GATHERING);
    expect(snapshot.moving[17]).toBe(0);
    expect(snapshot.gatherTargetType[17]).toBe(TYPE_BERRY);
    expect(snapshot.actionCooldown[17]).toBe(7);
  });

  test("moving units face their heading and preserve it when stopped", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 100, 100, 0, 0);

    expect(world.facingX[0]).toBeCloseTo(-1 / Math.sqrt(2));
    expect(world.facingZ[0]).toBeCloseTo(-1 / Math.sqrt(2));

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [id],
      targetX: 120,
      targetZ: 100,
    });
    tickWorld(world);

    expect(world.facingX[0]).toBeCloseTo(1);
    expect(world.facingZ[0]).toBeCloseTo(0);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_STOP,
      unitIds: [id],
    });
    tickWorld(world);

    expect(world.facingX[0]).toBeCloseTo(1);
    expect(world.facingZ[0]).toBeCloseTo(0);
  });

  test("non-octant move orders produce continuous headings", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 100, 100, 0, 0);

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [id],
      targetX: 120,
      targetZ: 107,
    });
    tickWorld(world);

    expect(world.facingX[0]).toBeGreaterThan(0);
    expect(world.facingZ[0]).toBeGreaterThan(0);
    expect(world.facingX[0]).not.toBeCloseTo(world.facingZ[0]!);
    expect(
      world.facingX[0]! * world.facingX[0]! + world.facingZ[0]! * world.facingZ[0]!,
    ).toBeCloseTo(1);
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

  test("visibility becomes explored after a unit leaves", () => {
    const world = flatWorld(42);

    spawnUnit(world, 20.5, 20.5, 0, 0, 0);
    updateVisibility(world);

    const slot = world.playerSlotById[0]!;
    const tile = slot * MAP_TILES * MAP_TILES + 20 * MAP_TILES + 20;

    expect(world.visibility[tile]).toBe(VIS_VISIBLE);

    world.posX[0] = 100.5;
    world.posZ[0] = 100.5;
    updateVisibility(world);

    expect(world.visibility[tile]).toBe(VIS_EXPLORED);
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

describe("packed entity ids", () => {
  test("pack and unpack are inverses, and generation 0 equals the index", () => {
    expect(packId(0, 0)).toBe(0);
    // The property that made 1a a zero-behavior-change chunk.
    expect(packId(4321, 0)).toBe(4321);
    expect(idIndex(packId(4321, 7))).toBe(4321);
    expect(idGeneration(packId(4321, 7))).toBe(7);
    // Extremes survive the bit packing.
    expect(idIndex(packId(0xffff, 0xffff))).toBe(0xffff);
    expect(idGeneration(packId(0xffff, 0xffff))).toBe(0xffff);
  });

  test("resolveId accepts live ids and rejects stale or absurd ones", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 10, 10, 0, 0);

    expect(resolveId(world, id)).toBe(0);
    expect(unitIdAt(world, 0)).toBe(id);

    // Wrong generation: the slot was "reused" (death arrives next chunk; the
    // manual bump simulates exactly what it will do).
    world.generation[0] = 1;
    expect(resolveId(world, id)).toBe(-1);
    expect(resolveId(world, packId(0, 1))).toBe(0);

    // Index beyond the live count.
    expect(resolveId(world, packId(50, 0))).toBe(-1);
  });

  test("a stale-generation command is a silent deterministic no-op", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 10, 10, 0, 0);

    world.generation[0] = 3;

    // The old id must order nobody around...
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [id],
      targetX: 40,
      targetZ: 10,
    });

    for (let t = 0; t < 10; t += 1) {
      tickWorld(world);
    }

    expect(world.posX[0]).toBe(10);
    expect(world.moving[0]).toBe(0);

    // ...while the current-generation id works normally.
    enqueueCommand(world, {
      tick: world.tick + 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [unitIdAt(world, 0)],
      targetX: 40,
      targetZ: 10,
    });
    tickWorld(world);
    tickWorld(world);
    expect(world.moving[0]).toBe(1);
  });

  test("snapshots carry the packed id of every live slot", () => {
    const world = flatWorld(42);
    spawnUnits(world, 20);
    world.generation[3] = 9;

    const snapshot = createSnapshot(32);
    writeSnapshot(world, snapshot);

    expect(snapshot.ids[0]).toBe(unitIdAt(world, 0));
    expect(snapshot.ids[3]).toBe(packId(3, 9));
  });

  test("generation changes are visible to the state hash", () => {
    const world = flatWorld(42);
    spawnUnits(world, 10);

    const before = hashWorld(world);
    world.generation[2] = 1;

    // A client that disagrees about a slot's generation would accept/reject
    // different commands — the hash must see that.
    expect(hashWorld(world)).not.toBe(before);
  });

  test("facing changes are visible to the state hash", () => {
    const world = flatWorld(42);
    spawnUnits(world, 10);

    const before = hashWorld(world);
    world.facingX[2] = 0.125;

    expect(hashWorld(world)).not.toBe(before);
  });

  test("production queue changes are visible to the state hash", () => {
    const world = flatWorld(42);
    spawnUnits(world, 10);

    const before = hashWorld(world);
    world.trainQueueLength[0] = 2;

    expect(hashWorld(world)).not.toBe(before);
  });

  test("mixed production queue contents are visible to the state hash", () => {
    const world = flatWorld(42);
    spawnUnits(world, 10);
    world.trainQueueLength[0] = 2;
    world.trainQueueTypes[0] = TYPE_HOPLITE;
    world.trainQueueTypes[1] = TYPE_SPEARMAN;
    const before = hashWorld(world);

    world.trainQueueTypes[1] = TYPE_HOPLITE;

    expect(hashWorld(world)).not.toBe(before);
  });
});

describe("ownership", () => {
  test("commands only move units the issuer owns", () => {
    const world = flatWorld(42, [0, 1]);
    const mine = spawnUnit(world, 10, 10, 0, 0, 0);
    const theirs = spawnUnit(world, 30, 20, 0, 0, 1);

    // One command addressing BOTH armies: the sim must slice it to the
    // issuer's units — the forged half dies identically on every client.
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [mine, theirs],
      targetX: 60,
      targetZ: 60,
    });

    for (let t = 0; t < 10; t += 1) {
      tickWorld(world);
    }

    expect(world.moving[0]).toBe(1);
    expect(world.posX[1]).toBe(30);
    expect(world.posZ[1]).toBe(20);
    expect(world.moving[1]).toBe(0);
  });

  test("stop obeys the same validation", () => {
    const world = flatWorld(42, [0, 1]);
    const mine = spawnUnit(world, 10, 10, 0, 0, 0);
    const theirs = spawnUnit(world, 20, 20, 0, 0, 1);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [mine],
      targetX: 60,
      targetZ: 10,
    });
    enqueueCommand(world, {
      tick: 1,
      issuer: 1,
      type: COMMAND_MOVE,
      unitIds: [theirs],
      targetX: 60,
      targetZ: 20,
    });
    tickWorld(world);
    tickWorld(world);

    world.attackAimTarget[0] = theirs;
    world.attackAimShots[0] = 3;

    // Player 0 tries to halt player 1's unit: no-op; their own halt works.
    enqueueCommand(world, {
      tick: world.tick + 1,
      issuer: 0,
      type: COMMAND_STOP,
      unitIds: [theirs, mine],
    });
    tickWorld(world);
    tickWorld(world);

    expect(world.moving[0]).toBe(0);
    expect(world.moving[1]).toBe(1);
    expect(world.attackAimTarget[0]).toBe(NO_TARGET);
    expect(world.attackAimShots[0]).toBe(0);
  });

  test("corner spawns split armies deterministically by owner list", () => {
    const a = flatWorld(7);
    const b = flatWorld(7);

    spawnUnits(a, 100, [3, 8]);
    spawnUnits(b, 100, [3, 8]);

    expect(hashWorld(a)).toBe(hashWorld(b));

    // Owners are the ACTUAL ids from the roster (non-contiguous is normal).
    // As of M6-2 each owner also gets a pre-placed Town Center.
    let owner3Villagers = 0;
    let owner8Villagers = 0;
    let owner3TCs = 0;
    let owner8TCs = 0;

    for (let i = 0; i < a.count; i += 1) {
      if (a.unitType[i] === TYPE_TOWN_CENTER) {
        if (a.owner[i] === 3) owner3TCs += 1;
        if (a.owner[i] === 8) owner8TCs += 1;
        continue;
      }

      if (a.owner[i] === 3) owner3Villagers += 1;
      if (a.owner[i] === 8) owner8Villagers += 1;

      // Clusters sit in opposite corners: owner 3 near (40,40), owner 8 near
      // (216,216) — generous radius to absorb walkable resampling.
      const x = a.posX[i]!;
      const z = a.posZ[i]!;

      if (a.owner[i] === 3) {
        expect(Math.hypot(x - 40, z - 40)).toBeLessThan(60);
      } else {
        expect(Math.hypot(x - 216, z - 216)).toBeLessThan(60);
      }
    }

    expect(owner3Villagers).toBe(50);
    expect(owner8Villagers).toBe(50);
    expect(owner3TCs).toBe(1);
    expect(owner8TCs).toBe(1);
  });

  test("owner survives the death swap and reaches the snapshot", () => {
    const world = flatWorld(42, [0, 1, 2]);
    spawnUnit(world, 10, 10, 0, 0, 0);
    spawnUnit(world, 20, 20, 0, 0, 1);
    spawnUnit(world, 30, 30, 0, 0, 2);
    world.facingX[2] = 0.6;
    world.facingZ[2] = 0.8;
    world.attackAimTarget[2] = unitIdAt(world, 1);
    world.attackAimShots[2] = 3;

    killUnit(world, 0);
    tickWorld(world);

    // The last unit (owner 2) swapped into slot 0 with its owner intact —
    // the applyDeaths copy-list checklist in action.
    expect(world.owner[0]).toBe(2);
    expect(world.facingX[0]).toBe(0.6);
    expect(world.facingZ[0]).toBe(0.8);
    expect(world.attackAimTarget[0]).toBe(unitIdAt(world, 1));
    expect(world.attackAimShots[0]).toBe(3);

    const snapshot = createSnapshot(8);
    writeSnapshot(world, snapshot);
    expect(snapshot.owner[0]).toBe(2);
    expect(snapshot.facingX[0]).toBeCloseTo(0.6);
    expect(snapshot.facingZ[0]).toBeCloseTo(0.8);
    expect(snapshot.owner[1]).toBe(1);
  });
});

describe("death and swap-remove", () => {
  test("killing a unit compacts storage and the moved unit's id survives", () => {
    const world = flatWorld(42);
    spawnUnit(world, 10, 10, 0, 0);
    spawnUnit(world, 20, 20, 0, 0);
    const lastId = spawnUnit(world, 30, 30, 0, 0);

    killUnit(world, 0);
    tickWorld(world);

    expect(world.count).toBe(2);
    // The last unit was swapped into the freed slot 0 with its data intact...
    expect(world.posX[0]).toBe(30);
    // ...and its OLD packed id still resolves to its NEW dense index. This is
    // the property the handle indirection exists for.
    expect(resolveId(world, lastId)).toBe(0);

    // Commands addressed to the moved unit keep working across the swap.
    enqueueCommand(world, {
      tick: world.tick + 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [lastId],
      targetX: 60,
      targetZ: 30,
    });
    tickWorld(world);
    tickWorld(world);
    expect(world.moving[0]).toBe(1);
  });

  test("a dead unit's id is stale and commanding it is a no-op", () => {
    const world = flatWorld(42);
    const doomed = spawnUnit(world, 10, 10, 0, 0);
    spawnUnit(world, 20, 20, 0, 0);

    killUnit(world, 0);
    tickWorld(world);

    expect(resolveId(world, doomed)).toBe(-1);

    enqueueCommand(world, {
      tick: world.tick + 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [doomed],
      targetX: 90,
      targetZ: 90,
    });

    const before = hashWorld(world);
    tickWorld(world);
    tickWorld(world);

    // The survivor (now at slot 0) must not have been moved by the stale id.
    expect(world.moving[0]).toBe(0);
    expect(before).not.toBe(hashWorld(world)); // ticks advance the hash...
    expect(world.posX[0]).toBe(20); // ...but nobody walked anywhere.
  });

  test("a recycled handle carries a bumped generation", () => {
    const world = flatWorld(42);
    const oldId = spawnUnit(world, 10, 10, 0, 0);

    killUnit(world, 0);
    tickWorld(world);
    expect(world.count).toBe(0);

    const newId = spawnUnit(world, 50, 50, 0, 0);

    // Same handle slot, different generation: the old id names a ghost.
    expect(idIndex(newId)).toBe(idIndex(oldId));
    expect(idGeneration(newId)).toBe(idGeneration(oldId) + 1);
    expect(resolveId(world, oldId)).toBe(-1);
    expect(resolveId(world, newId)).toBe(0);
  });

  test("several deaths in one tick, including the last slot, leave survivors intact", () => {
    const world = flatWorld(42);
    const xs = [10, 20, 30, 40, 50];

    for (const x of xs) {
      spawnUnit(world, x, 5, 0, 0);
    }

    // Kill 0, 2, and 4 (the last slot) — descending removal must not trip over
    // its own swaps. Double-killing 2 must count once.
    killUnit(world, 0);
    killUnit(world, 2);
    killUnit(world, 2);
    killUnit(world, 4);
    tickWorld(world);

    expect(world.count).toBe(2);

    const survivors = [world.posX[0], world.posX[1]].sort((a, b) => a! - b!);

    expect(survivors).toEqual([20, 40]);
  });

  test("scripted deaths keep two worlds hash-identical every tick", () => {
    const build = (): World => {
      const world = flatWorld(7);
      spawnUnits(world, 100);
      return world;
    };
    const a = build();
    const b = build();

    for (let t = 0; t < 120; t += 1) {
      if (t === 10) {
        killUnit(a, 3);
        killUnit(b, 3);
        killUnit(a, 97);
        killUnit(b, 97);
      }

      if (t === 30) {
        // Command a unit that will die the same tick the command lands.
        const idA = unitIdAt(a, 50);
        const idB = unitIdAt(b, 50);

        enqueueCommand(a, {
          tick: t + 2,
          issuer: 0,
          type: COMMAND_MOVE,
          unitIds: [idA],
          targetX: 5,
          targetZ: 5,
        });
        enqueueCommand(b, {
          tick: t + 2,
          issuer: 0,
          type: COMMAND_MOVE,
          unitIds: [idB],
          targetX: 5,
          targetZ: 5,
        });
        killUnit(a, 50);
        killUnit(b, 50);
      }

      if (t === 60) {
        // Respawn after deaths: handle reuse order must agree everywhere.
        spawnUnit(a, 128, 128, 0, 0);
        spawnUnit(b, 128, 128, 0, 0);
      }

      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });

  test("snapshot ids expose the reorder so the renderer can snap", () => {
    const world = flatWorld(42);
    // spawnUnits also pre-places a Town Center (index 0), so 6 entities total.
    spawnUnits(world, 5);
    const prev = createSnapshot(8);
    const curr = createSnapshot(8);

    writeSnapshot(world, prev);
    killUnit(world, 1);
    tickWorld(world);
    writeSnapshot(world, curr);

    // Slot 1 now holds a different unit than it did last tick — exactly the
    // signal the renderer's interpolate-only-on-id-match guard keys on.
    expect(curr.count).toBe(5);
    expect(curr.ids[1]).not.toBe(prev.ids[1]);
    expect(curr.ids[0]).toBe(prev.ids[0]);
  });
});

describe("resources and nodes", () => {
  test("multiplayer deterministically regenerates terrain that cannot fit required mines", () => {
    const players = [
      { id: 0, majorGod: GOD_ZEUS },
      { id: 1, majorGod: GOD_ZEUS },
      { id: 2, majorGod: GOD_ZEUS },
    ] as const;
    // Seed 8 seals player 2's northeast start into a tiny walkable pocket. It
    // used to throw before a three-player match could finish loading.
    const a = createPlayableWorld(8, 9, players);
    const b = createPlayableWorld(8, 9, players);
    let goldMines = 0;

    for (let i = 0; i < a.count; i += 1) {
      if (a.unitType[i] === TYPE_GOLD_MINE) goldMines += 1;
    }

    expect(goldMines).toBe(9);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  test("node placement is seeded, with mirrored forests and map-profiled gold", () => {
    const a = createWorld(1337);
    const b = createWorld(1337);

    spawnUnits(a, 10, [0, 1]);
    spawnUnits(b, 10, [0, 1]);
    spawnResourceNodes(a);
    spawnResourceNodes(b);

    expect(hashWorld(a)).toBe(hashWorld(b));

    let trees = 0;
    let berries = 0;
    const goldMines: number[] = [];

    for (let i = 0; i < a.count; i += 1) {
      if (a.unitType[i] === TYPE_TREE) {
        trees += 1;
        expect(a.owner[i]).toBe(NEUTRAL_OWNER);

        // Point-symmetric fairness: every tree has a mirror tree. Verify by
        // checking a sampled tree's reflection exists within float tolerance.
        if (trees === 1) {
          const mx = 256 - a.posX[i]!;
          const mz = 256 - a.posZ[i]!;
          let found = false;

          for (let j = 0; j < a.count; j += 1) {
            if (
              a.unitType[j] === TYPE_TREE &&
              Math.abs(a.posX[j]! - mx) < 0.001 &&
              Math.abs(a.posZ[j]! - mz) < 0.001
            ) {
              found = true;
              break;
            }
          }

          expect(found).toBe(true);
        }
      }

      if (a.unitType[i] === TYPE_BERRY) {
        berries += 1;
      }

      if (a.unitType[i] === TYPE_GOLD_MINE) {
        goldMines.push(i);
        expect(a.owner[i]).toBe(NEUTRAL_OWNER);
        expect(a.hp[i]).toBe(3000);
      }
    }

    expect(trees).toBeGreaterThan(50);
    // Placement may SKIP nodes whose spot is rocky or unreachable (sealed
    // walkable pockets exist in this terrain) — an exact count would pin the
    // map, not the rule. Most of both patches must survive placement.
    expect(berries).toBeGreaterThanOrEqual(8);
    expect(berries).toBeLessThanOrEqual(10);

    // This map profile gives both players one starting, medium, and far mine.
    expect(goldMines).toHaveLength(6);
    const starts = [
      [40, 40],
      [216, 216],
    ] as const;
    const bands = [
      [22, 32],
      [50, 75],
      [90, 115],
    ] as const;

    for (const [startX, startZ] of starts) {
      for (const [minDistance, maxDistance] of bands) {
        expect(
          goldMines.some((i) => {
            const dx = a.posX[i]! - startX;
            const dz = a.posZ[i]! - startZ;
            const distance = Math.sqrt(dx * dx + dz * dz);
            return distance >= minDistance && distance <= maxDistance;
          }),
        ).toBe(true);
      }
    }

    const goldMineSpacing = [6, 10, 12] as const;

    for (let mineIndex = 0; mineIndex < goldMines.length; mineIndex += 1) {
      const mine = goldMines[mineIndex]!;
      const placementIndex = Math.floor(mineIndex / starts.length);

      for (let earlierIndex = 0; earlierIndex < mineIndex; earlierIndex += 1) {
        const earlierMine = goldMines[earlierIndex]!;
        const dx = a.posX[mine]! - a.posX[earlierMine]!;
        const dz = a.posZ[mine]! - a.posZ[earlierMine]!;

        expect(Math.sqrt(dx * dx + dz * dz)).toBeGreaterThanOrEqual(
          goldMineSpacing[placementIndex]!,
        );
      }

      for (let node = 0; node < a.count; node += 1) {
        if (a.unitType[node] !== TYPE_TREE && a.unitType[node] !== TYPE_BERRY) continue;

        const dx = a.posX[mine]! - a.posX[node]!;
        const dz = a.posZ[mine]! - a.posZ[node]!;

        expect(Math.sqrt(dx * dx + dz * dz)).toBeGreaterThanOrEqual(2);
      }
    }

    // Seeded randomness is reproducible without forcing point symmetry.
    expect(
      goldMines.some((i) => {
        const mirrorX = SIM_MAP_SIZE - a.posX[i]!;
        const mirrorZ = SIM_MAP_SIZE - a.posZ[i]!;
        return !goldMines.some(
          (j) => Math.abs(a.posX[j]! - mirrorX) < 0.001 && Math.abs(a.posZ[j]! - mirrorZ) < 0.001,
        );
      }),
    ).toBe(true);
  });

  test("armies ignore neutral nodes and nodes never fight or move", () => {
    const world = flatWorld(42);
    // A soldier parked right next to a tree, inside what would be aggro range.
    spawnUnit(world, 100, 100, 0, 0, 0);
    const treeId = spawnUnit(world, 101, 100, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
    world.contested = true;

    for (let t = 0; t < 100; t += 1) {
      tickWorld(world);
    }

    // No auto-acquire against neutrals; the tree took no damage and never moved.
    expect(world.attackTarget[0]).toBe(NO_TARGET);
    expect(world.hp[1]).toBe(UNIT_TYPES[TYPE_TREE]!.maxHp);
    expect(world.posX[1]).toBe(101);

    // An explicit attack order on a node is a silent no-op (Gather is the verb).
    enqueueCommand(world, {
      tick: world.tick + 1,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [unitIdAt(world, 0)],
      targetId: treeId,
    });
    tickWorld(world);
    tickWorld(world);
    expect(world.attackTarget[0]).toBe(NO_TARGET);
  });

  test("statics are separation sources but never get pushed", () => {
    const world = flatWorld(42);
    spawnUnit(world, 100, 100, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
    // A unit ordered to walk THROUGH the tree must flow around it.
    const walker = spawnUnit(world, 96, 100, 0, 0, 0);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [walker],
      targetX: 104,
      targetZ: 100,
    });

    for (let t = 0; t < 120; t += 1) {
      tickWorld(world);
    }

    // The tree held its ground exactly; the walker arrived anyway.
    expect(world.posX[0]).toBe(100);
    expect(world.posZ[0]).toBe(100);
    expect(Math.hypot(world.posX[1]! - 104, world.posZ[1]! - 100)).toBeLessThan(1.5);
  });

  test("a forest cannot deny victory or force a draw", () => {
    const world = flatWorld(42, [0, 1]);
    spawnUnit(world, 100, 100, 0, 0, 0);
    spawnUnit(world, 100.5, 100, 0, 0, 1);
    spawnUnit(world, 200, 200, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
    world.contested = true;

    for (let t = 0; t < 400 && world.winner === -1; t += 1) {
      tickWorld(world);
    }

    // One army annihilated the other; the surviving TREE must not have kept
    // the match "ongoing" (or turned a decisive win into anything else).
    expect(world.winner).toBe(world.owner[0]!);
  });

  test("stockpiles start seeded per owner and live in the hash", () => {
    const world = flatWorld(42);
    spawnUnits(world, 10, [3, 8]);

    expect(world.stockpiles[3 * RESOURCE_COUNT + FOOD]).toBe(100);
    expect(world.stockpiles[8 * RESOURCE_COUNT + WOOD]).toBe(100);
    expect(world.stockpiles[3 * RESOURCE_COUNT + GOLD]).toBe(0);
    expect(world.stockpiles[8 * RESOURCE_COUNT + FAVOR]).toBe(0);

    const before = hashWorld(world);
    world.stockpiles[3 * RESOURCE_COUNT + GOLD] = world.stockpiles[3 * RESOURCE_COUNT + GOLD]! + 1;
    expect(hashWorld(world)).not.toBe(before);
  });
});

describe("buildings and walkability", () => {
  const tcStats = UNIT_TYPES[TYPE_TOWN_CENTER]!;

  test("spawned buildings stamp their footprint and death restores it", () => {
    const world = flatWorld(42);
    const id = spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER);

    // All 16 footprint tiles unwalkable; the tile just outside is untouched.
    for (let z = 100; z < 104; z += 1) {
      for (let x = 100; x < 104; x += 1) {
        expect(world.walkable[z * MAP_TILES + x]).toBe(0);
      }
    }

    expect(world.walkable[100 * MAP_TILES + 99]).toBe(1);
    expect(world.posX[0]).toBe(102);

    killUnit(world, 0);
    tickWorld(world);

    // Rubble does not obstruct: every tile walkable again, id stale.
    for (let z = 100; z < 104; z += 1) {
      for (let x = 100; x < 104; x += 1) {
        expect(world.walkable[z * MAP_TILES + x]).toBe(1);
      }
    }

    expect(resolveId(world, id)).toBe(-1);
  });

  test("canPlaceBuilding rejects overlap, mountains, and map edges", () => {
    const world = flatWorld(42);
    spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER);

    expect(canPlaceBuilding(world, 100, 100, TYPE_HOUSE)).toBe(false); // overlap
    expect(canPlaceBuilding(world, 103, 103, TYPE_HOUSE)).toBe(false); // corner overlap
    expect(canPlaceBuilding(world, 104, 104, TYPE_HOUSE)).toBe(true); // adjacent is fine
    expect(canPlaceBuilding(world, 255, 255, TYPE_HOUSE)).toBe(false); // off the map edge

    world.walkable[50 * MAP_TILES + 50] = 0; // a mountain tile
    expect(canPlaceBuilding(world, 49, 49, TYPE_HOUSE)).toBe(false);
  });

  test("units route around a building instead of walking through it", () => {
    const world = flatWorld(42);
    spawnBuilding(world, 126, 126, 0, TYPE_TOWN_CENTER);
    const walker = spawnUnit(world, 120, 128, 0, 0, 0);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [walker],
      targetX: 136,
      targetZ: 128,
    });

    for (let t = 0; t < 300; t += 1) {
      tickWorld(world);

      // At no tick may the walker stand inside the footprint.
      const tx = Math.floor(world.posX[1]!);
      const tz = Math.floor(world.posZ[1]!);
      const inFootprint = tx >= 126 && tx < 130 && tz >= 126 && tz < 130;

      expect(inFootprint).toBe(false);
    }

    expect(Math.hypot(world.posX[1]! - 136, world.posZ[1]! - 128)).toBeLessThan(2);
  });

  test("melee reaches a building's surface despite its footprint", () => {
    const world = flatWorld(42, [0, 1]);
    // Enemy TC and a soldier ordered to raze it: without the body-radius fix
    // the soldier stops at the unwalkable footprint edge, outside its 1.2
    // reach of the CENTER, and orbits forever.
    const tc = spawnBuilding(world, 100, 100, 1, TYPE_TOWN_CENTER);
    const soldier = spawnUnit(world, 93, 102, 0, 0, 0);
    world.contested = true;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [soldier],
      targetId: tc,
    });

    for (let t = 0; t < 200; t += 1) {
      tickWorld(world);
    }

    expect(world.hp[0]!).toBeLessThan(tcStats.maxHp);
  });

  test("building death mid-run keeps two worlds hash-identical", () => {
    const build = (): World => {
      const world = flatWorld(7);
      spawnUnits(world, 50, [0, 1]);
      return world;
    };
    const a = build();
    const b = build();

    for (let t = 0; t < 200; t += 1) {
      if (t === 40) {
        // Demolish owner 0's TC on both worlds (index 0 — spawned first).
        killUnit(a, 0);
        killUnit(b, 0);
      }

      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});

describe("gathering", () => {
  // A world with one TC (dropsite), one villager, and one tree, all close
  // enough that round trips complete in tens of ticks.
  function gatherWorld(): { world: World; villager: number; tree: number } {
    const world = flatWorld(42);
    spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER);
    const villager = spawnUnit(world, 106, 102, 0, 0, 0);
    const tree = spawnUnit(world, 112, 102, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
    return { world, villager, tree };
  }

  test("the full loop: chop, haul, deposit, return", () => {
    const { world, villager, tree } = gatherWorld();
    const woodBefore = world.stockpiles[WOOD]!;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [villager],
      targetId: tree,
    });

    // One full carry (10 wood at 1 per 10 ticks) plus two short walks: give
    // it 400 ticks and require at least one deposit to have landed.
    for (let t = 0; t < 400; t += 1) {
      tickWorld(world);
    }

    const wood = world.stockpiles[WOOD]!;

    expect(wood).toBeGreaterThan(woodBefore);
    // The tree paid for it.
    expect(world.hp[2]!).toBeLessThan(UNIT_TYPES[TYPE_TREE]!.maxHp);
    // And the villager went BACK to work after depositing.
    expect(world.mode[1]).not.toBe(0);
  });

  test("a loaded villager routes around mountains to reach a dropsite", () => {
    const world = flatWorld(42);
    spawnBuilding(world, 106, 98, 0, TYPE_TOWN_CENTER);
    const villager = spawnUnit(world, 98.5, 100.5, 0, 0, 0);
    const villagerIndex = resolveId(world, villager);
    const woodBefore = world.stockpiles[WOOD]!;

    // A solid mountain wall blocks the direct line to the Town Center, but
    // leaves open ground around both ends.
    for (let z = 96; z <= 104; z += 1) {
      for (let x = 101; x <= 104; x += 1) {
        world.walkable[z * MAP_TILES + x] = 0;
      }
    }

    // Start at the exact economy transition that failed in play: the worker
    // has a full load and chooses a dropsite on the next tick.
    world.carried[villagerIndex] = CARRY_CAPACITY;
    world.carriedResource[villagerIndex] = WOOD;
    world.mode[villagerIndex] = MODE_GATHERING;

    for (let t = 0; t < 600; t += 1) {
      tickWorld(world);

      const tileX = Math.floor(world.posX[villagerIndex]!);
      const tileZ = Math.floor(world.posZ[villagerIndex]!);
      expect(world.walkable[tileZ * MAP_TILES + tileX]).toBe(1);
    }

    expect(world.stockpiles[WOOD]).toBe(woodBefore + CARRY_CAPACITY);
    expect(world.carried[villagerIndex]).toBe(0);
  });

  test("gold mines use the existing gather, haul, and deposit loop", () => {
    const world = flatWorld(42);
    spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER);
    const villager = spawnUnit(world, 106, 102, 0, 0, 0);
    const mine = spawnUnit(world, 112, 102, 0, 0, NEUTRAL_OWNER, TYPE_GOLD_MINE);
    const goldBefore = world.stockpiles[GOLD]!;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [villager],
      targetId: mine,
    });

    for (let t = 0; t < 400; t += 1) {
      tickWorld(world);
    }

    expect(world.stockpiles[GOLD]!).toBeGreaterThan(goldBefore);
    expect(world.hp[2]!).toBeLessThan(UNIT_TYPES[TYPE_GOLD_MINE]!.maxHp);
    expect(world.mode[1]).not.toBe(MODE_IDLE);
  });

  test("a depleted node hands the villager to a neighbor", () => {
    const { world, villager } = gatherWorld();
    // Drain the first tree to nearly empty so it depletes mid-session, with
    // a second tree just inside the retarget radius.
    world.hp[2] = 3;
    const neighbor = spawnUnit(world, 114, 104, 0, 0, NEUTRAL_OWNER, TYPE_TREE);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [villager],
      targetId: unitIdAt(world, 2),
    });

    for (let t = 0; t < 300; t += 1) {
      tickWorld(world);
    }

    // First tree gone; the neighbor is being chopped now.
    expect(world.count).toBe(3);
    expect(resolveId(world, neighbor)).toBeGreaterThanOrEqual(0);
    expect(world.hp[resolveId(world, neighbor)]!).toBeLessThan(UNIT_TYPES[TYPE_TREE]!.maxHp);
  });

  test("militia in a mixed selection are silently skipped", () => {
    const { world, tree } = gatherWorld();
    const militia = spawnUnit(world, 104, 104, 0, 0, 0, TYPE_MILITIA);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [militia],
      targetId: tree,
    });

    for (let t = 0; t < 50; t += 1) {
      tickWorld(world);
    }

    expect(world.mode[3]).toBe(0);
    expect(world.hp[2]).toBe(UNIT_TYPES[TYPE_TREE]!.maxHp);
  });

  test("a move order interrupts gathering but the load survives", () => {
    const { world, villager, tree } = gatherWorld();

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [villager],
      targetId: tree,
    });

    // Chop for a while, then yank the villager away mid-carry.
    for (let t = 0; t < 120; t += 1) {
      tickWorld(world);
    }

    const carriedMid = world.carried[1]!;

    enqueueCommand(world, {
      tick: world.tick + 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [villager],
      targetX: 90,
      targetZ: 90,
    });
    tickWorld(world);
    tickWorld(world);

    expect(world.mode[1]).toBe(0);
    // One more strike may legally land between our sample and the order
    // taking effect; the property is that the load SURVIVES, not its exact size.
    expect(world.carried[1]!).toBeGreaterThanOrEqual(carriedMid);
    expect(world.carried[1]!).toBeGreaterThan(0);
  });

  test("a mob on one bush strip-mines the whole patch on real terrain", () => {
    // Regression for the mob-gather bug cluster (found by playtest): nodes on
    // rock, nodes in sealed walkable pockets, straight-line chases stalling on
    // mountains, and returners retargeting from the dropsite instead of the
    // patch. The assertion is the end state: the patch gets FULLY consumed.
    const world = createWorld(1337);

    spawnUnits(world, 60, [0, 1]);
    spawnResourceNodes(world);

    const villagers: number[] = [];
    let firstBush = -1;
    let patchStock = 0;

    for (let i = 0; i < world.count; i += 1) {
      if (world.unitType[i] === TYPE_BERRY && world.posX[i]! < 128) {
        if (firstBush < 0) firstBush = i;
        patchStock += world.hp[i]!;
      }

      if (world.unitType[i] === TYPE_VILLAGER && world.owner[i] === 0) {
        villagers.push(unitIdAt(world, i));
      }
    }

    const foodBefore = world.stockpiles[FOOD]!;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: villagers,
      targetId: unitIdAt(world, firstBush),
    });

    for (let t = 0; t < 2500; t += 1) {
      tickWorld(world);
    }

    // Every reachable berry in the patch ends up in the stockpile.
    expect(world.stockpiles[FOOD]! - foodBefore).toBe(patchStock);

    let bushesLeft = 0;

    for (let i = 0; i < world.count; i += 1) {
      if (world.unitType[i] === TYPE_BERRY && world.posX[i]! < 128) bushesLeft += 1;
    }

    expect(bushesLeft).toBe(0);
  });

  test("two gathering worlds stay hash-identical", () => {
    const build = (): World => {
      const world = flatWorld(7);
      spawnUnits(world, 20, [0, 1]);
      spawnResourceNodes(world);
      return world;
    };
    const a = build();
    const b = build();

    // Both players set villagers gathering the nearest trees on both worlds.
    const orderGather = (world: World): void => {
      for (const issuer of [0, 1]) {
        let firstVillager = -1;
        let nearestTree = -1;
        let best = Infinity;

        for (let i = 0; i < world.count; i += 1) {
          if (
            world.owner[i] === issuer &&
            world.unitType[i] === TYPE_VILLAGER &&
            firstVillager < 0
          ) {
            firstVillager = i;
          }
        }

        for (let i = 0; i < world.count; i += 1) {
          if (world.unitType[i] === TYPE_TREE && firstVillager >= 0) {
            const d = Math.hypot(
              world.posX[i]! - world.posX[firstVillager]!,
              world.posZ[i]! - world.posZ[firstVillager]!,
            );

            if (d < best) {
              best = d;
              nearestTree = i;
            }
          }
        }

        if (firstVillager >= 0 && nearestTree >= 0) {
          enqueueCommand(world, {
            tick: 2,
            issuer,
            type: COMMAND_GATHER,
            unitIds: [unitIdAt(world, firstVillager)],
            targetId: unitIdAt(world, nearestTree),
          });
        }
      }
    };

    orderGather(a);
    orderGather(b);

    // Forests spawn >= 45 units from the corners (the fairness rule), so a
    // single round trip is ~700 ticks of mostly walking. Give it two.
    for (let t = 0; t < 1600; t += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }

    // The economy actually ran: deposits beyond the 200 starting wood.
    expect(a.stockpiles[WOOD]! + a.stockpiles[RESOURCE_COUNT + WOOD]!).toBeGreaterThan(200);
  });
});

describe("building placement", () => {
  test("a valid Place deducts costs and spawns a blueprint", () => {
    const world = flatWorld(42);
    spawnUnits(world, 5, [0]);
    const woodBefore = world.stockpiles[WOOD]!;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_HOUSE,
      tileX: 45,
      tileZ: 45,
    });

    for (let t = 0; t < 2; t += 1) {
      tickWorld(world);
    }

    const house = world.count - 1;

    expect(world.stockpiles[WOOD]).toBe(woodBefore - UNIT_TYPES[TYPE_HOUSE]!.costWood);
    expect(world.unitType[house]).toBe(TYPE_HOUSE);
    // A blueprint: present, owned, footprint stamped — but zero progress.
    expect(world.owner[house]).toBe(0);
    expect(world.buildProgress[house]).toBe(0);
    expect(world.walkable[45 * MAP_TILES + 45]).toBe(0);
  });

  test("blocked or unaffordable placements are silent no-ops with no deduction", () => {
    const world = flatWorld(42);
    spawnUnits(world, 5, [0]);
    const countBefore = world.count;
    const foodBefore = world.stockpiles[FOOD]!;
    const woodBefore = world.stockpiles[WOOD]!;

    // Blocked: overlaps the pre-placed town center footprint at the spawn corner.
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_HOUSE,
      tileX: 38,
      tileZ: 38,
    });
    // Unaffordable: barracks costs 120 wood, the starting stockpile is 100.
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_BARRACKS,
      tileX: 45,
      tileZ: 45,
    });

    for (let t = 0; t < 2; t += 1) {
      tickWorld(world);
    }

    expect(world.count).toBe(countBefore);
    expect(world.stockpiles[FOOD]).toBe(foodBefore);
    expect(world.stockpiles[WOOD]).toBe(woodBefore);
    expect(world.walkable[45 * MAP_TILES + 45]).toBe(1);
  });

  test("a blueprint town center rejects deposits until construction completes", () => {
    const world = flatWorld(7);
    const blueprint = spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER, false);
    const villager = spawnUnit(world, 110, 102, 0, 0, 0);
    const tree = spawnUnit(world, 112, 102, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
    const villagerIndex = resolveId(world, villager);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [villager],
      targetId: tree,
    });

    // Long enough to fill the carry (10 strikes at a 10-tick cooldown) and try to bank it.
    for (let t = 0; t < 300; t += 1) {
      tickWorld(world);
    }

    // Full load, nothing banked: the blueprint failed the completeness gate and the
    // villager clocked out to idle, keeping the carry.
    expect(world.carried[villagerIndex]).toBe(CARRY_CAPACITY);
    expect(world.stockpiles[WOOD]).toBe(0);

    // Finish construction by hand (M6-5 gives villagers the Build verb), re-command the
    // gather — the full carry goes straight to RETURNING and banks through the open gate.
    world.buildProgress[resolveId(world, blueprint)] = UNIT_TYPES[TYPE_TOWN_CENTER]!.buildTicks;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_GATHER,
      unitIds: [villager],
      targetId: tree,
    });

    for (let t = 0; t < 300; t += 1) {
      tickWorld(world);
    }

    expect(world.stockpiles[WOOD]!).toBeGreaterThanOrEqual(CARRY_CAPACITY);
  });

  test("a commanded villager raises a blueprint to completion and clocks out", () => {
    const world = flatWorld(42);
    const site = spawnBuilding(world, 100, 100, 0, TYPE_HOUSE, false);
    const villager = spawnUnit(world, 110, 102, 0, 0, 0);
    const villagerIndex = resolveId(world, villager);
    const siteIndex = resolveId(world, site);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_BUILD,
      unitIds: [villager],
      targetId: site,
    });

    for (let t = 0; t < 400; t += 1) {
      tickWorld(world);
    }

    expect(world.buildProgress[siteIndex]).toBe(UNIT_TYPES[TYPE_HOUSE]!.buildTicks);
    // The finished site releases its builder.
    expect(world.mode[villagerIndex]).toBe(MODE_IDLE);
    expect(world.moving[villagerIndex]).toBe(0);
  });

  test("three builders finish strictly faster than one", () => {
    const completionTick = (builderCount: number): number => {
      const world = flatWorld(42);
      const site = spawnBuilding(world, 100, 100, 0, TYPE_HOUSE, false);
      const siteIndex = resolveId(world, site);
      const builders: number[] = [];

      for (let i = 0; i < builderCount; i += 1) {
        builders.push(spawnUnit(world, 106, 100 + i * 2, 0, 0, 0));
      }

      enqueueCommand(world, {
        tick: 1,
        issuer: 0,
        type: COMMAND_BUILD,
        unitIds: builders,
        targetId: site,
      });

      for (let t = 0; t < 1000; t += 1) {
        tickWorld(world);
        if (world.buildProgress[siteIndex]! >= UNIT_TYPES[TYPE_HOUSE]!.buildTicks) {
          return world.tick;
        }
      }

      throw new Error("site never completed");
    };

    expect(completionTick(3)).toBeLessThan(completionTick(1));
  });

  test("enemy or already-complete targets are no-ops; militia are silently skipped", () => {
    const world = flatWorld(42, [0, 1]);
    const enemySite = spawnBuilding(world, 100, 100, 1, TYPE_HOUSE, false);
    const doneSite = spawnBuilding(world, 120, 120, 0, TYPE_HOUSE, true);
    const ownSite = spawnBuilding(world, 140, 140, 0, TYPE_HOUSE, false);
    const villager = spawnUnit(world, 144, 141, 0, 0, 0);
    const militia = spawnUnit(world, 146, 141, 0, 0, 0, TYPE_MILITIA);
    const villagerIndex = resolveId(world, villager);
    const militiaIndex = resolveId(world, militia);

    // Helping the enemy raise their house is not a thing.
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_BUILD,
      unitIds: [villager],
      targetId: enemySite,
    });
    // Neither is hammering a finished building.
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_BUILD,
      unitIds: [villager],
      targetId: doneSite,
    });

    for (let t = 0; t < 50; t += 1) {
      tickWorld(world);
    }

    expect(world.buildProgress[resolveId(world, enemySite)]).toBe(0);
    expect(world.mode[villagerIndex]).toBe(MODE_IDLE);

    // A mixed selection on a legal site: the villager engages, the militia ignores it.
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_BUILD,
      unitIds: [villager, militia],
      targetId: ownSite,
    });
    tickWorld(world);

    expect(world.mode[villagerIndex]).toBe(MODE_BUILDING);
    expect(world.mode[militiaIndex]).toBe(MODE_IDLE);
  });

  test("a site destroyed mid-build releases its builders", () => {
    const world = flatWorld(42);
    const site = spawnBuilding(world, 100, 100, 0, TYPE_HOUSE, false);
    const villager = spawnUnit(world, 104, 101, 0, 0, 0);
    const villagerIndex = resolveId(world, villager);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_BUILD,
      unitIds: [villager],
      targetId: site,
    });

    for (let t = 0; t < 30; t += 1) {
      tickWorld(world);
    }
    expect(world.mode[villagerIndex]).toBe(MODE_BUILDING);

    killUnit(world, resolveId(world, site));
    for (let t = 0; t < 3; t += 1) {
      tickWorld(world);
    }

    expect(world.mode[villagerIndex]).toBe(MODE_IDLE);
    expect(world.moving[villagerIndex]).toBe(0);
  });

  test("worlds running the same Place commands stay hash-identical", () => {
    const build = (): World => {
      const world = flatWorld(7);
      spawnUnits(world, 10, [0, 1]);
      enqueueCommand(world, {
        tick: 2,
        issuer: 0,
        type: COMMAND_PLACE,
        buildingType: TYPE_HOUSE,
        tileX: 45,
        tileZ: 45,
      });
      enqueueCommand(world, {
        tick: 2,
        issuer: 1,
        type: COMMAND_PLACE,
        buildingType: TYPE_HOUSE,
        tileX: 209,
        tileZ: 209,
      });
      return world;
    };
    const a = build();
    const b = build();

    for (let t = 0; t < 60; t += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});

describe("production", () => {
  test("culture-specific starts spawn distinct worker and Town Center identities", () => {
    const world = createWorld(42);
    world.walkable.fill(1);
    registerPlayer(world, 0, GOD_ZEUS);
    registerPlayer(world, 1, GOD_RA);

    spawnUnits(world, 2, [0, 1]);

    const greekTypes: number[] = [];
    const egyptianTypes: number[] = [];
    for (let index = 0; index < world.count; index += 1) {
      (world.owner[index] === 0 ? greekTypes : egyptianTypes).push(world.unitType[index]!);
    }

    expect(greekTypes).toContain(TYPE_TOWN_CENTER);
    expect(greekTypes).toContain(TYPE_VILLAGER);
    expect(egyptianTypes).toContain(TYPE_EGYPTIAN_TOWN_CENTER);
    expect(egyptianTypes).toContain(TYPE_EGYPTIAN_LABORER);
  });

  test("culture-scoped starting units can add the Greek Minotaur without leaking to Egypt", () => {
    const world = createWorld(42);
    world.walkable.fill(1);
    registerPlayer(world, 0, GOD_ZEUS);
    registerPlayer(world, 1, GOD_RA);

    spawnUnits(world, 2, [0, 1], {
      [CULTURE_GREEK]: [TYPE_MINOTAUR],
    });

    const greekMinotaurs: number[] = [];
    const egyptianMinotaurs: number[] = [];
    for (let index = 0; index < world.count; index += 1) {
      const type = world.unitType[index]!;
      if (type !== TYPE_MINOTAUR) continue;
      (world.owner[index] === 0 ? greekMinotaurs : egyptianMinotaurs).push(type);
    }

    expect(greekMinotaurs).toEqual([TYPE_MINOTAUR]);
    expect(egyptianMinotaurs).toEqual([]);
  });

  test("a town center trains a villager that spawns adjacent on walkable ground", () => {
    const world = flatWorld(42);
    const tc = spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER, true);
    const tcIndex = resolveId(world, tc);
    world.stockpiles[FOOD] = 200;
    const countBefore = world.count;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: tc,
      unitType: TYPE_VILLAGER,
    });

    for (let t = 0; t < 50; t += 1) {
      tickWorld(world);
    }

    // Mid-countdown: cost is already banked against the promise, no unit yet.
    expect(world.stockpiles[FOOD]).toBe(200 - UNIT_TYPES[TYPE_VILLAGER]!.costFood);
    expect(world.trainRemaining[tcIndex]!).toBeGreaterThan(0);
    expect(world.count).toBe(countBefore);

    for (let t = 0; t < 100; t += 1) {
      tickWorld(world);
    }

    expect(world.count).toBe(countBefore + 1);
    const unit = world.count - 1;
    expect(world.unitType[unit]).toBe(TYPE_VILLAGER);
    expect(world.owner[unit]).toBe(0);
    // At the TC's front exit and standing on open ground, never inside the visible model.
    const dx = world.posX[unit]! - world.posX[tcIndex]!;
    const dz = world.posZ[unit]! - world.posZ[tcIndex]!;
    expect(Math.abs(dx)).toBeLessThanOrEqual(0.5);
    expect(dz).toBeLessThanOrEqual(-UNIT_TYPES[TYPE_TOWN_CENTER]!.trainExitOffset + 0.5);
    expect(
      world.walkable[Math.floor(world.posZ[unit]!) * MAP_TILES + Math.floor(world.posX[unit]!)],
    ).toBe(1);
  });

  test("orders queue and train sequentially", () => {
    const world = flatWorld(42);
    const tc = spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER, true);
    const tcIndex = resolveId(world, tc);
    world.stockpiles[FOOD] = 1000;
    const countBefore = world.count;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: tc,
      unitType: TYPE_VILLAGER,
    });
    enqueueCommand(world, {
      tick: 2,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: tc,
      unitType: TYPE_VILLAGER,
    });

    for (let t = 0; t < 20; t += 1) {
      tickWorld(world);
    }

    expect(world.stockpiles[FOOD]).toBe(1000 - 2 * UNIT_TYPES[TYPE_VILLAGER]!.costFood);
    expect(world.trainQueueLength[tcIndex]).toBe(2);
    expect(world.count).toBe(countBefore);

    for (let t = 0; t < 100; t += 1) {
      tickWorld(world);
    }

    expect(world.count).toBe(countBefore + 1);
    expect(world.trainQueueLength[tcIndex]).toBe(1);
    expect(world.trainRemaining[tcIndex]).toBeGreaterThan(0);

    for (let t = 0; t < 100; t += 1) {
      tickWorld(world);
    }

    expect(world.count).toBe(countBefore + 2);
    expect(world.trainQueueLength[tcIndex]).toBe(0);
    expect(world.trainRemaining[tcIndex]).toBe(0);
  });

  test("a building queue holds at most fifteen units", () => {
    const world = flatWorld(42);
    const tc = spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER, true);
    spawnBuilding(world, 120, 120, 0, TYPE_TOWN_CENTER, true);
    const tcIndex = resolveId(world, tc);
    world.stockpiles[FOOD] = 1000;

    for (let i = 0; i < MAX_TRAIN_QUEUE + 1; i += 1) {
      enqueueCommand(world, {
        tick: 1,
        issuer: 0,
        type: COMMAND_TRAIN,
        buildingId: tc,
        unitType: TYPE_VILLAGER,
      });
    }

    tickWorld(world);
    tickWorld(world);

    expect(world.trainQueueLength[tcIndex]).toBe(MAX_TRAIN_QUEUE);
    expect(world.stockpiles[FOOD]).toBe(
      1000 - MAX_TRAIN_QUEUE * UNIT_TYPES[TYPE_VILLAGER]!.costFood,
    );
  });

  test("the pop cap counts queued production as promised units", () => {
    const world = flatWorld(42);
    // Two complete TCs: cap 30. 29 villagers: one promise fits, two would overshoot.
    const tcA = spawnBuilding(world, 100, 100, 0, TYPE_TOWN_CENTER, true);
    const tcB = spawnBuilding(world, 120, 120, 0, TYPE_TOWN_CENTER, true);

    for (let i = 0; i < 29; i += 1) {
      spawnUnit(world, 60 + (i % 6) * 2, 60 + Math.floor(i / 6) * 2, 0, 0, 0);
    }

    world.stockpiles[FOOD] = 1000;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: tcA,
      unitType: TYPE_VILLAGER,
    });
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: tcB,
      unitType: TYPE_VILLAGER,
    });

    for (let t = 0; t < 3; t += 1) {
      tickWorld(world);
    }

    // 29 standing + 1 promise = 30 = cap; the second TC's order must be refused
    // even though ITS slot is free — otherwise both complete and pop lands at 31.
    expect(world.stockpiles[FOOD]).toBe(1000 - UNIT_TYPES[TYPE_VILLAGER]!.costFood);
    expect(world.trainRemaining[resolveId(world, tcB)]).toBe(0);
  });

  test("wrong producers and blueprints are silent no-ops; Academy trains a Hoplite", () => {
    const world = flatWorld(42);
    const barracks = spawnBuilding(world, 100, 100, 0, TYPE_BARRACKS, true);
    const house = spawnBuilding(world, 120, 120, 0, TYPE_HOUSE, true);
    const blueprintTc = spawnBuilding(world, 140, 140, 0, TYPE_TOWN_CENTER, false);
    world.stockpiles[FOOD] = 500;
    world.stockpiles[WOOD] = 500;
    world.stockpiles[GOLD] = 500;
    world.playerAge[0] = AGE_CLASSICAL;
    const countBefore = world.count;

    // Barracks don't make villagers, houses make nothing, blueprints make nothing.
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: barracks,
      unitType: TYPE_VILLAGER,
    });
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: house,
      unitType: TYPE_MILITIA,
    });
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: blueprintTc,
      unitType: TYPE_VILLAGER,
    });

    for (let t = 0; t < 5; t += 1) {
      tickWorld(world);
    }

    expect(world.stockpiles[FOOD]).toBe(500);
    expect(world.stockpiles[WOOD]).toBe(500);

    // The legal order: Hoplite from a finished Military Academy.
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: barracks,
      unitType: TYPE_HOPLITE,
    });

    for (let t = 0; t < UNIT_TYPES[TYPE_HOPLITE]!.buildTicks + 5; t += 1) {
      tickWorld(world);
    }

    expect(world.stockpiles[FOOD]).toBe(500 - UNIT_TYPES[TYPE_HOPLITE]!.costFood);
    expect(world.stockpiles[GOLD]).toBe(500 - UNIT_TYPES[TYPE_HOPLITE]!.costGold);
    expect(world.count).toBe(countBefore + 1);
    const hoplite = world.count - 1;
    const barracksIndex = resolveId(world, barracks);
    expect(world.unitType[hoplite]).toBe(TYPE_HOPLITE);
    // The original-scale barracks mesh overhangs its logical footprint. Units emerge from the
    // front door, clear of the model, instead of idling invisibly inside it.
    expect(world.posZ[hoplite]).toBeLessThanOrEqual(
      world.posZ[barracksIndex]! - UNIT_TYPES[TYPE_BARRACKS]!.trainExitOffset + 0.5,
    );
    expect(
      world.walkable[
        Math.floor(world.posZ[hoplite]!) * MAP_TILES + Math.floor(world.posX[hoplite]!)
      ],
    ).toBe(1);
  });
});

describe("combat", () => {
  const stats = UNIT_TYPES[TYPE_VILLAGER]!;
  const attack = stats.attack!;

  test("adjacent enemies auto-acquire, trade damage, and produce a winner", () => {
    const world = flatWorld(42, [0, 1]);
    spawnUnit(world, 100, 100, 0, 0, 0);
    spawnUnit(world, 100.5, 100, 0, 0, 1);
    world.contested = true;

    // Acquire is staggered over 4 ticks, cooldown is 20: give the duel time.
    let winnerAt = -1;

    for (let t = 0; t < 400 && winnerAt < 0; t += 1) {
      tickWorld(world);

      if (world.winner !== -1) {
        winnerAt = t;
      }
    }

    expect(world.count).toBe(1);
    expect(world.winner).toBe(world.owner[0]!);
    // Sanity on pace: 8 strikes at 20-tick cooldown can't finish instantly.
    expect(winnerAt).toBeGreaterThan(100);
  });

  test("enemies outside aggro range ignore each other", () => {
    const world = flatWorld(42, [0, 1]);
    spawnUnit(world, 100, 100, 0, 0, 0);
    spawnUnit(world, 100 + attack.aggroRange * 3, 100, 0, 0, 1);
    world.contested = true;

    for (let t = 0; t < 200; t += 1) {
      tickWorld(world);
    }

    expect(world.count).toBe(2);
    expect(world.hp[0]).toBe(stats.maxHp);
    expect(world.hp[1]).toBe(stats.maxHp);
    expect(world.winner).toBe(-1);
  });

  test("a move order breaks off a fight", () => {
    const world = flatWorld(42, [0, 1]);
    const brawlerId = spawnUnit(world, 100, 100, 0, 0, 0);
    spawnUnit(world, 100.5, 100, 0, 0, 1);
    world.contested = true;

    // Let them engage.
    for (let t = 0; t < 30; t += 1) {
      tickWorld(world);
    }

    expect(world.attackTarget[0]).not.toBe(NO_TARGET);

    enqueueCommand(world, {
      tick: world.tick + 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [brawlerId],
      targetX: 160,
      targetZ: 100,
    });

    for (let t = 0; t < 40; t += 1) {
      tickWorld(world);
    }

    // The brawler left: target cleared and headed east. It does NOT get far
    // fast — the enemy auto-chases and body-blocks, so the pair congas east
    // at roughly half speed while the brawler flees under fire. That pursuit
    // is emergent and correct; the property under test is only the breakoff.
    expect(world.attackTarget[0]).toBe(NO_TARGET);
    expect(world.moving[0]).toBe(1);
    expect(world.posX[0]!).toBeGreaterThan(101.5);
  });

  test("an attack order against an unseen target is rejected", () => {
    const world = flatWorld(42, [0, 1]);
    const hunterId = spawnUnit(world, 50, 100, 0, 0, 0);
    const preyId = spawnUnit(world, 120, 100, 0, 0, 1);
    world.contested = true;

    // 70 units apart — no auto-acquire could ever see this target.
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [hunterId],
      targetId: preyId,
    });

    for (let t = 0; t < 2; t += 1) {
      tickWorld(world);
    }

    expect(world.attackTarget[0]).toBe(NO_TARGET);
  });

  test("an ordered attacker searches the last-seen position and resumes on reveal", () => {
    const world = flatWorld(42, [0, 1]);
    const hunterId = spawnUnit(world, 50, 100, 0, 0, 0, TYPE_MILITIA);
    const targetId = spawnBuilding(world, 56, 99, 1, TYPE_HOUSE);
    const target = resolveId(world, targetId);
    world.contested = true;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [hunterId],
      targetId,
    });
    tickWorld(world);
    tickWorld(world);

    expect(world.attackTarget[0]).toBe(targetId);
    expect(world.moveTargetX[0]).toBe(57);

    world.posX[target] = 120;
    tickWorld(world);
    expect(world.attackTarget[0]).toBe(targetId);
    expect(world.moveTargetX[0]).toBe(57);

    const revealedX = world.posX[0]! + 6;
    world.posX[target] = revealedX;
    tickWorld(world);
    expect(world.attackTarget[0]).toBe(targetId);
    expect(world.moveTargetX[0]).toBe(revealedX);

    world.posX[target] = 120;
    for (let t = 0; t < 80 && world.attackTarget[0] !== NO_TARGET; t += 1) {
      tickWorld(world);
    }

    expect(world.attackTarget[0]).toBe(NO_TARGET);
    expect(Math.abs(world.posX[0]! - revealedX)).toBeLessThanOrEqual(2);
  });

  test("a symmetric duel double-KOs into a draw, not an eternal stalemate", () => {
    const world = flatWorld(42, [0, 1]);
    spawnUnit(world, 100, 100, 0, 0, 0);
    spawnUnit(world, 100.5, 100, 0, 0, 1);
    // Identical stats + engaged the same tick = synchronized cooldowns all
    // the way down. Both die on the same strike; the match must END.
    world.attackTarget[0] = unitIdAt(world, 1);
    world.attackTarget[1] = unitIdAt(world, 0);
    world.attackOrdered[0] = 1;
    world.attackOrdered[1] = 1;
    world.contested = true;

    for (let t = 0; t < 400 && world.winner === -1; t += 1) {
      tickWorld(world);
    }

    expect(world.count).toBe(0);
    expect(world.winner).toBe(MATCH_DRAW);
  });

  test("an auto-acquired chase leashes; an ordered one would not", () => {
    const world = flatWorld(42, [0, 1]);
    spawnUnit(world, 100, 100, 0, 0, 0);
    const farId = spawnUnit(world, 100 + attack.aggroRange * LEASH_FACTOR + 2, 100, 0, 0, 1);
    world.contested = true;

    // Simulate an auto-engagement whose target has slipped past the leash.
    world.attackTarget[0] = farId;
    world.attackOrdered[0] = 0;
    tickWorld(world);
    expect(world.attackTarget[0]).toBe(NO_TARGET);

    // The identical geometry under an ORDER keeps the chase alive.
    world.attackTarget[0] = farId;
    world.attackOrdered[0] = 1;
    tickWorld(world);
    expect(world.attackTarget[0]).toBe(farId);
    expect(world.moving[0]).toBe(1);
  });

  test("attacking a friendly or stale target is a no-op", () => {
    const world = flatWorld(42, [0, 1]);
    // Enemy parked OUTSIDE aggro range: auto-acquire must not contaminate
    // what these command-validation assertions isolate.
    const a = spawnUnit(world, 100, 100, 0, 0, 0);
    const friend = spawnUnit(world, 102, 100, 0, 0, 0);
    const enemy = spawnUnit(world, 130, 100, 0, 0, 1);
    world.contested = true;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [a],
      targetId: friend,
    });
    killUnit(world, 2);
    tickWorld(world);

    expect(world.attackTarget[0]).toBe(NO_TARGET);

    // The enemy died before this order lands: stale target, silent no-op.
    enqueueCommand(world, {
      tick: world.tick + 1,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [a],
      targetId: enemy,
    });
    tickWorld(world);
    tickWorld(world);
    expect(world.attackTarget[0]).toBe(NO_TARGET);
  });

  test("a solo world never declares a winner", () => {
    const world = flatWorld(42);
    spawnUnits(world, 10, [0]);

    killUnit(world, 0);
    killUnit(world, 1);

    for (let t = 0; t < 20; t += 1) {
      tickWorld(world);
    }

    expect(world.winner).toBe(-1);
  });

  test("a 500v500 war stays hash-identical and someone wins", () => {
    // Armies are spawned raw (no spawnUnits) so no Town Centers exist: this
    // test pins combat determinism at scale, and annihilation-with-buildings
    // has its own coverage. Standing TCs would correctly keep winner at -1.
    const build = (): World => {
      const world = flatWorld(1337, [0, 1]);

      for (let i = 0; i < 500; i += 1) {
        spawnUnit(world, 20 + (i % 25), 20 + Math.floor(i / 25), 0, 0, 0);
      }

      for (let i = 0; i < 500; i += 1) {
        spawnUnit(world, 210 + (i % 25), 210 + Math.floor(i / 25), 0, 0, 1);
      }

      world.contested = true;
      return world;
    };
    const a = build();
    const b = build();

    const marchBoth = (world: World, issuer: number, targetX: number, targetZ: number): void => {
      const ids: number[] = [];

      for (let i = 0; i < world.count; i += 1) {
        if (world.owner[i] === issuer) {
          ids.push(unitIdAt(world, i));
        }
      }

      enqueueCommand(world, {
        tick: world.tick + 1,
        issuer,
        type: COMMAND_MOVE,
        unitIds: ids,
        targetX,
        targetZ,
      });
    };

    // Both armies ordered into the same field: the mother of all brawls.
    marchBoth(a, 0, 128, 128);
    marchBoth(b, 0, 128, 128);
    marchBoth(a, 1, 128, 128);
    marchBoth(b, 1, 128, 128);

    let sawWinner = false;

    for (let t = 0; t < 3000; t += 1) {
      tickWorld(a);
      tickWorld(b);

      if (hashWorld(a) !== hashWorld(b)) {
        throw new Error(`desync at tick ${t}`);
      }

      if (a.winner !== -1) {
        sawWinner = true;
        break;
      }
    }

    // The war must actually resolve — a stalemate would mean acquire or
    // chase is broken in a way the smaller tests can't see.
    expect(sawWinner).toBe(true);
    expect(a.winner).toBe(b.winner);
  });
});

describe("commands and separation", () => {
  test("an isolated unit arrives exactly and stops", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 10, 10, 0, 0);

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [id],
      targetX: 20,
      targetZ: 10,
    });

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
      issuer: 0,
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
      issuer: 0,
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

  test("flow steering never enters a blocked diagonal tile", () => {
    const world = flatWorld(7);
    const mover = spawnUnit(world, 100, 100, 0, 0);
    const blockedTile = 101 * MAP_TILES + 101;

    world.walkable[blockedTile] = 0;
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [mover],
      targetX: 103,
      targetZ: 103,
    });

    for (let tick = 0; tick < 80; tick += 1) {
      tickWorld(world);
      const occupiedTile =
        Math.floor(world.posZ[mover]!) * MAP_TILES + Math.floor(world.posX[mover]!);

      expect(occupiedTile).not.toBe(blockedTile);
    }

    expect(world.posX[mover]).toBe(103);
    expect(world.posZ[mover]).toBe(103);
  });

  test("flow steering routes around an obstacle inside the final approach radius", () => {
    const world = flatWorld(7);

    const mover = spawnUnit(world, 99.5, 100.5, 0, 0);
    const blockedTile = 100 * MAP_TILES + 101;

    world.walkable[blockedTile] = 0;
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [mover],
      targetX: 102.5,
      targetZ: 100.5,
    });

    for (let tick = 0; tick < 120; tick += 1) {
      tickWorld(world);
      const occupiedTile =
        Math.floor(world.posZ[mover]!) * MAP_TILES + Math.floor(world.posX[mover]!);

      expect(occupiedTile).not.toBe(blockedTile);
    }

    expect(world.posX[mover]).toBe(102.5);
    expect(world.posZ[mover]).toBe(100.5);
    expect(world.moving[mover]).toBe(0);
  });

  test("separation cannot push a unit diagonally through a blocked corner", () => {
    const world = flatWorld(7);
    const pushed = spawnUnit(world, 100.98, 100.98, 0, 0);

    spawnUnit(world, 100.78, 100.78, 0, 0);
    world.walkable[100 * MAP_TILES + 101] = 0;
    world.walkable[101 * MAP_TILES + 100] = 0;

    tickWorld(world);

    expect(world.posX[pushed]).toBeLessThan(101);
    expect(world.posZ[pushed]).toBeLessThan(101);
  });

  test("scripted commands stay hash-identical across two worlds", () => {
    // The M3 exit-criteria test: same seed, same command script, compare the
    // full state hash EVERY tick so the first divergent tick names itself —
    // the same shape M4's desync detection will use.
    const script = (world: World): void => {
      registerPlayer(world, 0);
      const ids: number[] = [];

      for (let i = 0; i < 100; i += 1) {
        ids.push(spawnUnit(world, 30 + (i % 10), 30 + Math.floor(i / 10), 0, 0));
      }

      enqueueCommand(world, {
        tick: 3,
        issuer: 0,
        type: COMMAND_MOVE,
        unitIds: ids,
        targetX: 200,
        targetZ: 60,
      });
      enqueueCommand(world, {
        tick: 30,
        issuer: 0,
        type: COMMAND_STOP,
        unitIds: ids.slice(0, 50),
      });
      enqueueCommand(world, {
        tick: 50,
        issuer: 0,
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
      issuer: 0,
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
