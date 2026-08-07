import { describe, expect, test } from "bun:test";
import {
  COMMAND_GARRISON,
  COMMAND_MOVE,
  COMMAND_UNGARRISON,
  enqueueCommand,
} from "../../../commands";
import { countGarrisonedUnits } from "../../../ecs/garrison";
import { registerPlayer } from "../../../ecs/players";
import { NO_TARGET } from "../../../ecs/unit-tasks";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HELEPOLIS, TYPE_HOPLITE, TYPE_PEGASUS, TYPE_ROC } from "../../unit-type-ids";
import {
  MOVEMENT_DOMAIN_AIR,
  UNIT_CLASS_AIR,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
} from "../../unit-type-schema";
import { definition } from "./roc";

describe("Egyptian Roc unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, unitReferenceEntry(definition.key)!),
    ).not.toThrow();
  });

  test("pins the launch flying-transport row", () => {
    expect(definition).toMatchObject({
      classes: UNIT_CLASS_MYTH | UNIT_CLASS_MILITARY | UNIT_CLASS_AIR,
      maxHp: 350,
      lineOfSight: 20,
      movementSpeed: 5.3,
      movementDomain: MOVEMENT_DOMAIN_AIR,
      armor: [0.4, 0.25, 0.8],
      attack: null,
      garrison: { capacity: 15, enterRange: 4, ejectOnDeath: false },
      bodyRadius: 0.99,
      collidesWithUnits: false,
      collidesWithProjectiles: true,
      costGold: 150,
      costFavor: 15,
      buildTicks: 280,
      populationCost: 3,
    });
  });

  test("flies over blocked terrain and carries fifteen eligible land units", () => {
    const world = createWorld(751);
    world.walkable.fill(0);
    registerPlayer(world, 0);
    const roc = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_ROC);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_MOVE,
      unitIds: [roc],
      targetX: 30,
      targetZ: 20,
    });
    for (let tick = 0; tick < 10; tick += 1) tickWorld(world);
    expect(world.posX[resolveId(world, roc)]).toBeGreaterThan(20);

    world.walkable.fill(1);
    const occupants = Array.from({ length: 16 }, (_, index) =>
      spawnUnit(world, 24 + index * 0.01, 20, 0, 0, 0, TYPE_HOPLITE),
    );
    const pegasus = spawnUnit(world, 24, 20, 0, 0, 0, TYPE_PEGASUS);
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [...occupants, pegasus],
      targetId: roc,
    });
    tickWorld(world);
    expect(countGarrisonedUnits(world, resolveId(world, roc))).toBe(15);
    expect(world.containedBy[resolveId(world, pegasus)]).toBe(NO_TARGET);
  });

  test("counts a carrier as one place and destroys its nested occupants with the Roc", () => {
    const world = createWorld(752);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    const roc = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_ROC);
    const helepolis = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HELEPOLIS);
    const hoplite = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HOPLITE);

    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [hoplite],
      targetId: helepolis,
    });
    tickWorld(world);
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [helepolis],
      targetId: roc,
    });
    tickWorld(world);

    expect(countGarrisonedUnits(world, resolveId(world, roc))).toBe(1);
    expect(world.containedBy[resolveId(world, hoplite)]).toBe(helepolis);

    killUnit(world, resolveId(world, roc), true);
    tickWorld(world);
    expect(resolveId(world, roc)).toBe(-1);
    expect(resolveId(world, helepolis)).toBe(-1);
    expect(resolveId(world, hoplite)).toBe(-1);
  });

  test("unloads land cargo onto its own movement domain", () => {
    const world = createWorld(753);
    world.walkable.fill(1);
    registerPlayer(world, 0);
    const roc = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_ROC);
    const hoplite = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_HOPLITE);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [hoplite],
      targetId: roc,
    });
    tickWorld(world);
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_UNGARRISON,
      containerId: roc,
    });
    tickWorld(world);
    expect(world.containedBy[resolveId(world, hoplite)]).toBe(NO_TARGET);
  });
});
