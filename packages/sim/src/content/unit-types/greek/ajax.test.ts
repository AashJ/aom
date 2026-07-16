import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { GATE_C_UNIT_REFERENCES } from "../../unit-references/gate-c";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { UNIT_CLASS_HUMAN, UNIT_CLASS_MYTH, type UnitTypeStats } from "../../unit-type-schema";
import { definition } from "./ajax";

const reference = GATE_C_UNIT_REFERENCES.find((candidate) => candidate.key === definition.key);

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

describe("Ajax unit pack", () => {
  test("matches the integration-owned Classic candidate reference", () => {
    expect(reference).toBeDefined();
    expect(() => validateDefinitionAgainstReference(definition, reference!)).not.toThrow();
  });

  test("authors the Greek hero and relic lifecycle instead of inferring it from identity", () => {
    expect(definition.hero).toEqual({
      trainLimit: 1,
      relicCapacity: 1,
      relicPickupRange: 1,
      relicDropOffRange: 1,
    });
  });

  test("pins the Classic twenty-tick attack cycle and seven-times myth counter", () => {
    expect(definition.attack.cooldownTicks).toBe(20);
    expect(
      resolveMeleeDamage(definition.attack, target(UNIT_CLASS_HUMAN, [0.3, 0, 0])),
    ).toBeCloseTo(6.3, 8);
    expect(resolveMeleeDamage(definition.attack, target(UNIT_CLASS_MYTH, [0.3, 0, 0]))).toBeCloseTo(
      44.1,
      8,
    );
  });
});
