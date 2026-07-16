import { describe, expect, test } from "bun:test";
import { resolveAttackDamage } from "../../../ecs/combat";
import { GATE_C_UNIT_REFERENCES } from "../../unit-references/gate-c";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import { UNIT_CLASS_HUMAN, UNIT_CLASS_MYTH, type UnitTypeStats } from "../../unit-type-schema";
import { definition } from "./hippolyta";

const reference = GATE_C_UNIT_REFERENCES.find(({ key }) => key === definition.key);
if (reference === undefined) throw new Error("Hippolyta must have a Gate C reference.");

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

describe("Hippolyta unit pack", () => {
  test("matches the integration-owned Classic candidate reference", () => {
    expect(() => validateDefinitionAgainstReference(definition, reference)).not.toThrow();
  });

  test("authors the Greek hero and relic lifecycle instead of inferring it from identity", () => {
    expect(definition.hero).toEqual({
      trainLimit: 1,
      relicCapacity: 1,
      relicPickupRange: 1,
      relicDropOffRange: 1,
    });
  });

  test("keeps the shipped Classic sight and aggro range rather than the Trial values", () => {
    expect(definition.lineOfSight).toBe(24);
    expect(definition.attack.aggroRange).toBe(24);
    expect(definition.attack.range).toBe(18);
  });

  test("pins the source-evidenced arrow release and flight contract", () => {
    expect(definition.attack).toMatchObject({
      kind: "projectile",
      cooldownTicks: 40,
      launchDelayTicks: 24,
      accuracy: 0.9,
      trackRating: 6,
      projectile: {
        type: 0,
        speed: 30,
        lifespanTicks: 40,
        collisionRadius: 0.1,
      },
    });
  });

  test("applies the seven-times myth counter after target armor", () => {
    const ordinaryDamage = resolveAttackDamage(
      definition.attack,
      target(UNIT_CLASS_HUMAN, [0, 0.3, 0]),
    );
    const mythDamage = resolveAttackDamage(definition.attack, target(UNIT_CLASS_MYTH, [0, 0.3, 0]));
    expect(ordinaryDamage).toBeCloseTo(6.3, 8);
    expect(mythDamage).toBeCloseTo(44.1, 8);
  });
});
