import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { AGE_MYTHIC, GOD_POSEIDON } from "../../../ecs/progression";
import { UNIT_TYPES } from "../../generated/unit-types";
import {
  TYPE_GREEK_FORTRESS,
  TYPE_GREEK_STABLE,
  TYPE_HETAIROI,
  TYPE_HOPLITE,
} from "../../unit-type-ids";
import {
  CULTURE_GREEK,
  NO_TYPE_RELATIONSHIPS,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
} from "../../unit-type-schema";
import { definition } from "./hetairoi";

describe("Greek Hetairoi unit pack", () => {
  test("pins the Classic base-unit contract and both frozen producer assignments", () => {
    expect(definition).toEqual({
      id: TYPE_HETAIROI,
      key: "greek-hetairoi",
      label: "Hetairoi",
      culture: CULTURE_GREEK,
      classes: UNIT_CLASS_HUMAN | UNIT_CLASS_CAVALRY | UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE,
      maxHp: 110,
      lineOfSight: 16,
      movementSpeed: 4.8,
      armor: [0.1, 0.4, 0.99],
      attack: {
        kind: "melee",
        damage: [8, 0, 0],
        range: 0.3,
        aggroRange: 16,
        cooldownTicks: 30,
        bonuses: [{ requiredClasses: UNIT_CLASS_BUILDING, multiplier: 3.5 }],
      },
      isStatic: false,
      resource: -1,
      bodyRadius: 0.7,
      footprint: 0,
      costFood: 60,
      costWood: 0,
      costGold: 100,
      costFavor: 0,
      buildTicks: 17 * 20,
      populationCost: 3,
      popBonus: 0,
      trainExitOffset: 0,
      isDropsite: false,
      requiredAge: AGE_MYTHIC,
      requiredGod: GOD_POSEIDON,
      prerequisiteBuildings: [TYPE_GREEK_FORTRESS],
      trainedAt: [
        { type: TYPE_GREEK_STABLE, commandSlot: 2 },
        { type: TYPE_GREEK_FORTRESS, commandSlot: 2 },
      ],
      builtBy: NO_TYPE_RELATIONSHIPS,
    });
  });

  test("applies its multiplier only to buildings", () => {
    expect(resolveMeleeDamage(definition.attack, UNIT_TYPES[TYPE_HOPLITE]!)).toBeCloseTo(5.2, 8);
    expect(resolveMeleeDamage(definition.attack, UNIT_TYPES[TYPE_GREEK_STABLE]!)).toBeCloseTo(
      16.8,
      8,
    );
  });
});
