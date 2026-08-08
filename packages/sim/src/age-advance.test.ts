import { describe, expect, test } from "bun:test";
import { COMMAND_ADVANCE_AGE, COMMAND_TRAIN, enqueueCommand } from "./commands";
import {
  CLASSICAL_AGE_ADVANCE_RULE,
  CLASSICAL_AGE_ADVANCE_TICKS,
  CLASSICAL_AGE_COST_FOOD,
  HEROIC_AGE_ADVANCE_RULE,
  MYTHIC_AGE_ADVANCE_RULE,
  getAgeAdvanceAvailability,
  NO_RESEARCH,
  RESEARCH_CLASSICAL_AGE,
} from "./ecs/age-advancement";
import { registerPlayer } from "./ecs/players";
import {
  AGE_ARCHAIC,
  AGE_CLASSICAL,
  AGE_HEROIC,
  AGE_MYTHIC,
  GOD_ANUBIS,
  GOD_APHRODITE,
  GOD_APOLLO,
  GOD_ARES,
  GOD_ARTEMIS,
  GOD_ATHENA,
  GOD_BAST,
  GOD_DIONYSUS,
  GOD_HADES,
  GOD_HERMES,
  GOD_HATHOR,
  GOD_HEPHAESTUS,
  GOD_HERA,
  GOD_HORUS,
  GOD_ISIS,
  GOD_NEPHTHYS,
  GOD_OSIRIS,
  GOD_POSEIDON,
  GOD_PTAH,
  GOD_RA,
  GOD_SEKHMET,
  GOD_SET,
  GOD_THOTH,
  GOD_ZEUS,
  NO_AGE,
  NO_GOD,
} from "./ecs/progression";
import { findAgeAdvanceResearch } from "./ecs/research";
import { RESEARCH_WATCH_TOWER } from "./ecs/technologies";
import {
  FOOD,
  TYPE_EGYPTIAN_TEMPLE,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_GREEK_TEMPLE as TYPE_TEMPLE,
  TYPE_GREEK_TOWN_CENTER as TYPE_TOWN_CENTER,
  TYPE_GREEK_VILLAGER as TYPE_VILLAGER,
} from "./ecs/types";
import {
  createWorld,
  killUnit,
  resolveId,
  spawnBuilding,
  tickWorld,
  type World,
} from "./ecs/world";
import { hashWorld } from "./hash";
import { createSnapshot, writeSnapshot } from "./snapshot";

function classicalWorld(food: number = CLASSICAL_AGE_COST_FOOD): {
  world: World;
  townCenter: number;
  temple: number;
} {
  const world = createWorld(42);
  registerPlayer(world, 0);
  world.walkable.fill(1);
  world.stockpiles[FOOD] = food;
  const townCenter = spawnBuilding(world, 40, 40, 0, TYPE_TOWN_CENTER, true);
  const temple = spawnBuilding(world, 50, 40, 0, TYPE_TEMPLE, true);

  return { world, townCenter, temple };
}

function beginAdvance(world: World, townCenter: number, minorGod = GOD_ATHENA): void {
  enqueueCommand(world, {
    tick: world.tick,
    issuer: 0,
    type: COMMAND_ADVANCE_AGE,
    buildingId: townCenter,
    minorGod,
  });
  tickWorld(world);
}

describe("Classical Age advance", () => {
  test("uses one canonical rule for prerequisites, cost, duration, and god choices", () => {
    expect(
      getAgeAdvanceAvailability({
        age: AGE_ARCHAIC,
        majorGod: GOD_ZEUS,
        activeTargetAge: NO_AGE,
        resources: [CLASSICAL_AGE_COST_FOOD, 0, 0, 0],
        hasCompletedBuilding: () => true,
      }),
    ).toEqual({
      available: true,
      rule: CLASSICAL_AGE_ADVANCE_RULE,
      minorGods: [GOD_ATHENA, GOD_HERMES],
    });

    expect(
      getAgeAdvanceAvailability({
        age: AGE_ARCHAIC,
        majorGod: GOD_RA,
        activeTargetAge: NO_AGE,
        resources: [CLASSICAL_AGE_COST_FOOD, 0, 0, 0],
        hasCompletedBuilding: () => true,
      }),
    ).toEqual({
      available: true,
      rule: CLASSICAL_AGE_ADVANCE_RULE,
      minorGods: [GOD_BAST, GOD_PTAH],
    });
  });

  test("requires a completed Temple, 400 food, and a legal Zeus minor god", () => {
    const world = createWorld(42);
    registerPlayer(world, 0);
    world.walkable.fill(1);
    world.stockpiles[FOOD] = CLASSICAL_AGE_COST_FOOD;
    const townCenter = spawnBuilding(world, 40, 40, 0, TYPE_TOWN_CENTER, true);
    const townCenterIndex = resolveId(world, townCenter);

    beginAdvance(world, townCenter);
    expect(world.researchId[townCenterIndex]).toBe(NO_RESEARCH);
    expect(world.stockpiles[FOOD]).toBe(CLASSICAL_AGE_COST_FOOD);

    spawnBuilding(world, 50, 40, 0, TYPE_TEMPLE, true);
    beginAdvance(world, townCenter, GOD_HADES);
    expect(world.researchId[townCenterIndex]).toBe(NO_RESEARCH);

    world.stockpiles[FOOD] = CLASSICAL_AGE_COST_FOOD - 1;
    beginAdvance(world, townCenter);
    expect(world.researchId[townCenterIndex]).toBe(NO_RESEARCH);
    expect(world.playerAge[0]).toBe(AGE_ARCHAIC);
  });

  test("deducts food, reports progress, and commits the chosen minor god on completion", () => {
    const { world, townCenter } = classicalWorld();
    const townCenterIndex = resolveId(world, townCenter);
    const snapshot = createSnapshot(8);

    beginAdvance(world, townCenter, GOD_HERMES);

    expect(world.stockpiles[FOOD]).toBe(0);
    expect(world.researchId[townCenterIndex]).toBe(RESEARCH_CLASSICAL_AGE);
    expect(world.researchChoice[townCenterIndex]).toBe(GOD_HERMES);
    expect(world.researchRemaining[townCenterIndex]).toBe(CLASSICAL_AGE_ADVANCE_TICKS - 1);
    expect(world.playerAge[0]).toBe(AGE_ARCHAIC);

    writeSnapshot(world, snapshot, 0);
    expect(snapshot.ageAdvanceTarget).toBe(AGE_CLASSICAL);
    expect(snapshot.ageAdvanceGod).toBe(GOD_HERMES);
    expect(snapshot.ageAdvanceTotal).toBe(CLASSICAL_AGE_ADVANCE_RULE.durationTicks);
    expect(snapshot.ageAdvanceBuilding).toBe(townCenter);

    world.researchRemaining[townCenterIndex] = 2;
    tickWorld(world);
    expect(world.playerAge[0]).toBe(AGE_ARCHAIC);
    tickWorld(world);

    expect(world.playerAge[0]).toBe(AGE_CLASSICAL);
    expect(world.playerMinorGods[AGE_CLASSICAL]).toBe(GOD_HERMES);
    expect(world.researchId[townCenterIndex]).toBe(NO_RESEARCH);
    expect(world.researchChoice[townCenterIndex]).toBe(NO_GOD);
  });

  test("occupies the Town Center and resumes its existing queue after completion", () => {
    const { world, townCenter } = classicalWorld(CLASSICAL_AGE_COST_FOOD + 50);
    const townCenterIndex = resolveId(world, townCenter);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: townCenter,
      unitType: TYPE_VILLAGER,
    });
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_ADVANCE_AGE,
      buildingId: townCenter,
      minorGod: GOD_ATHENA,
    });
    tickWorld(world);

    expect(world.trainQueueLength[townCenterIndex]).toBe(1);
    expect(world.trainRemaining[townCenterIndex]).toBe(100);

    world.stockpiles[FOOD] = 50;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_TRAIN,
      buildingId: townCenter,
      unitType: TYPE_VILLAGER,
    });
    tickWorld(world);
    expect(world.trainQueueLength[townCenterIndex]).toBe(1);
    expect(world.stockpiles[FOOD]).toBe(50);

    world.researchRemaining[townCenterIndex] = 2;
    tickWorld(world);
    expect(world.trainRemaining[townCenterIndex]).toBe(100);
    tickWorld(world);
    expect(world.playerAge[0]).toBe(AGE_CLASSICAL);
    expect(world.trainRemaining[townCenterIndex]).toBe(99);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_ADVANCE_AGE,
      buildingId: townCenter,
      minorGod: GOD_ATHENA,
    });
    tickWorld(world);
    expect(world.researchId[townCenterIndex]).toBe(NO_RESEARCH);
  });

  test("refunds the age technology when its Town Center is destroyed", () => {
    const { world, townCenter } = classicalWorld();

    beginAdvance(world, townCenter);
    expect(world.stockpiles[FOOD]).toBe(0);

    killUnit(world, resolveId(world, townCenter));
    tickWorld(world);

    expect(world.stockpiles[FOOD]).toBe(CLASSICAL_AGE_COST_FOOD);
    expect(findAgeAdvanceResearch(world, 0)).toBe(-1);
    expect(world.playerAge[0]).toBe(AGE_ARCHAIC);
  });

  test("keeps the building-owned research order when swap-remove moves its Town Center", () => {
    const world = createWorld(42);
    registerPlayer(world, 0);
    world.walkable.fill(1);
    world.stockpiles[FOOD] = CLASSICAL_AGE_COST_FOOD;
    const temple = spawnBuilding(world, 50, 40, 0, TYPE_TEMPLE, true);
    const townCenter = spawnBuilding(world, 40, 40, 0, TYPE_TOWN_CENTER, true);

    beginAdvance(world, townCenter);
    const remaining = world.researchRemaining[resolveId(world, townCenter)]!;
    killUnit(world, resolveId(world, temple));
    tickWorld(world);

    const movedTownCenter = resolveId(world, townCenter);
    expect(movedTownCenter).toBe(0);
    expect(world.researchId[movedTownCenter]).toBe(RESEARCH_CLASSICAL_AGE);
    expect(world.researchRemaining[movedTownCenter]).toBe(remaining - 1);
    expect(findAgeAdvanceResearch(world, 0)).toBe(movedTownCenter);
  });

  test("hashes in-flight age research", () => {
    const a = classicalWorld().world;
    const b = classicalWorld().world;

    expect(hashWorld(a)).toBe(hashWorld(b));
    a.researchId[0] = RESEARCH_CLASSICAL_AGE;
    a.researchChoice[0] = GOD_ATHENA;
    a.researchRemaining[0] = 500;
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});

describe("complete Greek and Egyptian age progression", () => {
  test("exposes every launch-Classic minor-god pair", () => {
    const expected = new Map<
      number,
      readonly [readonly number[], readonly number[], readonly number[]]
    >([
      [
        GOD_ZEUS,
        [
          [GOD_ATHENA, GOD_HERMES],
          [GOD_APOLLO, GOD_DIONYSUS],
          [GOD_HERA, GOD_HEPHAESTUS],
        ],
      ],
      [
        GOD_HADES,
        [
          [GOD_ATHENA, GOD_ARES],
          [GOD_APOLLO, GOD_APHRODITE],
          [GOD_ARTEMIS, GOD_HEPHAESTUS],
        ],
      ],
      [
        GOD_POSEIDON,
        [
          [GOD_ARES, GOD_HERMES],
          [GOD_APHRODITE, GOD_DIONYSUS],
          [GOD_ARTEMIS, GOD_HEPHAESTUS],
        ],
      ],
      [
        GOD_RA,
        [
          [GOD_BAST, GOD_PTAH],
          [GOD_HATHOR, GOD_SEKHMET],
          [GOD_HORUS, GOD_OSIRIS],
        ],
      ],
      [
        GOD_ISIS,
        [
          [GOD_ANUBIS, GOD_BAST],
          [GOD_HATHOR, GOD_NEPHTHYS],
          [GOD_OSIRIS, GOD_THOTH],
        ],
      ],
      [
        GOD_SET,
        [
          [GOD_ANUBIS, GOD_PTAH],
          [GOD_NEPHTHYS, GOD_SEKHMET],
          [GOD_HORUS, GOD_THOTH],
        ],
      ],
    ]);

    for (const [majorGod, choices] of expected) {
      for (const [age, expectedChoices] of [
        [AGE_ARCHAIC, choices[0]],
        [AGE_CLASSICAL, choices[1]],
        [AGE_HEROIC, choices[2]],
      ] as const) {
        const availability = getAgeAdvanceAvailability({
          age,
          majorGod,
          activeTargetAge: NO_AGE,
          resources: [10_000, 10_000, 10_000, 10_000],
          hasCompletedBuilding: () => true,
        });
        expect(availability.available).toBe(true);
        if (availability.available) expect(availability.minorGods).toEqual(expectedChoices);
      }
    }
  });

  test("uses the original Heroic and Mythic costs, prerequisites, and times", () => {
    expect(HEROIC_AGE_ADVANCE_RULE).toMatchObject({
      fromAge: AGE_CLASSICAL,
      targetAge: AGE_HEROIC,
      cost: [800, 0, 500, 0],
      durationTicks: 75 * 20,
    });
    expect(MYTHIC_AGE_ADVANCE_RULE).toMatchObject({
      fromAge: AGE_HEROIC,
      targetAge: AGE_MYTHIC,
      cost: [1_000, 0, 1_000, 0],
      durationTicks: 90 * 20,
    });
    expect(
      getAgeAdvanceAvailability({
        age: AGE_HEROIC,
        majorGod: GOD_ZEUS,
        activeTargetAge: NO_AGE,
        resources: [1_000, 0, 1_000, 0],
        hasCompletedBuilding: () => false,
      }),
    ).toMatchObject({ available: false, reason: "building" });
  });

  test("Egyptians receive Watch Tower automatically at Classical completion", () => {
    const world = createWorld(42);
    registerPlayer(world, 0, GOD_RA);
    world.walkable.fill(1);
    world.stockpiles[FOOD] = CLASSICAL_AGE_COST_FOOD;
    const townCenter = spawnBuilding(world, 40, 40, 0, TYPE_EGYPTIAN_TOWN_CENTER, true);
    spawnBuilding(world, 50, 40, 0, TYPE_EGYPTIAN_TEMPLE, true);

    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_ADVANCE_AGE,
      buildingId: townCenter,
      minorGod: GOD_BAST,
    });
    tickWorld(world);
    world.researchRemaining[resolveId(world, townCenter)] = 1;
    tickWorld(world);
    expect(world.playerAge[0]).toBe(AGE_CLASSICAL);
    expect(world.playerResearch[RESEARCH_WATCH_TOWER]).toBe(1);
  });
});
