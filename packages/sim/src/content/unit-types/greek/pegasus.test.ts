import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, COMMAND_MOVE, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_PEGASUS, TYPE_TOXOTES } from "../../unit-type-ids";
import {
  MOVEMENT_DOMAIN_AIR,
  UNIT_CLASS_AIR,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_SCOUT,
} from "../../unit-type-schema";
import { definition } from "./pegasus";

describe("Greek Pegasus unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, unitReferenceEntry(definition.key)!),
    ).not.toThrow();
  });

  test("pins the launch noncombat scout row", () => {
    expect(definition).toMatchObject({
      classes: UNIT_CLASS_MYTH | UNIT_CLASS_AIR | UNIT_CLASS_SCOUT,
      maxHp: 140,
      lineOfSight: 18,
      movementSpeed: 5,
      movementDomain: MOVEMENT_DOMAIN_AIR,
      armor: [0.5, 0.5, 0.99],
      attack: null,
      bodyRadius: 0.99,
      collidesWithUnits: false,
      collidesWithProjectiles: true,
      costFood: 50,
      costFavor: 2,
      buildTicks: 120,
      populationCost: 2,
    });
  });

  test("flies across blocked terrain without displacing or being displaced by ground units", () => {
    const world = createWorld(741);
    world.walkable.fill(0);
    registerPlayer(world, 0);
    const pegasus = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PEGASUS);
    const hoplite = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HOPLITE);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [pegasus],
      targetX: 30,
      targetZ: 20,
    });
    for (let tick = 0; tick < 10; tick += 1) tickWorld(world);

    expect(world.posX[resolveId(world, pegasus)]).toBeGreaterThan(20);
    expect(world.posZ[resolveId(world, pegasus)]).toBe(20);
    expect(world.posX[resolveId(world, hoplite)]).toBe(20);
    expect(world.posZ[resolveId(world, hoplite)]).toBe(20);
  });

  test("rejects melee attack orders against air while allowing projectile attackers", () => {
    const world = createWorld(742);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const pegasus = spawnUnit(world, 22, 20, 0, 0, 1, TYPE_PEGASUS);
    const hoplite = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HOPLITE);
    const toxotes = spawnUnit(world, 20, 21, 0, 0, 0, TYPE_TOXOTES);

    for (const attacker of [hoplite, toxotes]) {
      enqueueCommand(world, {
        tick: 0,
        issuer: 0,
        type: COMMAND_ATTACK,
        unitIds: [attacker],
        targetId: pegasus,
      });
    }
    tickWorld(world);

    expect(world.attackTarget[resolveId(world, hoplite)]).not.toBe(pegasus);
    expect(world.attackTarget[resolveId(world, toxotes)]).toBe(pegasus);
  });
});
