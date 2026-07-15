import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { AGE_CLASSICAL, NO_GOD } from "../../../ecs/progression";
import { UNIT_TYPES } from "../../generated/unit-types";
import { TYPE_GREEK_STABLE, TYPE_HIPPIKON, TYPE_HOPLITE } from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_ARCHER,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
} from "../../unit-type-schema";
import { definition } from "./hippikon";

describe("Greek Hippikon unit pack", () => {
  test("pins the Classic base-unit contract and frozen producer assignment", () => {
    expect(definition).toEqual({
      id: TYPE_HIPPIKON,
      key: "greek-hippikon",
      label: "Hippikon",
      culture: CULTURE_GREEK,
      classes: UNIT_CLASS_HUMAN | UNIT_CLASS_CAVALRY | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE,
      maxHp: 150,
      lineOfSight: 8,
      movementSpeed: 5.5,
      armor: [0.1, 0.25, 0.99],
      attack: {
        kind: "melee",
        damage: [10, 0, 0],
        range: 0.3,
        aggroRange: 8,
        cooldownTicks: 30,
        bonuses: [{ requiredClasses: UNIT_CLASS_ARCHER, multiplier: 1.25 }],
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.7,
      collidesWithProjectiles: true,
      footprint: 0,
      costFood: 40,
      costWood: 0,
      costGold: 80,
      costFavor: 0,
      buildTicks: 15 * 20,
      populationCost: 3,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_CLASSICAL,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_GREEK_STABLE],
      trainedAt: [{ type: TYPE_GREEK_STABLE, commandSlot: 0 }],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("applies its multiplier only to archers", () => {
    const hoplite = UNIT_TYPES[TYPE_HOPLITE]!;
    const archerTarget = { ...hoplite, classes: hoplite.classes | UNIT_CLASS_ARCHER };

    expect(resolveMeleeDamage(definition.attack, hoplite)).toBeCloseTo(6.5, 8);
    expect(resolveMeleeDamage(definition.attack, archerTarget)).toBeCloseTo(8.125, 8);
  });
});
