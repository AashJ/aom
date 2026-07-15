import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { UNIT_TYPES } from "../../generated/unit-types";
import { TYPE_HOPLITE, TYPE_SPEARMAN } from "../../unit-type-ids";
import { definition } from "./hoplite";

describe("Greek Hoplite unit pack", () => {
  test("pins the Classic direct-hit melee contract", () => {
    expect(definition).toMatchObject({
      id: TYPE_HOPLITE,
      key: "greek-hoplite",
      maxHp: 115,
      movementSpeed: 4.2,
      armor: [0.35, 0.15, 0.99],
      costFood: 50,
      costGold: 40,
      buildTicks: 14 * 20,
      populationCost: 2,
      attack: {
        kind: "melee",
        damage: [8, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
      },
    });
    expect(resolveMeleeDamage(definition.attack, UNIT_TYPES[TYPE_SPEARMAN]!)).toBeCloseTo(4.8, 8);
  });
});
