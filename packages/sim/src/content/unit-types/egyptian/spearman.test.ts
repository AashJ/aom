import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { UNIT_TYPES } from "../../generated/unit-types";
import { TYPE_HOPLITE, TYPE_SPEARMAN } from "../../unit-type-ids";
import { UNIT_CLASS_CAVALRY, UNIT_CLASS_SIEGE } from "../../unit-type-schema";
import { definition } from "./spearman";

describe("Egyptian Spearman unit pack", () => {
  test("pins the Classic direct-hit melee and cavalry counter contract", () => {
    expect(definition).toMatchObject({
      id: TYPE_SPEARMAN,
      key: "egyptian-spearman",
      maxHp: 70,
      movementSpeed: 5,
      armor: [0.4, 0.2, 0.99],
      costFood: 50,
      costGold: 20,
      buildTicks: 9 * 20,
      populationCost: 2,
      attack: {
        kind: "melee",
        damage: [7, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [
          { requiredClasses: UNIT_CLASS_CAVALRY, multiplier: 1.1 },
          { requiredClasses: UNIT_CLASS_SIEGE, multiplier: 2 },
        ],
      },
    });

    const hoplite = UNIT_TYPES[TYPE_HOPLITE]!;
    const cavalryTarget = { ...hoplite, classes: hoplite.classes | UNIT_CLASS_CAVALRY };
    const siegeTarget = { ...hoplite, classes: hoplite.classes | UNIT_CLASS_SIEGE };
    expect(resolveMeleeDamage(definition.attack, hoplite)).toBeCloseTo(4.55, 8);
    expect(resolveMeleeDamage(definition.attack, cavalryTarget)).toBeCloseTo(5.005, 8);
    expect(resolveMeleeDamage(definition.attack, siegeTarget)).toBeCloseTo(9.1, 8);
  });
});
