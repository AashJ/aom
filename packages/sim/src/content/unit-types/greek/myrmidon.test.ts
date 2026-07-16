import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { AGE_MYTHIC, GOD_ZEUS } from "../../../ecs/progression";
import { UNIT_TYPES } from "../../generated/unit-types";
import {
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_MYRMIDON,
  TYPE_SPEARMAN,
  TYPE_TREE,
} from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_NON_GREEK_UNIT,
} from "../../unit-type-schema";
import { definition as axemanDefinition } from "../egyptian/axeman";
import { definition as laborerDefinition } from "../egyptian/laborer";
import { definition } from "./myrmidon";

describe("Greek Myrmidon unit pack", () => {
  test("pins the Titans direct-hit melee and frozen producer contract", () => {
    expect(definition).toEqual({
      id: TYPE_MYRMIDON,
      key: "greek-myrmidon",
      label: "Myrmidon",
      culture: CULTURE_GREEK,
      classes: UNIT_CLASS_HUMAN | UNIT_CLASS_INFANTRY | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE,
      maxHp: 110,
      lineOfSight: 16,
      movementSpeed: 4,
      armor: [0.45, 0.2, 0.99],
      attack: {
        kind: "melee",
        damage: [10, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [
          {
            target: { kind: "classes", classes: UNIT_CLASS_NON_GREEK_UNIT },
            multiplier: 1.5,
          },
        ],
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.49,
      collidesWithProjectiles: true,
      footprint: 0,
      costFood: 70,
      costWood: 0,
      costGold: 50,
      costFavor: 0,
      buildTicks: 14 * 20,
      populationCost: 2,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_MYTHIC,
      requiredGod: GOD_ZEUS,
      prerequisiteBuildings: [TYPE_GREEK_FORTRESS],
      trainedAt: [
        { type: TYPE_GREEK_MILITARY_ACADEMY, commandSlot: 2 },
        { type: TYPE_GREEK_FORTRESS, commandSlot: 6 },
      ],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("applies its bonus only to Classic LogicalTypeNonGreekUnit members", () => {
    const spearman = UNIT_TYPES[TYPE_SPEARMAN]!;
    const egyptianBuilding = UNIT_TYPES[TYPE_EGYPTIAN_BARRACKS]!;
    const neutralResource = UNIT_TYPES[TYPE_TREE]!;

    expect(resolveMeleeDamage(definition.attack, spearman)).toBeCloseTo(9, 8);
    expect(resolveMeleeDamage(definition.attack, axemanDefinition)).toBeCloseTo(6, 8);
    expect(resolveMeleeDamage(definition.attack, laborerDefinition)).toBeCloseTo(7.5, 8);
    expect(resolveMeleeDamage(definition.attack, egyptianBuilding)).toBeCloseTo(10, 8);
    expect(resolveMeleeDamage(definition.attack, neutralResource)).toBeCloseTo(10, 8);
  });
});
