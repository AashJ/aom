import { describe, expect, test } from "bun:test";
import { AGE_HEROIC, NO_GOD } from "../../../ecs/progression";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { UNIT_TYPES } from "../../generated/unit-types";
import { TYPE_GREEK_MILITARY_ACADEMY, TYPE_HOPLITE, TYPE_HYPASPIST } from "../../unit-type-ids";
import { CULTURE_NORSE, UNIT_CLASS_HERO, UNIT_CLASS_INFANTRY } from "../../unit-type-schema";
import { definition } from "./hypaspist";

describe("Greek Hypaspist unit pack", () => {
  test("pins the Titans direct-hit melee and infantry-counter contract", () => {
    expect(definition).toMatchObject({
      id: TYPE_HYPASPIST,
      key: "greek-hypaspist",
      label: "Hypaspist",
      maxHp: 95,
      lineOfSight: 16,
      movementSpeed: 4.3,
      armor: [0.35, 0.1, 0.99],
      costFood: 60,
      costGold: 25,
      buildTicks: 9 * 20,
      populationCost: 2,
      requiredAge: AGE_HEROIC,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_GREEK_MILITARY_ACADEMY],
      trainedAt: [{ type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 1 }],
      meleeAttack: {
        damage: [5, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [
          { requiredClasses: UNIT_CLASS_INFANTRY, multiplier: 4.25 },
          { requiredClasses: UNIT_CLASS_HERO, requiredCulture: CULTURE_NORSE, multiplier: 4.25 },
        ],
      },
    });

    const infantryTarget = UNIT_TYPES[TYPE_HOPLITE]!;
    const nonInfantryTarget = {
      ...infantryTarget,
      classes: infantryTarget.classes & ~UNIT_CLASS_INFANTRY,
    };
    const norseHeroTarget = {
      ...nonInfantryTarget,
      culture: CULTURE_NORSE,
      classes: nonInfantryTarget.classes | UNIT_CLASS_HERO,
    };
    expect(resolveMeleeDamage(definition.meleeAttack, infantryTarget)).toBeCloseTo(13.8125, 8);
    expect(resolveMeleeDamage(definition.meleeAttack, nonInfantryTarget)).toBeCloseTo(3.25, 8);
    expect(resolveMeleeDamage(definition.meleeAttack, norseHeroTarget)).toBeCloseTo(13.8125, 8);
  });
});
