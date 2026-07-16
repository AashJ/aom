import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { GATE_C_UNIT_REFERENCES } from "../../unit-references/gate-c";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { UNIT_CLASS_HUMAN, UNIT_CLASS_MYTH, type UnitTypeStats } from "../../unit-type-schema";
import { definition } from "./heracles";

function target(classes: number, armor: readonly [number, number, number]): UnitTypeStats {
  return {
    ...definition,
    id: 0,
    key: "test-target",
    label: "Test target",
    classes,
    hero: undefined,
    armor,
    attack: null,
  };
}

describe("Heracles unit pack", () => {
  test("matches the integration-owned Classic candidate reference", () => {
    expect(() =>
      validateDefinitionAgainstReference(definition, GATE_C_UNIT_REFERENCES[2]),
    ).not.toThrow();
  });

  test("authors the Greek hero and relic lifecycle instead of inferring it from identity", () => {
    expect(definition.hero).toEqual({
      trainLimit: 1,
      relicCapacity: 1,
      relicPickupRange: 1,
      relicDropOffRange: 1,
    });
  });

  test("applies the seven-times myth counter after target armor", () => {
    if (definition.attack.kind !== "melee") throw new Error("Heracles must be melee.");
    expect(resolveMeleeDamage(definition.attack, target(UNIT_CLASS_HUMAN, [0.25, 0, 0]))).toBe(7.5);
    expect(resolveMeleeDamage(definition.attack, target(UNIT_CLASS_MYTH, [0.25, 0, 0]))).toBe(52.5);
  });
});
