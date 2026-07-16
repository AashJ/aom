import { describe, expect, test } from "bun:test";
import { UNIT_TYPES } from "./generated/unit-types";
import {
  UNIT_ROSTER,
  validateRosterReservations,
  validateUnitRoster,
  type UnitRosterEntry,
} from "./unit-roster";
import { RESERVED_ROSTER_UNIT_TYPE_IDS, TYPE_GREEK_FORTRESS } from "./unit-type-ids";
import {
  validateDefinitionAgainstReference,
  trialComparableExpected,
  validateUnitReferences,
  type UnitReferenceSpec,
} from "./unit-reference-schema";
import { UNIT_REFERENCE_SPECS } from "./unit-references";

function asCandidateReference(reference: UnitReferenceSpec): UnitReferenceSpec {
  if (reference.source.stage !== "final") return reference;
  const { stage: _stage, finalRulesetReview: _review, ...source } = reference.source;
  return {
    ...reference,
    source: { ...source, stage: "candidate" },
  } as UnitReferenceSpec;
}

describe("agentic unit references", () => {
  test("keeps the roster structurally valid and uniquely owned", () => {
    expect(() => validateUnitRoster(UNIT_ROSTER)).not.toThrow();
  });

  test("registers every reserved Greek and Egyptian unit workcell exactly once", () => {
    expect(UNIT_ROSTER).toHaveLength(RESERVED_ROSTER_UNIT_TYPE_IDS.length);
    expect(UNIT_ROSTER.map((entry) => entry.id)).toEqual([...RESERVED_ROSTER_UNIT_TYPE_IDS]);
    expect(() =>
      validateRosterReservations(UNIT_ROSTER, RESERVED_ROSTER_UNIT_TYPE_IDS),
    ).not.toThrow();
  });

  test("models compound family prerequisites without collapsing them to one gate", () => {
    const centaur = UNIT_ROSTER.find((entry) => entry.key === "greek-centaur")!;
    expect(centaur.gates).toEqual(["B", "C", "D"]);
    expect(centaur.foundationLanes).toEqual([
      "serial-projectile-foundation",
      "serial-myth-unit-lifecycle",
      "serial-special-actions",
    ]);
    expect(centaur.blocker).toStartWith("Gates B+C+D:");

    expect(() => validateUnitRoster([{ ...centaur, gates: ["C", "B", "D"] }])).toThrow(
      "gates must be unique and ordered",
    );
  });

  test("keeps Classic Greek Fortress columns disjoint before hero fan-out", () => {
    const fortressSlot = (key: string): number => {
      const lane = UNIT_ROSTER.find((entry) => entry.key === key);
      const relationship = lane?.trainedAt?.find(
        (candidate) => candidate.type === TYPE_GREEK_FORTRESS,
      );
      if (relationship === undefined) throw new Error(`${key} has no Greek Fortress assignment.`);
      return relationship.commandSlot;
    };

    expect([
      fortressSlot("greek-jason"),
      fortressSlot("greek-odysseus"),
      fortressSlot("greek-heracles"),
      fortressSlot("greek-bellerophon"),
    ]).toEqual([0, 1, 2, 3]);
    expect([
      fortressSlot("greek-theseus"),
      fortressSlot("greek-hippolyta"),
      fortressSlot("greek-atalanta"),
      fortressSlot("greek-polyphemus"),
    ]).toEqual([0, 1, 2, 3]);
    expect([
      fortressSlot("greek-ajax"),
      fortressSlot("greek-chiron"),
      fortressSlot("greek-achilles"),
      fortressSlot("greek-perseus"),
    ]).toEqual([0, 1, 2, 3]);
    expect([fortressSlot("greek-petrobolos"), fortressSlot("greek-helepolis")]).toEqual([4, 5]);
    expect([
      fortressSlot("greek-myrmidon"),
      fortressSlot("greek-hetairoi"),
      fortressSlot("greek-gastraphetes"),
    ]).toEqual([6, 6, 6]);
  });

  test("opens only ordinary Greek heroes with complete candidate references", () => {
    const ready = UNIT_ROSTER.filter((entry) => entry.status === "ready");
    expect(ready.map((entry) => entry.key)).toEqual([
      "greek-odysseus",
      "greek-heracles",
      "greek-theseus",
      "greek-hippolyta",
      "greek-atalanta",
      "greek-ajax",
      "greek-chiron",
    ]);
    for (const lane of ready) {
      const reference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === lane.key);
      expect(reference?.family).toBe("hero");
      expect(reference?.source.stage).toBe("candidate");
    }
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

  test("requires candidate references for ready lanes and final references after integration", () => {
    const lane = UNIT_ROSTER.find((entry) => entry.key === "greek-hoplite")!;
    const finalReference = UNIT_REFERENCE_SPECS.find((entry) => entry.key === lane.key)!;
    const candidateReference = asCandidateReference(finalReference);
    if (lane.trainedAt === null) throw new Error("Hoplite assignment is not frozen.");
    const readyLane: UnitRosterEntry = {
      ...lane,
      status: "ready",
      blocker: null,
      trainedAt: lane.trainedAt,
    };

    expect(() => validateUnitReferences([readyLane], [candidateReference])).not.toThrow();
    expect(() => validateUnitReferences([lane], [candidateReference])).toThrow(
      "requires a final reference spec",
    );
    expect(() => validateUnitReferences([readyLane], [finalReference])).toThrow(
      "requires a candidate reference spec",
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
    if (reference.family !== "ordinary-melee") throw new Error("Hoplite reference is not melee.");
    const driftedReference = {
      ...reference,
      expected: { ...reference.expected, requiredGod: reference.expected.requiredGod + 1 },
    };
    expect(() => validateUnitReferences([lane], [driftedReference])).toThrow(
      "does not match its canonical roster lane",
    );
  });

  test("models projectile delivery independently from hero identity", () => {
    const lane = UNIT_ROSTER.find((entry) => entry.key === "greek-jason")!;
    const hero = UNIT_REFERENCE_SPECS.find((entry) => entry.key === lane.key)!;
    const projectile = UNIT_REFERENCE_SPECS.find(
      (entry) => entry.family === "ordinary-projectile" && entry.source.culture === "greek",
    );
    if (hero.family !== "hero" || projectile?.family !== "ordinary-projectile") {
      throw new Error("Projectile hero contract fixtures are unavailable.");
    }
    const {
      stage: _stage,
      finalRulesetReview: _review,
      ...projectileSourceFields
    } = projectile.source;
    const projectileSource = { ...projectileSourceFields, stage: "candidate" as const };

    const rangedHero = {
      ...hero,
      attackKind: "projectile" as const,
      source: projectileSource,
      expected: { ...hero.expected, attack: projectile.expected.attack },
    };
    const rangedDefinition = {
      ...UNIT_TYPES[lane.id]!,
      attack: projectile.expected.attack,
    };
    if (lane.trainedAt === null) throw new Error("Jason assignment is not frozen.");
    const readyLane: UnitRosterEntry = {
      ...lane,
      status: "ready",
      blocker: null,
      trainedAt: lane.trainedAt,
    };

    expect(() => validateUnitReferences([readyLane], [rangedHero])).not.toThrow();
    expect(() => validateDefinitionAgainstReference(rangedDefinition, rangedHero)).not.toThrow();
    expect(trialComparableExpected(rangedHero)["attack.accuracy"]).toBe(
      projectile.expected.attack.accuracy,
    );
  });
});
