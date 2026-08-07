import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { PROJECTILE_ARROW } from "../../../ecs/projectiles";
import { isValidSpecialTarget } from "../../../ecs/special-attacks";
import { MODE_PRAYING, createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { hashWorld } from "../../../hash";
import { createSnapshot, writeSnapshot } from "../../../snapshot";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_ACHILLES,
  TYPE_CENTAUR,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_MINOTAUR,
} from "../../unit-type-ids";
import { definition } from "./centaur";

function duel(targetType = TYPE_HOPLITE, distance = 10) {
  const world = createWorld(350);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const centaur = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_CENTAUR);
  const target = spawnUnit(world, 20 + distance, 20, 0, 0, 1, targetType);
  world.mode[1] = MODE_PRAYING;
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [centaur],
    targetId: target,
  });
  return { world, centaur, target };
}

function advanceToSpecialRelease(world: ReturnType<typeof createWorld>): void {
  tickWorld(world);
  expect(world.specialActionRemaining[0]).toBe(50);
  for (let tick = 0; tick < 39; tick += 1) tickWorld(world);
  expect(world.projectiles.count).toBe(0);
  tickWorld(world);
}

describe("Greek Centaur unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins launch balance and both authored arrow attacks", () => {
    expect(definition).toMatchObject({
      maxHp: 220,
      lineOfSight: 20,
      movementSpeed: 5,
      armor: [0.3, 0.35, 0.8],
      costWood: 200,
      costFavor: 12,
      buildTicks: 380,
      populationCost: 3,
      attack: {
        kind: "projectile",
        damage: [0, 12, 0],
        range: 12,
        launchDelayTicks: 12,
        accuracy: 0.8,
        accuracyReductionFactor: 0,
        aimBonus: 15,
        trackRating: 5,
      },
      specialAttack: {
        kind: "charged-projectile",
        damage: [0, 50, 0],
        range: 12,
        rechargeTicks: 300,
        actionTicks: 50,
        impactDelayTicks: 40,
        accuracy: 1,
        trackRating: 10,
        unintentionalDamageMultiplier: 1,
      },
    });
  });

  test("permits human soldiers, villagers, and myth units but excludes buildings and heroes", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_VILLAGER]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_HOUSE]!)).toBe(false);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_ACHILLES]!)).toBe(false);
  });

  test("releases its guaranteed tracking shot on the 80% source tag", () => {
    const { world, target } = duel();
    const startingHp = world.hp[1]!;
    advanceToSpecialRelease(world);

    expect(world.specialActionRemaining[0]).toBe(10);
    expect(world.specialRecharge[0]).toBe(300);
    expect(world.projectiles.count).toBe(1);
    expect(world.projectiles.specialAttacks[0]).toBe(1);
    expect(world.projectiles.sourceTypes[0]).toBe(TYPE_CENTAUR);
    expect(world.projectiles.launchTicks[0]).toBe(40);
    expect(world.projectiles.impactTicks[0]).toBeGreaterThan(40);
    expect(world.hp[resolveId(world, target)]).toBe(startingHp);

    const snapshot = createSnapshot(4);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.projectileCount).toBe(1);
    expect(snapshot.projectileTypes[0]).toBe(PROJECTILE_ARROW);

    while (world.projectiles.count > 0) tickWorld(world);
    expect(world.hp[resolveId(world, target)]).toBeCloseTo(
      startingHp - resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_HOPLITE]!),
      10,
    );
  });

  test("retains the tracking shot's 3x myth multiplier", () => {
    const { world, target } = duel(TYPE_MINOTAUR);
    const startingHp = world.hp[1]!;
    advanceToSpecialRelease(world);
    while (world.projectiles.count > 0) tickWorld(world);

    expect(world.hp[resolveId(world, target)]).toBeCloseTo(startingHp - 75, 10);
  });

  test("deals full special damage to the first unintended unit on its flight path", () => {
    const { world, target } = duel();
    const interceptor = spawnUnit(world, 25, 20, 0, 0, 1, TYPE_HOPLITE);
    world.mode[2] = MODE_PRAYING;
    const targetHp = world.hp[1]!;
    const interceptorHp = world.hp[2]!;
    advanceToSpecialRelease(world);
    while (world.projectiles.count > 0) tickWorld(world);

    expect(world.hp[resolveId(world, target)]).toBe(targetHp);
    expect(world.hp[resolveId(world, interceptor)]).toBeCloseTo(
      interceptorHp - resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_HOPLITE]!),
      10,
    );
  });

  test("uses its ordinary arrow against a special-immune hero", () => {
    const { world } = duel(TYPE_ACHILLES);
    world.specialRecharge[0] = 300;
    tickWorld(world);

    expect(world.specialActionRemaining[0]).toBe(0);
    expect(world.projectiles.count).toBe(1);
    expect(world.projectiles.specialAttacks[0]).toBe(0);
    expect(world.projectiles.launchTicks[0]).toBe(12);
  });

  test("hashes charged-projectile identity and remains deterministic", () => {
    const a = duel().world;
    const b = duel().world;
    advanceToSpecialRelease(a);
    advanceToSpecialRelease(b);
    expect(hashWorld(a)).toBe(hashWorld(b));

    b.projectiles.specialAttacks[0] = 0;
    expect(hashWorld(a)).not.toBe(hashWorld(b));
    b.projectiles.specialAttacks[0] = 1;

    for (let tick = 0; tick < 200; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
