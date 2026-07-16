import { describe, expect, test } from "bun:test";
import { COMMAND_PLACE, COMMAND_TRAIN, enqueueCommand } from "./commands";
import { cultureForMajorGod } from "./content/culture-types";
import { getTypeAvailability, isTypeAvailable } from "./ecs/availability";
import {
  AGE_ARCHAIC,
  AGE_CLASSICAL,
  AGE_COUNT,
  GOD_ATHENA,
  GOD_POSEIDON,
  GOD_RA,
  GOD_ZEUS,
  NO_GOD,
} from "./ecs/progression";
import { registerPlayer } from "./ecs/players";
import {
  FOOD,
  GOLD,
  TYPE_GREEK_HOUSE as TYPE_HOUSE,
  TYPE_GREEK_MILITARY_ACADEMY as TYPE_BARRACKS,
  TYPE_GREEK_TOWN_CENTER as TYPE_TOWN_CENTER,
  TYPE_GREEK_VILLAGER as TYPE_VILLAGER,
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_HOPLITE,
  TYPE_SPEARMAN,
  UNIT_TYPES,
  WOOD,
} from "./ecs/types";
import {
  createWorld,
  resolveId,
  spawnBuilding,
  spawnUnit,
  spawnUnits,
  tickWorld,
  type World,
} from "./ecs/world";
import { hashWorld } from "./hash";
import { createSnapshot, writeSnapshot } from "./snapshot";

function flatWorld(seed: number, playerIds: readonly number[]): World {
  const world = createWorld(seed);

  world.walkable.fill(1);

  for (let index = 0; index < playerIds.length; index += 1) {
    registerPlayer(world, playerIds[index]!);
  }

  return world;
}

describe("player registration and progression", () => {
  test("owned entities require an explicitly registered player", () => {
    const world = createWorld(42);

    expect(() => spawnUnit(world, 10, 10, 0, 0, 3)).toThrow(RangeError);
    registerPlayer(world, 3);
    expect(() => spawnUnit(world, 10, 10, 0, 0, 3)).not.toThrow();
  });

  test("initializes Archaic Greek state by real player id", () => {
    const a = flatWorld(42, [3, 8]);
    const b = flatWorld(42, [3, 8]);

    spawnUnits(a, 10, [3, 8]);
    spawnUnits(b, 10, [3, 8]);

    expect(Array.from(a.playerIds.subarray(0, a.playerCount))).toEqual([3, 8]);
    expect(a.playerSlotById[3]).toBe(0);
    expect(a.playerSlotById[8]).toBe(1);

    for (const playerId of [3, 8]) {
      expect(a.playerAge[playerId]).toBe(AGE_ARCHAIC);
      expect(a.playerMajorGod[playerId]).toBe(GOD_ZEUS);
      expect(a.playerMinorGods.subarray(playerId * AGE_COUNT, (playerId + 1) * AGE_COUNT)).toEqual(
        new Uint8Array(AGE_COUNT).fill(NO_GOD),
      );
    }

    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  test("hashes every active-player progression field", () => {
    const world = flatWorld(42, [3, 8]);

    spawnUnits(world, 10, [3, 8]);
    const before = hashWorld(world);

    world.playerAge[8] = AGE_CLASSICAL;
    expect(hashWorld(world)).not.toBe(before);
    world.playerAge[8] = AGE_ARCHAIC;

    world.playerMajorGod[8] = GOD_POSEIDON;
    expect(hashWorld(world)).not.toBe(before);
    world.playerMajorGod[8] = GOD_ZEUS;

    world.playerMinorGods[8 * AGE_COUNT + AGE_CLASSICAL] = GOD_ATHENA;
    expect(hashWorld(world)).not.toBe(before);
  });

  test("snapshots expose progression for the viewing player id", () => {
    const world = flatWorld(42, [3, 8]);
    const snapshot = createSnapshot(16);

    spawnUnits(world, 10, [3, 8]);
    world.playerAge[8] = AGE_CLASSICAL;
    world.playerMajorGod[8] = GOD_RA;
    world.playerMinorGods[8 * AGE_COUNT + AGE_CLASSICAL] = GOD_ATHENA;

    writeSnapshot(world, snapshot, 8);
    expect(snapshot.age).toBe(AGE_CLASSICAL);
    expect(snapshot.majorGod).toBe(GOD_RA);
    expect(snapshot.playerMajorGods[8]).toBe(GOD_RA);
    expect(snapshot.playerMajorGods[3]).toBe(GOD_ZEUS);
    expect(snapshot.minorGods[AGE_CLASSICAL]).toBe(GOD_ATHENA);

    writeSnapshot(world, snapshot, 3);
    expect(snapshot.age).toBe(AGE_ARCHAIC);
    expect(snapshot.majorGod).toBe(GOD_ZEUS);
    expect(snapshot.minorGods).toEqual(new Uint8Array(AGE_COUNT).fill(NO_GOD));
  });
});

describe("content availability", () => {
  test("culture and producer checks reject cross-tree commands authoritatively", () => {
    const context = (majorGod: number, producerType: number) => ({
      playerAge: AGE_CLASSICAL,
      playerCulture: cultureForMajorGod(majorGod),
      producerType,
      hasCompletedBuilding: () => true,
      hasGod: (god: number) => god === majorGod,
      ownedOrQueuedUnitCount: () => 0,
    });

    expect(getTypeAvailability(TYPE_SPEARMAN, context(GOD_ZEUS, TYPE_EGYPTIAN_BARRACKS))).toEqual({
      available: false,
      reason: "culture",
      requiredCulture: cultureForMajorGod(GOD_RA),
    });
    expect(getTypeAvailability(TYPE_HOPLITE, context(GOD_ZEUS, TYPE_TOWN_CENTER))).toEqual({
      available: false,
      reason: "producer",
      producerType: TYPE_TOWN_CENTER,
    });
    expect(getTypeAvailability(TYPE_HOPLITE, context(GOD_ZEUS, TYPE_BARRACKS))).toEqual({
      available: true,
    });
    expect(getTypeAvailability(TYPE_SPEARMAN, context(GOD_RA, TYPE_EGYPTIAN_BARRACKS))).toEqual({
      available: true,
    });
  });

  test("viewer snapshots drive the same age and prerequisite rule", () => {
    const world = flatWorld(42, [3, 8]);
    const snapshot = createSnapshot(16);

    spawnUnits(world, 10, [3, 8]);

    const availabilityContext = (producerType?: number) => ({
      playerAge: snapshot.age,
      playerCulture: cultureForMajorGod(snapshot.majorGod),
      producerType,
      hasCompletedBuilding: (buildingType: number) =>
        snapshot.completedBuildings[buildingType] === 1,
      hasGod: (god: number) => god === snapshot.majorGod || snapshot.minorGods.includes(god),
      ownedOrQueuedUnitCount: () => 0,
    });
    const availableFromSnapshot = (unitType: number): boolean =>
      isTypeAvailable(unitType, availabilityContext());

    writeSnapshot(world, snapshot, 3);
    expect(snapshot.completedBuildings[TYPE_TOWN_CENTER]).toBe(1);
    expect(getTypeAvailability(TYPE_BARRACKS, availabilityContext(TYPE_VILLAGER))).toEqual({
      available: false,
      reason: "age",
      requiredAge: AGE_CLASSICAL,
    });
    expect(availableFromSnapshot(TYPE_VILLAGER)).toBe(true);
    expect(availableFromSnapshot(TYPE_HOUSE)).toBe(true);
    expect(availableFromSnapshot(TYPE_BARRACKS)).toBe(false);
    expect(availableFromSnapshot(TYPE_HOPLITE)).toBe(false);

    world.playerAge[8] = AGE_CLASSICAL;
    const barracks = spawnBuilding(world, 100, 100, 8, TYPE_BARRACKS, false);

    writeSnapshot(world, snapshot, 8);
    expect(availableFromSnapshot(TYPE_BARRACKS)).toBe(true);
    expect(getTypeAvailability(TYPE_HOPLITE, availabilityContext(TYPE_BARRACKS))).toEqual({
      available: false,
      reason: "building",
      buildingType: TYPE_BARRACKS,
    });
    expect(availableFromSnapshot(TYPE_HOPLITE)).toBe(false);

    world.buildProgress[resolveId(world, barracks)] = UNIT_TYPES[TYPE_BARRACKS]!.buildTicks;
    writeSnapshot(world, snapshot, 8);
    expect(snapshot.completedBuildings[TYPE_BARRACKS]).toBe(1);
    expect(availableFromSnapshot(TYPE_HOPLITE)).toBe(true);
  });

  test("age-locked Place commands are silent no-ops until the required age", () => {
    const world = flatWorld(42, [0]);

    spawnUnits(world, 5, [0]);
    world.stockpiles[WOOD] = 500;
    const countBefore = world.count;

    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_BARRACKS,
      tileX: 45,
      tileZ: 45,
    });
    tickWorld(world);
    tickWorld(world);

    expect(world.count).toBe(countBefore);
    expect(world.stockpiles[WOOD]).toBe(500);

    world.playerAge[0] = AGE_CLASSICAL;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_PLACE,
      buildingType: TYPE_BARRACKS,
      tileX: 45,
      tileZ: 45,
    });
    tickWorld(world);

    expect(world.count).toBe(countBefore + 1);
    expect(world.unitType[world.count - 1]).toBe(TYPE_BARRACKS);
    expect(world.stockpiles[WOOD]).toBe(500 - UNIT_TYPES[TYPE_BARRACKS]!.costWood);
  });

  test("age-locked Train commands are silent no-ops until the required age", () => {
    const world = flatWorld(42, [0]);

    spawnUnits(world, 5, [0]);
    const barracks = spawnBuilding(world, 100, 100, 0, TYPE_BARRACKS, true);
    const barracksIndex = resolveId(world, barracks);

    world.stockpiles[FOOD] = 500;
    world.stockpiles[WOOD] = 500;
    world.stockpiles[GOLD] = 500;
    enqueueCommand(world, {
      tick: 1,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: barracks,
      unitType: TYPE_HOPLITE,
    });
    tickWorld(world);
    tickWorld(world);

    expect(world.trainQueueLength[barracksIndex]).toBe(0);
    expect(world.stockpiles[FOOD]).toBe(500);
    expect(world.stockpiles[WOOD]).toBe(500);

    world.playerAge[0] = AGE_CLASSICAL;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: barracks,
      unitType: TYPE_HOPLITE,
    });
    tickWorld(world);

    expect(world.trainQueueLength[barracksIndex]).toBe(1);
    expect(world.stockpiles[FOOD]).toBe(500 - UNIT_TYPES[TYPE_HOPLITE]!.costFood);
    expect(world.stockpiles[WOOD]).toBe(500 - UNIT_TYPES[TYPE_HOPLITE]!.costWood);
  });
});
