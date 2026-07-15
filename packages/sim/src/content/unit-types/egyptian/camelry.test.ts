import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { AGE_HEROIC, NO_GOD } from "../../../ecs/progression";
import { UNIT_TYPES } from "../../generated/unit-types";
import { TYPE_CAMELRY, TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, TYPE_HOPLITE } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
} from "../../unit-type-schema";
import { definition } from "./camelry";

describe("Egyptian Camelry unit pack", () => {
  test("pins the Classic base-unit contract and frozen producer assignment", () => {
    expect(definition).toEqual({
      id: TYPE_CAMELRY,
      key: "egyptian-camelry",
      label: "Camelry",
      culture: CULTURE_EGYPTIAN,
      classes:
        UNIT_CLASS_HUMAN |
        UNIT_CLASS_CAVALRY |
        UNIT_CLASS_MILITARY |
        UNIT_CLASS_MELEE |
        UNIT_CLASS_NON_GREEK_UNIT,
      maxHp: 125,
      lineOfSight: 16,
      movementSpeed: 6,
      armor: [0.15, 0.3, 0.99],
      attack: {
        kind: "melee",
        damage: [8, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [{ requiredClasses: UNIT_CLASS_CAVALRY, multiplier: 1.75 }],
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.7,
      footprint: 0,
      costFood: 50,
      costWood: 0,
      costGold: 70,
      costFavor: 0,
      buildTicks: 9 * 20,
      populationCost: 3,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_HEROIC,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_EGYPTIAN_MIGDOL_STRONGHOLD],
      trainedAt: [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 1 }],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("applies its 1.75x multiplier only to cavalry", () => {
    const hoplite = UNIT_TYPES[TYPE_HOPLITE]!;
    const cavalryTarget = { ...hoplite, classes: hoplite.classes | UNIT_CLASS_CAVALRY };

    expect(resolveMeleeDamage(definition.attack, hoplite)).toBeCloseTo(5.2, 8);
    expect(resolveMeleeDamage(definition.attack, cavalryTarget)).toBeCloseTo(9.1, 8);
  });
});
