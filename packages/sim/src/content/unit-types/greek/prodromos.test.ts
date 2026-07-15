import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { AGE_HEROIC, NO_GOD } from "../../../ecs/progression";
import { UNIT_TYPES } from "../../generated/unit-types";
import { TYPE_GREEK_STABLE, TYPE_HOPLITE, TYPE_PRODROMOS } from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
} from "../../unit-type-schema";
import { definition } from "./prodromos";

describe("Greek Prodromos unit pack", () => {
  test("pins the Classic base-unit contract and frozen producer assignment", () => {
    expect(definition).toEqual({
      id: TYPE_PRODROMOS,
      key: "greek-prodromos",
      label: "Prodromos",
      culture: CULTURE_GREEK,
      classes: UNIT_CLASS_HUMAN | UNIT_CLASS_CAVALRY | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE,
      maxHp: 120,
      lineOfSight: 16,
      movementSpeed: 6,
      armor: [0.2, 0.1, 0.99],
      attack: {
        kind: "melee",
        damage: [6, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [{ target: { kind: "classes", classes: UNIT_CLASS_CAVALRY }, multiplier: 3 }],
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.7,
      collidesWithProjectiles: true,
      footprint: 0,
      costFood: 70,
      costWood: 0,
      costGold: 40,
      costFavor: 0,
      buildTicks: 10 * 20,
      populationCost: 3,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_HEROIC,
      requiredGod: NO_GOD,
      prerequisiteBuildings: [TYPE_GREEK_STABLE],
      trainedAt: [{ type: TYPE_GREEK_STABLE, commandSlot: 1 }],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("applies its three-times multiplier only to cavalry", () => {
    const hoplite = UNIT_TYPES[TYPE_HOPLITE]!;
    const cavalryTarget = { ...hoplite, classes: hoplite.classes | UNIT_CLASS_CAVALRY };

    expect(resolveMeleeDamage(definition.attack, hoplite)).toBeCloseTo(3.9, 8);
    expect(resolveMeleeDamage(definition.attack, cavalryTarget)).toBeCloseTo(11.7, 8);
  });
});
