import { describe, expect, test } from "bun:test";
import { AGE_HEROIC, NO_GOD } from "../../../ecs/progression";
import { PROJECTILE_ARROW } from "../../../ecs/projectiles";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  UNIT_CLASS_ARCHER,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
} from "../../unit-type-schema";
import { TYPE_CHARIOT_ARCHER, TYPE_EGYPTIAN_MIGDOL_STRONGHOLD } from "../../unit-type-ids";
import { definition } from "./chariot-archer";

describe("Egyptian Chariot Archer unit pack", () => {
  test("pins the complete Classic projectile contract and frozen producer slot", () => {
    expect(definition).toMatchObject({
      id: TYPE_CHARIOT_ARCHER,
      key: "egyptian-chariot-archer",
      classes:
        UNIT_CLASS_HUMAN | UNIT_CLASS_MILITARY | UNIT_CLASS_ARCHER | UNIT_CLASS_NON_GREEK_UNIT,
      maxHp: 90,
      lineOfSight: 24,
      movementSpeed: 5.3,
      armor: [0.3, 0.2, 0.99],
      costWood: 100,
      costGold: 40,
      buildTicks: 6 * 20,
      populationCost: 3,
      requiredAge: AGE_HEROIC,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_EGYPTIAN_MIGDOL_STRONGHOLD],
      trainedAt: [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 0 }],
      attack: {
        kind: "projectile",
        damage: [0, 8.5, 0],
        range: 20,
        aggroRange: 24,
        cooldownTicks: 30,
        launchDelayTicks: 19,
        accuracy: 0.8,
        accuracyReductionFactor: 1.5,
        aimBonus: 15,
        spreadFactor: 0.25,
        maxSpread: 5,
        trackRating: 5,
        unintentionalDamageMultiplier: 0.3,
        projectile: {
          type: PROJECTILE_ARROW,
          speed: 30,
          lifespanTicks: 40,
          collisionRadius: 0.1,
        },
      },
    });

    const reference = unitReferenceEntry(definition.key);
    expect(reference?.source.stage).toBe("candidate");
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("preserves the Classic non-cavalry archer classification", () => {
    expect(definition.classes & UNIT_CLASS_ARCHER).toBe(UNIT_CLASS_ARCHER);
    expect(definition.classes & UNIT_CLASS_NON_GREEK_UNIT).toBe(UNIT_CLASS_NON_GREEK_UNIT);
    expect(definition.classes & UNIT_CLASS_CAVALRY).toBe(0);
  });
});
