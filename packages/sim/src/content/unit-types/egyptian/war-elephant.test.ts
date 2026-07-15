import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { AGE_HEROIC, NO_GOD } from "../../../ecs/progression";
import { UNIT_TYPES } from "../../generated/unit-types";
import {
  TYPE_EGYPTIAN_MIGDOL_STRONGHOLD,
  TYPE_GREEK_HOUSE,
  TYPE_HOPLITE,
  TYPE_WAR_ELEPHANT,
} from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
} from "../../unit-type-schema";
import { definition } from "./war-elephant";

describe("Egyptian War Elephant unit pack", () => {
  test("pins the Classic base-unit contract and frozen producer assignment", () => {
    expect(definition).toEqual({
      id: TYPE_WAR_ELEPHANT,
      key: "egyptian-war-elephant",
      label: "War Elephant",
      culture: CULTURE_EGYPTIAN,
      classes:
        UNIT_CLASS_HUMAN |
        UNIT_CLASS_CAVALRY |
        UNIT_CLASS_MILITARY |
        UNIT_CLASS_MELEE |
        UNIT_CLASS_NON_GREEK_UNIT,
      maxHp: 450,
      lineOfSight: 16,
      movementSpeed: 2.9,
      armor: [0.1, 0.4, 0.99],
      meleeAttack: {
        damage: [12, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [{ requiredClasses: UNIT_CLASS_BUILDING, multiplier: 3 }],
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.99,
      footprint: 0,
      costFood: 180,
      costWood: 0,
      costGold: 70,
      costFavor: 0,
      buildTicks: 15 * 20,
      populationCost: 5,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_HEROIC,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_EGYPTIAN_MIGDOL_STRONGHOLD],
      trainedAt: [{ type: TYPE_EGYPTIAN_MIGDOL_STRONGHOLD, commandSlot: 2 }],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("applies its 3x multiplier only to buildings", () => {
    const hoplite = UNIT_TYPES[TYPE_HOPLITE]!;
    const house = UNIT_TYPES[TYPE_GREEK_HOUSE]!;

    expect(resolveMeleeDamage(definition.meleeAttack, hoplite)).toBeCloseTo(7.8, 8);
    expect(resolveMeleeDamage(definition.meleeAttack, house)).toBeCloseTo(36, 8);
  });
});
