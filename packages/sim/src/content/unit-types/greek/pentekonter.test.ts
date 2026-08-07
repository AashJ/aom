import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, enqueueCommand } from "../../../commands";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import {
  MOVEMENT_DOMAIN_WATER,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_SHIP,
} from "../../unit-type-schema";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_PENTEKONTER, TYPE_RAMMING_GALLEY } from "../../unit-type-ids";
import { definition as rammingGalleyDefinition } from "../egyptian/ramming-galley";
import { definition } from "./pentekonter";

describe("Classic hammer-ship unit packs", () => {
  test("match both integration-owned naval references", () => {
    for (const candidate of [definition, rammingGalleyDefinition]) {
      expect(() =>
        validateDefinitionAgainstReference(candidate, unitReferenceEntry(candidate.key)!),
      ).not.toThrow();
    }
  });

  test("pin the shared launch rows and Classic pierce-armor correction", () => {
    for (const candidate of [definition, rammingGalleyDefinition]) {
      expect(candidate).toMatchObject({
        classes: UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE | UNIT_CLASS_SHIP,
        maxHp: 240,
        lineOfSight: 16,
        movementSpeed: 7,
        movementDomain: MOVEMENT_DOMAIN_WATER,
        armor: [0.3, 0.15, 0.75],
        costWood: 100,
        costGold: 50,
        buildTicks: 180,
        populationCost: 2,
        attack: {
          damage: [20, 0, 0],
          range: 2,
          cooldownTicks: 30,
          cycleVariants: [{ actionTicks: 30, impactDelayTicks: 2 }],
        },
      });
    }
  });

  test("deals ram damage only at the source-authored attack tag", () => {
    const world = createWorld(503);
    world.waterNavigable.fill(1);
    world.waterWalkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const attacker = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_PENTEKONTER);
    const target = spawnUnit(world, 21, 20, 0, 0, 1, TYPE_RAMMING_GALLEY);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [attacker],
      targetId: target,
    });

    const targetIndex = resolveId(world, target);
    expect(targetIndex).toBeGreaterThanOrEqual(0);
    const fullHp = world.hp[targetIndex]!;
    tickWorld(world);
    expect(world.hp[targetIndex]).toBe(fullHp);
    tickWorld(world);
    expect(world.hp[targetIndex]).toBe(fullHp);
    tickWorld(world);
    expect(world.hp[targetIndex]).toBeLessThan(fullHp);
  });
});
