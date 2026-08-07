import { describe, expect, test } from "bun:test";
import { resolveAttackDamage, resolveProjectileHitDamage } from "../../../ecs/combat";
import { beginProjectileAttack, PROJECTILE_ARROW } from "../../../ecs/projectiles";
import { registerPlayer } from "../../../ecs/players";
import { createWorld, spawnUnit } from "../../../ecs/world";
import { UNIT_TYPES } from "../../../ecs/types";
import {
  MOVEMENT_DOMAIN_WATER,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_SHIP,
  UNIT_CLASS_TRANSPORT_SHIP,
} from "../../unit-type-schema";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_KEBENIT, TYPE_TRIREME } from "../../unit-type-ids";
import { definition as kebenitDefinition } from "../egyptian/kebenit";
import { definition } from "./trireme";

describe("Classic arrow ship unit packs", () => {
  test("match both integration-owned naval references", () => {
    for (const candidate of [definition, kebenitDefinition]) {
      expect(() =>
        validateDefinitionAgainstReference(candidate, unitReferenceEntry(candidate.key)!),
      ).not.toThrow();
    }
  });

  test("pin the shared Trireme and Kebenit rows", () => {
    for (const candidate of [definition, kebenitDefinition]) {
      expect(candidate).toMatchObject({
        classes: UNIT_CLASS_MILITARY | UNIT_CLASS_SHIP,
        maxHp: 290,
        lineOfSight: 24,
        movementSpeed: 6,
        movementDomain: MOVEMENT_DOMAIN_WATER,
        armor: [0.3, 0.2, 0.1],
        costWood: 100,
        costGold: 50,
        buildTicks: 280,
        populationCost: 2,
        attack: {
          kind: "projectile",
          damage: [0, 6, 0],
          range: 12,
          cooldownTicks: 30,
          launchDelayTicks: 12,
          projectileCount: 3,
          accuracy: 0.8,
          trackRating: 10,
          projectile: { type: PROJECTILE_ARROW, speed: 30, lifespanTicks: 40 },
        },
      });
    }
  });

  test("releases three arrows and preserves the 3x Transport Ship counter bonus", () => {
    const world = createWorld(337);
    registerPlayer(world, 0);
    registerPlayer(world, 1);
    const attacker = spawnUnit(world, 40, 40, 0, 0, 0, TYPE_TRIREME);
    spawnUnit(world, 48, 40, 0, 0, 1, TYPE_KEBENIT);
    beginProjectileAttack(world, attacker, 1, UNIT_TYPES);

    expect(world.projectiles.count).toBe(3);
    expect([...world.projectiles.launchTicks.subarray(0, 3)]).toEqual([12, 12, 12]);
    expect([...world.projectiles.ids.subarray(0, 3)]).toEqual([1, 2, 3]);

    const ordinary = resolveAttackDamage(definition.attack, kebenitDefinition);
    const transport = {
      ...kebenitDefinition,
      classes: kebenitDefinition.classes | UNIT_CLASS_TRANSPORT_SHIP,
    };
    expect(resolveAttackDamage(definition.attack, transport)).toBeCloseTo(ordinary * 3, 12);
    expect(resolveProjectileHitDamage(definition.attack, transport)).toBeCloseTo(
      ordinary * 3 * 1.5,
      12,
    );
  });
});
