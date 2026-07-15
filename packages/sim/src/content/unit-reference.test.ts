import { describe, expect, test } from "bun:test";
import { UNIT_TYPES } from "./generated/unit-types";
import { UNIT_ROSTER, validateUnitRoster, type UnitRosterEntry } from "./unit-roster";
import {
  validateDefinitionAgainstReference,
  validateUnitReferences,
  type UnitReferenceSpec,
} from "./unit-reference-schema";
import { UNIT_REFERENCE_SPECS } from "./unit-references";

describe("agentic unit references", () => {
  test("keeps the roster structurally valid and uniquely owned", () => {
    expect(() => validateUnitRoster(UNIT_ROSTER)).not.toThrow();
  });

  test("pins every implemented lane to an integration-owned fidelity spec", () => {
    const referencesByKey = new Map<string, UnitReferenceSpec>(
      UNIT_REFERENCE_SPECS.map((reference) => [reference.key, reference]),
    );

    for (const lane of UNIT_ROSTER) {
      if (lane.status !== "implemented") continue;
      const reference = referencesByKey.get(lane.key);
      expect(reference, `${lane.key} has no reference spec`).toBeDefined();
      expect(() =>
        validateDefinitionAgainstReference(UNIT_TYPES[lane.id]!, reference!),
      ).not.toThrow();
    }
  });

  test("does not leave orphaned reference specs outside the roster", () => {
    const rosterKeys = new Set(UNIT_ROSTER.map((entry) => entry.key));
    for (const reference of UNIT_REFERENCE_SPECS) expect(rosterKeys.has(reference.key)).toBeTrue();
  });

  test("fails when authored gameplay drifts from the independent reference", () => {
    const reference = UNIT_REFERENCE_SPECS[0]!;
    const drifted = { ...UNIT_TYPES[reference.id]!, footprint: 1 };
    expect(() => validateDefinitionAgainstReference(drifted, reference)).toThrow(
      "differs from its integration-owned ordinary-melee reference spec",
    );
  });

  test("refuses to open a lane before assignment and reference ownership are frozen", () => {
    const blocked = UNIT_ROSTER.find((entry) => entry.status === "blocked")!;
    const invalidReadyLane = {
      ...blocked,
      status: "ready" as const,
      blocker: null,
      trainedAt: [],
    };
    expect(() => validateUnitReferences([invalidReadyLane], [])).toThrow(
      "has no integration-owned reference spec",
    );
  });

  test("rejects cross-lane ownership and producer-slot collisions", () => {
    const first = UNIT_ROSTER.find((entry) => entry.key === "greek-hoplite")!;
    const second = UNIT_ROSTER.find((entry) => entry.key === "greek-hypaspist")!;
    expect(() => validateUnitRoster([first, { ...second, ownedPaths: first.ownedPaths }])).toThrow(
      "overlapping ownership",
    );
    if (first.trainedAt === null) throw new Error("Hoplite assignment is not frozen.");
    const conflictingAssignment: UnitRosterEntry = {
      ...second,
      status: "implemented",
      blocker: null,
      trainedAt: first.trainedAt,
    };
    expect(() => validateUnitRoster([first, conflictingAssignment])).toThrow(
      "conflict at producer",
    );
  });

  test("rejects a reference that disagrees with the canonical assignment", () => {
    const lane = UNIT_ROSTER.find((entry) => entry.key === "greek-hoplite")!;
    const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === lane.key)!;
    const driftedReference = {
      ...reference,
      expected: { ...reference.expected, requiredGod: reference.expected.requiredGod + 1 },
    };
    expect(() => validateUnitReferences([lane], [driftedReference])).toThrow(
      "does not match its canonical roster lane",
    );
  });
});
