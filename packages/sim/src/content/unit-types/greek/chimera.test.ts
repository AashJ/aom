import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { resolveDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { PROJECTILE_CHIMERA_FIRE } from "../../../ecs/projectiles";
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
  TYPE_CHIMERA,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_MINOTAUR,
} from "../../unit-type-ids";
import { definition } from "./chimera";

function duel(targetType = TYPE_HOPLITE, distance = 6) {
  const world = createWorld(353);
  world.walkable.fill(1);
  registerPlayer(world, 0);
  registerPlayer(world, 1);
  const chimera = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_CHIMERA);
  const target = spawnUnit(world, 20 + distance, 20, 0, 0, 1, targetType);
  world.mode[1] = MODE_PRAYING;
  enqueueCommand(world, {
    tick: 0,
    issuer: 0,
    type: COMMAND_ATTACK,
    unitIds: [chimera],
    targetId: target,
  });
  return { world, chimera, target };
}

function advanceToSpecialRelease(world: ReturnType<typeof createWorld>): void {
  tickWorld(world);
  expect(world.specialActionRemaining[0]).toBe(40);
  for (let tick = 0; tick < 27; tick += 1) tickWorld(world);
  expect(world.projectiles.count).toBe(0);
  tickWorld(world);
}

describe("Greek Chimera unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins launch balance and the three-flame area special", () => {
    expect(definition).toMatchObject({
      maxHp: 800,
      lineOfSight: 16,
      movementSpeed: 5.3,
      armor: [0.6, 0.6, 0.8],
      costGold: 300,
      costFavor: 30,
      buildTicks: 400,
      populationCost: 4,
      attack: {
        kind: "melee",
        damage: [20, 0, 0],
        cycleVariants: [{ actionTicks: 20, impactDelayTicks: 9 }],
      },
      specialAttack: {
        kind: "charged-projectile",
        damage: [28, 0, 0],
        range: 8,
        projectileCount: 3,
        rechargeTicks: 400,
        actionTicks: 40,
        impactDelayTicks: 28,
        impactArea: { radius: 5, falloff: "linear" },
        projectile: { type: PROJECTILE_CHIMERA_FIRE, speed: 50, collisionRadius: 1 },
      },
    });
  });

  test("targets villagers, human soldiers, and myth units but not buildings or heroes", () => {
    const special = definition.specialAttack;
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_HOPLITE]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_VILLAGER]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_MINOTAUR]!)).toBe(true);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_GREEK_HOUSE]!)).toBe(false);
    expect(isValidSpecialTarget(special, UNIT_TYPES[TYPE_ACHILLES]!)).toBe(false);
  });

  test("releases three invisible splash projectiles on the source-authored tag", () => {
    const { world, target } = duel();
    const startingHp = world.hp[1]!;
    advanceToSpecialRelease(world);

    expect(world.specialActionRemaining[0]).toBe(12);
    expect(world.specialRecharge[0]).toBe(400);
    expect(world.projectiles.count).toBe(3);
    expect(Array.from(world.projectiles.specialAttacks.subarray(0, 3))).toEqual([1, 1, 1]);
    expect(Array.from(world.projectiles.ids.subarray(0, 3))).toEqual([1, 2, 3]);

    const snapshot = createSnapshot(4, 8);
    writeSnapshot(world, snapshot, 0);
    expect(snapshot.projectileCount).toBe(3);
    expect(Array.from(snapshot.projectileTypes.subarray(0, 3))).toEqual([
      PROJECTILE_CHIMERA_FIRE,
      PROJECTILE_CHIMERA_FIRE,
      PROJECTILE_CHIMERA_FIRE,
    ]);

    while (world.projectiles.count > 0) tickWorld(world);
    expect(world.hp[resolveId(world, target)]).toBeCloseTo(
      startingHp - resolveDamage(definition.specialAttack, UNIT_TYPES[TYPE_HOPLITE]!) * 3,
      10,
    );
  });

  test("splashes enemy and neutral units while excluding allies", () => {
    const { world } = duel();
    spawnUnit(world, 26, 1 + 20, 0, 0, 1, TYPE_HOPLITE);
    spawnUnit(world, 26, 2 + 20, 0, 0, 0, TYPE_HOPLITE);
    spawnUnit(world, 26, 19, 0, 0, NEUTRAL_OWNER, TYPE_HOPLITE);
    world.mode.fill(MODE_PRAYING, 1, world.count);
    const hp = Array.from(world.hp.subarray(0, world.count));
    advanceToSpecialRelease(world);
    while (world.projectiles.count > 0) tickWorld(world);

    expect(world.hp[1]).toBeLessThan(hp[1]!);
    expect(world.hp[2]).toBeLessThan(hp[2]!);
    expect(world.hp[3]).toBe(hp[3]);
    expect(world.hp[4]).toBeLessThan(hp[4]!);
  });

  test("keeps the volley, impact areas, and recharge deterministic", () => {
    const a = duel().world;
    const b = duel().world;
    for (let tick = 0; tick < 500; tick += 1) {
      tickWorld(a);
      tickWorld(b);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }
  });
});
