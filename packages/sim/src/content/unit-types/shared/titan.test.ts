import { describe, expect, test } from "bun:test";
import { resolveDamage } from "../../../ecs/combat";
import {
  TYPE_EGYPTIAN_HOUSE,
  TYPE_EGYPTIAN_TITAN,
  TYPE_HOPLITE,
} from "../../unit-type-ids";
import { UNIT_TYPES } from "../../generated/unit-types";
import { definition as egyptianTitan } from "../egyptian/titan";
import { definition as greekTitan } from "../greek/titan";

describe("Classic Titan unit contract", () => {
  test("all cultures share the expansion's published combat statistics", () => {
    for (const titan of [greekTitan, egyptianTitan]) {
      expect(titan).toMatchObject({
        maxHp: 7_000,
        lineOfSight: 25,
        movementSpeed: 3.75,
        armor: [0.9, 0.95, 0.9],
        healable: false,
        populationCost: 20,
        attack: { damage: [70, 0, 70], cooldownTicks: 70 },
      });
    }
  });

  test("applies the original 2x human, 5x building, and 20x Titan bonuses", () => {
    const attack = greekTitan.attack!;
    const human = resolveDamage(attack, UNIT_TYPES[TYPE_HOPLITE]!);
    const building = resolveDamage(attack, UNIT_TYPES[TYPE_EGYPTIAN_HOUSE]!);
    const titan = resolveDamage(attack, UNIT_TYPES[TYPE_EGYPTIAN_TITAN]!);
    expect(human).toBeGreaterThan(0);
    expect(building).toBeCloseTo(700, 8);
    // AbstractTitan is also a myth unit, so Classic composes the 2x myth and
    // 20x Titan multipliers before applying the opposing Titan's armor.
    expect(titan).toBeCloseTo(560, 8);
    expect(attack.bonuses.map((bonus) => bonus.multiplier)).toEqual([2, 2, 5, 20]);
  });
});
