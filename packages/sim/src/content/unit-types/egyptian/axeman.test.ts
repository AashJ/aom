import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { AGE_CLASSICAL, NO_GOD } from "../../../ecs/progression";
import { UNIT_TYPES } from "../../generated/unit-types";
import { TYPE_AXEMAN, TYPE_EGYPTIAN_BARRACKS, TYPE_HOPLITE } from "../../unit-type-ids";
import {
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
  CULTURE_NORSE,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_HERO,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
} from "../../unit-type-schema";
import { definition } from "./axeman";

describe("Egyptian Axeman unit pack", () => {
  test("pins the Classic base-unit contract and frozen producer assignment", () => {
    expect(definition).toEqual({
      id: TYPE_AXEMAN,
      key: "egyptian-axeman",
      label: "Axeman",
      culture: CULTURE_EGYPTIAN,
      classes: UNIT_CLASS_HUMAN | UNIT_CLASS_INFANTRY | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE,
      maxHp: 70,
      lineOfSight: 16,
      movementSpeed: 4.3,
      armor: [0.4, 0.05, 0.99],
      attack: {
        kind: "melee",
        damage: [5, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [
          { target: { kind: "classes", classes: UNIT_CLASS_INFANTRY }, multiplier: 4 },
          {
            target: {
              kind: "classes",
              classes: UNIT_CLASS_HERO,
              requiredCulture: CULTURE_NORSE,
            },
            multiplier: 4,
          },
        ],
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.49,
      collidesWithProjectiles: true,
      footprint: 0,
      costFood: 40,
      costWood: 0,
      costGold: 30,
      costFavor: 0,
      buildTicks: 10 * 20,
      populationCost: 2,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_CLASSICAL,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_EGYPTIAN_BARRACKS],
      trainedAt: [{ type: TYPE_EGYPTIAN_BARRACKS, commandSlot: 1 }],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("applies its four-times multiplier to infantry and Norse heroes", () => {
    const hoplite = UNIT_TYPES[TYPE_HOPLITE]!;
    const nonInfantryTarget = {
      ...hoplite,
      classes: hoplite.classes & ~UNIT_CLASS_INFANTRY,
    };
    const norseHeroTarget = {
      ...nonInfantryTarget,
      culture: CULTURE_NORSE,
      classes: nonInfantryTarget.classes | UNIT_CLASS_HERO,
    };
    const greekHeroTarget = {
      ...norseHeroTarget,
      culture: CULTURE_GREEK,
    };

    expect(resolveMeleeDamage(definition.attack, hoplite)).toBeCloseTo(13, 8);
    expect(resolveMeleeDamage(definition.attack, nonInfantryTarget)).toBeCloseTo(3.25, 8);
    expect(resolveMeleeDamage(definition.attack, norseHeroTarget)).toBeCloseTo(13, 8);
    expect(resolveMeleeDamage(definition.attack, greekHeroTarget)).toBeCloseTo(3.25, 8);
  });
});
