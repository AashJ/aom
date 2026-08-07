import { describe, expect, test } from "bun:test";
import { resolveAttackDamage } from "../../../ecs/combat";
import { registerPlayer } from "../../../ecs/players";
import { beginProjectileAttack, PROJECTILE_BALLISTA_BOLT } from "../../../ecs/projectiles";
import { createWorld, spawnUnit } from "../../../ecs/world";
import { UNIT_TYPES } from "../../../ecs/types";
import {
  MOVEMENT_DOMAIN_WATER,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_SHIP,
  UNIT_CLASS_SIEGE,
} from "../../unit-type-schema";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_JUGGERNAUT, TYPE_WAR_BARGE } from "../../unit-type-ids";
import { definition as warBargeDefinition } from "../egyptian/war-barge";
import { definition } from "./juggernaut";

describe("Classic siege-ship unit packs", () => {
  test("match both integration-owned naval references", () => {
    for (const candidate of [definition, warBargeDefinition]) {
      expect(() =>
        validateDefinitionAgainstReference(candidate, unitReferenceEntry(candidate.key)!),
      ).not.toThrow();
    }
  });

  test("pin launch balance and the War Barge's extra crush damage", () => {
    for (const candidate of [definition, warBargeDefinition]) {
      expect(candidate).toMatchObject({
        classes: UNIT_CLASS_MILITARY | UNIT_CLASS_SHIP | UNIT_CLASS_SIEGE,
        maxHp: 480,
        lineOfSight: 24,
        movementSpeed: 4.8,
        movementDomain: MOVEMENT_DOMAIN_WATER,
        armor: [0.1, 0.5, 0.1],
        costWood: 100,
        costGold: 100,
        buildTicks: 340,
        populationCost: 3,
        attack: {
          range: 18,
          cooldownTicks: 70,
          launchDelayTicks: 28,
          projectileCount: 4,
          projectile: { type: PROJECTILE_BALLISTA_BOLT, speed: 30, lifespanTicks: 40 },
        },
      });
    }
    expect(definition.attack.damage).toEqual([0, 0, 6]);
    expect(warBargeDefinition.attack.damage).toEqual([0, 0, 7]);
  });

  test("releases four bolts at the source tag and applies each counter exactly once", () => {
    const world = createWorld(504);
    world.waterNavigable.fill(1);
    world.waterWalkable.fill(1);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const attacker = spawnUnit(world, 40, 40, 0, 0, 0, TYPE_JUGGERNAUT);
    spawnUnit(world, 50, 40, 0, 0, 1, TYPE_WAR_BARGE);
    beginProjectileAttack(world, attacker, 1, UNIT_TYPES);

    expect(world.projectiles.count).toBe(4);
    expect([...world.projectiles.launchTicks.subarray(0, 4)]).toEqual([28, 28, 28, 28]);

    const ordinary = { ...warBargeDefinition, classes: UNIT_CLASS_MILITARY };
    const ship = { ...ordinary, classes: UNIT_CLASS_MILITARY | UNIT_CLASS_SHIP };
    const mythShip = {
      ...ordinary,
      classes: UNIT_CLASS_MILITARY | UNIT_CLASS_SHIP | UNIT_CLASS_MYTH,
    };
    const building = { ...ordinary, classes: UNIT_CLASS_BUILDING };
    const ordinaryDamage = resolveAttackDamage(definition.attack, ordinary);
    expect(resolveAttackDamage(definition.attack, ship)).toBeCloseTo(ordinaryDamage * 3.5, 12);
    expect(resolveAttackDamage(definition.attack, mythShip)).toBeCloseTo(ordinaryDamage * 3.5, 12);
    expect(resolveAttackDamage(definition.attack, building)).toBeCloseTo(ordinaryDamage * 1.75, 12);
  });
});
