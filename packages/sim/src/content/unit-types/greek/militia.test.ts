import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { GOD_POSEIDON, GOD_ZEUS } from "../../../ecs/progression";
import { createWorld, killUnit, spawnBuilding, spawnUnit, tickWorld } from "../../../ecs/world";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_GREEK_ARCHERY_RANGE,
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_GREEK_STABLE,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_HOPLITE,
  TYPE_MILITIA,
} from "../../unit-type-ids";
import { definition } from "./militia";

function countMilitia(world: ReturnType<typeof createWorld>, owner: number): number {
  let count = 0;
  for (let index = 0; index < world.count; index += 1) {
    if (world.owner[index] === owner && world.unitType[index] === TYPE_MILITIA) count += 1;
  }
  return count;
}

function destroyHouse(majorGod: number, existingMilitia = 0) {
  const world = createWorld(1);
  world.walkable.fill(1);
  registerPlayer(world, 0, majorGod);
  registerPlayer(world, 1, GOD_ZEUS);
  for (let index = 0; index < existingMilitia; index += 1) {
    spawnUnit(world, 10 + index * 0.1, 10, 0, 0, 0, TYPE_MILITIA);
  }
  const house = spawnBuilding(world, 20, 20, 0, TYPE_GREEK_HOUSE, true);
  const attacker = spawnUnit(world, 19, 21, 0, 0, 1, TYPE_HOPLITE);
  const houseIndex = world.count - 2;
  world.hp[houseIndex] = 1;
  enqueueCommand(world, {
    tick: 0,
    issuer: 1,
    type: COMMAND_ATTACK,
    unitIds: [attacker],
    targetId: house,
  });
  tickWorld(world);
  return world;
}

describe("Greek Militia unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins the Classic building-specific spawn table represented by current content", () => {
    expect([
      UNIT_TYPES[TYPE_GREEK_HOUSE]!.deathSpawn?.count,
      UNIT_TYPES[TYPE_GREEK_STABLE]!.deathSpawn?.count,
      UNIT_TYPES[TYPE_GREEK_MILITARY_ACADEMY]!.deathSpawn?.count,
      UNIT_TYPES[TYPE_GREEK_ARCHERY_RANGE]!.deathSpawn?.count,
      UNIT_TYPES[TYPE_GREEK_TEMPLE]!.deathSpawn?.count,
      UNIT_TYPES[TYPE_GREEK_FORTRESS]!.deathSpawn?.count,
      UNIT_TYPES[TYPE_GREEK_TOWN_CENTER]!.deathSpawn,
    ]).toEqual([2, 2, 3, 3, 4, 6, undefined]);
  });

  test("spawns only from Poseidon buildings destroyed by damage", () => {
    expect(countMilitia(destroyHouse(GOD_POSEIDON), 0)).toBe(2);
    expect(countMilitia(destroyHouse(GOD_ZEUS), 0)).toBe(0);

    const world = createWorld(2);
    world.walkable.fill(1);
    registerPlayer(world, 0, GOD_POSEIDON);
    spawnBuilding(world, 20, 20, 0, TYPE_GREEK_HOUSE, true);
    killUnit(world, 0);
    tickWorld(world);
    expect(countMilitia(world, 0)).toBe(0);
  });

  test("enforces the Classic limit of 25 live Militia", () => {
    expect(countMilitia(destroyHouse(GOD_POSEIDON, 24), 0)).toBe(25);
    expect(countMilitia(destroyHouse(GOD_POSEIDON, 25), 0)).toBe(25);
  });
});
