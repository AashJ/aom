import { describe, expect, test } from "bun:test";
import { resolveDamage, resolveProjectileHitDamage } from "../../../ecs/combat";
import { PROJECTILE_CATAPULT_STONE } from "../../../ecs/projectiles";
import { UNIT_TYPES } from "../../generated/unit-types";
import { UNIT_REFERENCE_SPECS } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { TYPE_CATAPULT, TYPE_EGYPTIAN_SIEGE_WORKS, TYPE_HOPLITE } from "../../unit-type-ids";
import { UNIT_CLASS_SHIP } from "../../unit-type-schema";
import { definition } from "./catapult";

describe("Egyptian Catapult unit pack", () => {
  test("matches the integration-owned candidate Classic reference", () => {
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === definition.key);
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("pins the Classic four-second siege shot and production assignment", () => {
    expect(definition).toMatchObject({
      id: TYPE_CATAPULT,
      classes: 528,
      maxHp: 115,
      lineOfSight: 40,
      movementSpeed: 2.4,
      armor: [0.3, 0.9, 0.9],
      costWood: 200,
      costGold: 200,
      buildTicks: 480,
      populationCost: 3,
      prerequisiteBuildings: [TYPE_EGYPTIAN_SIEGE_WORKS],
      trainedAt: [{ type: TYPE_EGYPTIAN_SIEGE_WORKS, commandSlot: 1 }],
      attack: {
        kind: "projectile",
        damage: [0, 10, 50],
        range: 28,
        minimumRange: 10,
        cooldownTicks: 80,
        launchDelayTicks: 6,
        autoAcquireBuildings: true,
        projectile: { type: PROJECTILE_CATAPULT_STONE, speed: 20, lifespanTicks: 40 },
      },
    });
    expect(definition.attack).not.toHaveProperty("impactArea");
  });

  test("converts the displayed DPS into one four-second hit and applies the ship bonus", () => {
    const hoplite = UNIT_TYPES[TYPE_HOPLITE]!;
    expect(resolveProjectileHitDamage(definition.attack, hoplite)).toBeCloseTo(
      resolveDamage(definition.attack, hoplite) * 4,
      10,
    );
    expect(
      resolveProjectileHitDamage(definition.attack, {
        ...hoplite,
        classes: hoplite.classes | UNIT_CLASS_SHIP,
      }),
    ).toBeCloseTo(resolveProjectileHitDamage(definition.attack, hoplite) * 2.5, 10);
  });
});
