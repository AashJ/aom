import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { PROJECTILE_MANTICORE_BARB } from "../../../ecs/projectiles";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import {
  MODE_PRAYING,
  NEUTRAL_OWNER,
  createWorld,
  resolveId,
  spawnUnit,
  tickWorld,
} from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_ACHILLES,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_MANTICORE,
  TYPE_MINOTAUR,
} from "../../unit-type-ids";
import { definition } from "./manticore";

function duel(targetType = TYPE_HOPLITE, distance = 3) {
  const world = createWorld(352);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const manticore = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_MANTICORE);
  const target = spawnUnit(world, 20 + distance, 20, 0, 0, 1, targetType);
  world.mode[1] = MODE_PRAYING;
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [manticore],
    targetId: target,
  });
  return { world, manticore, target };
}

function advanceToSpecialRelease(world: ReturnType<typeof createWorld>): void {
  tickWorld(world);
  expect(world.specialActionRemaining[0]).toBe(19);
  for (let tick = 0; tick < 10; tick += 1) tickWorld(world);
  expect(world.projectiles.count).toBe(0);
  tickWorld(world);
}

describe("Greek Manticore unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins Classic balance and its three-spine ordinary volley", () => {
    expect(definition).toMatchObject({
      maxHp: 420,
      lineOfSight: 20,
      movementSpeed: 4.3,
      armor: [0.3, 0.6, 0.8],
      costWood: 300,
      costFavor: 28,
      buildTicks: 340,
      populationCost: 5,
      attack: {
        kind: "projectile",
        damage: [0, 11, 0],
        range: 16,
        launchDelayTicks: 11,
        projectileCount: 3,
        accuracy: 0.9,
        accuracyReductionFactor: 2,
      },
      specialAttack: {
        kind: "charged-projectile",
        damage: [0, 15, 0],
        projectileCount: 6,
        rechargeTicks: 300,
        actionTicks: 19,
        impactDelayTicks: 11,
        impactArea: { radius: 4, falloff: "linear" },
      },
    });
  });

  test("targets human soldiers, villagers, and myth units but not buildings or Greek heroes", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_VILLAGER]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_HOUSE]!)).toBe(false);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_ACHILLES]!)).toBe(false);
  });

  test("releases six independently tracked area spines on the source tag", () => {
    const { world, target } = duel();
    const startingHp = world.hp[1]!;
    advanceToSpecialRelease(world);

    expect(world.specialActionRemaining[0]).toBe(8);
    expect(world.specialRecharge[0]).toBe(300);
    expect(world.projectiles.count).toBe(6);
    expect(Array.from(world.projectiles.specialAttacks.subarray(0, 6))).toEqual([1, 1, 1, 1, 1, 1]);
    expect(Array.from(world.projectiles.ids.subarray(0, 6))).toEqual([1, 2, 3, 4, 5, 6]);

    const snapshot = createSnapshot(4, 8);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.projectileCount).toBe(6);
    expect(Array.from(snapshot.projectileTypes.subarray(0, 6))).toEqual([
      PROJECTILE_MANTICORE_BARB,
      PROJECTILE_MANTICORE_BARB,
      PROJECTILE_MANTICORE_BARB,
      PROJECTILE_MANTICORE_BARB,
      PROJECTILE_MANTICORE_BARB,
      PROJECTILE_MANTICORE_BARB,
    ]);

    while (world.projectiles.count > 0) tickWorld(world);
    expect(world.hp[resolveId(world, target)]).toBeCloseTo(
      startingHp - resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_HOPLITE]!) * 6,
      10,
    );
  });

  test("applies each splash to enemies while excluding allies and neutral units", () => {
    const { world } = duel();
    spawnUnit(world, 23, 21, 0, 0, 1, TYPE_HOPLITE);
    spawnUnit(world, 23, 22, 0, 0, 0, TYPE_HOPLITE);
    spawnUnit(world, 23, 19, 0, 0, NEUTRAL_OWNER, TYPE_HOPLITE);
    world.mode.fill(MODE_PRAYING, 1, world.count);
    const hp = Array.from(world.hp.subarray(0, world.count));
    advanceToSpecialRelease(world);
    while (world.projectiles.count > 0) tickWorld(world);

    expect(world.hp[1]).toBeLessThan(hp[1]!);
    expect(world.hp[2]).toBeLessThan(hp[2]!);
    expect(world.hp[3]).toBe(hp[3]);
    expect(world.hp[4]).toBe(hp[4]);
  });

  test("uses three ordinary spines against a special-immune hero", () => {
    const { world } = duel(TYPE_ACHILLES);
    tickWorld(world);

    expect(world.specialActionRemaining[0]).toBe(0);
    expect(world.projectiles.count).toBe(3);
    expect(Array.from(world.projectiles.specialAttacks.subarray(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(world.projectiles.launchTicks.subarray(0, 3))).toEqual([11, 11, 11]);
  });

  test("keeps six-projectile spread and area resolution deterministic", () => {
    const a = duel().world;
    const b = duel().world;
    for (let tick = 0; tick < 200; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
