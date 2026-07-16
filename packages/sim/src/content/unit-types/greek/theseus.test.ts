import { describe, expect, test } from "bun:test";
import { resolveMeleeDamage } from "../../../ecs/combat";
import { GATE_C_UNIT_REFERENCES } from "../../unit-references/gate-c";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { UNIT_CLASS_HUMAN, UNIT_CLASS_MYTH, type UnitTypeStats } from "../../unit-type-schema";
import { definition } from "./theseus";

const reference = GATE_C_UNIT_REFERENCES.find((entry) => entry.key === "greek-theseus");
if (reference === undefined) throw new Error("Theseus requires a Gate C reference.");

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

describe("Theseus unit pack", () => {
  test("matches the integration-owned Classic candidate reference", () => {
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("authors the Greek hero and relic lifecycle", () => {
    expect(definition.hero).toEqual({
      trainLimit: 1,
      relicCapacity: 1,
      relicPickupRange: 1,
      relicDropOffRange: 1,
    });
  });

  test("pins the original twenty-tick melee cycle", () => {
    expect(definition.attack.cooldownTicks).toBe(20);
  });

  test("applies the seven-times myth counter after target armor", () => {
    expect(resolveMeleeDamage(definition.attack, target(UNIT_CLASS_HUMAN, [0.25, 0, 0]))).toBe(
      6.75,
    );
    expect(resolveMeleeDamage(definition.attack, target(UNIT_CLASS_MYTH, [0.25, 0, 0]))).toBe(
      47.25,
    );
  });
});
