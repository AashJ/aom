import { describe, expect, test } from "bun:test";
import { COMMAND_ATTACK, COMMAND_GARRISON, enqueueCommand } from "../../../commands";
import { resolveAttackDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { MAP_TILES } from "../../../terrain";
import {
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_SHIP,
  UNIT_CLASS_TRANSPORT_SHIP,
} from "../../unit-type-schema";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_HOPLITE, TYPE_LEVIATHAN, TYPE_PENTEKONTER } from "../../unit-type-ids";
import { definition as kebenitDefinition } from "./kebenit";
import { definition } from "./leviathan";

function shorelineWorld() {
  const world = createWorld(691);
  world.walkable.fill(0);
  world.waterNavigable.fill(1);
  world.waterWalkable.fill(1);
  for (let z = 0; z < MAP_TILES; z += 1) {
    for (let x = 0; x <= 10; x += 1) {
      world.walkable[z * MAP_TILES + x] = 1;
      world.waterNavigable[z * MAP_TILES + x] = 0;
      world.waterWalkable[z * MAP_TILES + x] = 0;
    }
  }
  registerPlayer(world, 0);
  return world;
}

describe("Egyptian Leviathan unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, unitReferenceEntry(definition.key)!),
    ).not.toThrow();
  });

  test("pins the launch combat row and twenty-place living transport", () => {
    expect(definition).toMatchObject({
      classes:
        UNIT_CLASS_MYTH |
        UNIT_CLASS_MILITARY |
        UNIT_CLASS_MELEE |
        UNIT_CLASS_SHIP |
        UNIT_CLASS_TRANSPORT_SHIP,
      maxHp: 1020,
      lineOfSight: 22,
      movementSpeed: 4.2,
      armor: [0.4, 0.6, 0.8],
      costGold: 200,
      costFavor: 20,
      buildTicks: 200,
      populationCost: 4,
      attack: {
        damage: [25, 0, 0],
        range: 0.1,
        cycleVariants: [{ actionTicks: 30, impactDelayTicks: 18 }],
      },
      garrison: { capacity: 20, enterRange: 4, ejectOnDeath: false },
    });
  });

  test("lands its bite at the source tag and receives arrow-ship transport damage", () => {
    const world = createWorld(692);
    world.waterNavigable.fill(1);
    world.waterWalkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const attacker = spawnUnit(world, 20, 20, 0, 0, 0, TYPE_LEVIATHAN);
    const target = spawnUnit(world, 20, 21, 0, 0, 1, TYPE_PENTEKONTER);
    const targetIndex = resolveId(world, target);
    const startingHp = world.hp[targetIndex]!;
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_ATTACK,
      unitIds: [attacker],
      targetId: target,
    });
    for (let tick = 0; tick < 18; tick += 1) tickWorld(world);
    expect(world.hp[targetIndex]).toBe(startingHp);
    tickWorld(world);
    expect(world.hp[targetIndex]).toBeLessThan(startingHp);

    const ordinaryTarget = {
      ...definition,
      classes: definition.classes & ~UNIT_CLASS_TRANSPORT_SHIP,
    };
    expect(resolveAttackDamage(kebenitDefinition.attack, definition)).toBeCloseTo(
      resolveAttackDamage(kebenitDefinition.attack, ordinaryTarget) * 3,
      12,
    );
  });

  test("boards across shore and sinks its cargo with the body", () => {
    const world = shorelineWorld();
    const leviathan = spawnUnit(world, 11.5, 40.5, 0, 0, 0, TYPE_LEVIATHAN);
    const hoplite = spawnUnit(world, 10.5, 40.5, 0, 0, 0, TYPE_HOPLITE);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [hoplite],
      targetId: leviathan,
    });
    tickWorld(world);
    expect(world.containedBy[resolveId(world, hoplite)]).toBe(leviathan);

    killUnit(world, resolveId(world, leviathan), true);
    tickWorld(world);
    expect(resolveId(world, leviathan)).toBe(-1);
    expect(resolveId(world, hoplite)).toBe(-1);
  });
});
