import type { UnitRosterEntry } from "./unit-roster";
import {
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
  type ArmorProfile,
  type DamageBonus,
  type MeleeAttack,
  type TypeCommandRelationship,
  type UnitTypeStats,
} from "./unit-type-schema";

export type ReferenceCulture = "greek" | "egyptian";

export type TrialComparableField =
  | "label"
  | "classes"
  | "maxHp"
  | "lineOfSight"
  | "movementSpeed"
  | "armor"
  | "meleeAttack.damage"
  | "meleeAttack.range"
  | "meleeAttack.bonuses"
  | "bodyRadius"
  | "cost"
  | "buildTicks"
  | "populationCost"
  | "requiredAge";

export type TrialComparableValue = string | number | readonly number[] | readonly DamageBonus[];

export interface TrialFidelityDelta {
  readonly field: TrialComparableField;
  readonly trial: TrialComparableValue;
  readonly final: TrialComparableValue;
  readonly reason: string;
}

export interface UnitReferenceSource {
  readonly culture: ReferenceCulture;
  readonly ruleset: "Age of Mythology Extended Edition / The Titans";
  readonly trialProto: {
    readonly sha256: string;
    readonly unitId: number;
    readonly unitName: string;
  };
  readonly assetInventory: {
    readonly sha256: string;
    readonly rosterName: string;
    readonly rootAnimation: string;
  };
  readonly trialDeltas: readonly TrialFidelityDelta[];
  readonly finalRulesetReview: {
    readonly commit: string;
    readonly scope: string;
  };
}

export interface MeleeUnitReferenceExpected {
  readonly label: string;
  readonly culture: number;
  readonly classes: number;
  readonly maxHp: number;
  readonly lineOfSight: number;
  readonly movementSpeed: number;
  readonly workRange: number | null;
  readonly armor: ArmorProfile;
  readonly meleeAttack: MeleeAttack;
  readonly isStatic: boolean;
  readonly resource: number;
  readonly bodyRadius: number;
  readonly footprint: number;
  readonly cost: readonly [food: number, wood: number, gold: number, favor: number];
  readonly buildTicks: number;
  readonly populationCost: number;
  readonly popBonus: number;
  readonly trainExitOffset: number;
  readonly isDropsite: boolean;
  readonly requiredAge: number;
  readonly requiredGod: number;
  readonly prerequisiteBuildings: readonly number[];
  readonly trainedAt: readonly TypeCommandRelationship[];
  readonly builtBy: readonly TypeCommandRelationship[];
}

type MeleeExpectedInput = Omit<
  MeleeUnitReferenceExpected,
  | "workRange"
  | "isStatic"
  | "resource"
  | "footprint"
  | "popBonus"
  | "trainExitOffset"
  | "isDropsite"
  | "builtBy"
>;

export function meleeUnitExpected(expected: MeleeExpectedInput): MeleeUnitReferenceExpected {
  return {
    ...expected,
    workRange: null,
    isStatic: false,
    resource: -1,
    footprint: 0,
    popBonus: 0,
    trainExitOffset: 0,
    isDropsite: false,
    builtBy: [],
  };
}

export interface MeleeUnitReferenceSpec {
  readonly family: "ordinary-melee";
  readonly id: number;
  readonly key: string;
  readonly source: UnitReferenceSource;
  readonly expected: MeleeUnitReferenceExpected;
}

export type UnitReferenceSpec = MeleeUnitReferenceSpec;

export function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    );
  }
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && structurallyEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

export function trialComparableExpected(
  expected: MeleeUnitReferenceExpected,
): Readonly<Record<TrialComparableField, TrialComparableValue>> {
  return {
    label: expected.label,
    classes: expected.classes,
    maxHp: expected.maxHp,
    lineOfSight: expected.lineOfSight,
    movementSpeed: expected.movementSpeed,
    armor: expected.armor,
    "meleeAttack.damage": expected.meleeAttack.damage,
    "meleeAttack.range": expected.meleeAttack.range,
    "meleeAttack.bonuses": expected.meleeAttack.bonuses,
    bodyRadius: expected.bodyRadius,
    cost: expected.cost,
    buildTicks: expected.buildTicks,
    populationCost: expected.populationCost,
    requiredAge: expected.requiredAge,
  };
}

function relationshipsMatch(
  left: readonly TypeCommandRelationship[],
  right: readonly TypeCommandRelationship[],
): boolean {
  return structurallyEqual(left, right);
}

export function validateUnitReferences(
  roster: readonly UnitRosterEntry[],
  references: readonly UnitReferenceSpec[],
): void {
  const rosterByKey = new Map(roster.map((lane) => [lane.key, lane]));
  const referenceIds = new Set<number>();
  const referencesByKey = new Map<string, UnitReferenceSpec>();

  for (const reference of references) {
    if (referenceIds.has(reference.id)) {
      throw new Error(`Duplicate unit reference id ${reference.id}.`);
    }
    if (referencesByKey.has(reference.key)) {
      throw new Error(`Duplicate unit reference key ${reference.key}.`);
    }
    referenceIds.add(reference.id);
    referencesByKey.set(reference.key, reference);

    const sourceCulture = reference.source.culture === "greek" ? CULTURE_GREEK : CULTURE_EGYPTIAN;
    if (reference.expected.culture !== sourceCulture) {
      throw new Error(`Unit reference ${reference.key} has inconsistent source culture.`);
    }
    if (
      !/^[0-9a-f]{40}$/.test(reference.source.finalRulesetReview.commit) ||
      reference.source.finalRulesetReview.scope.trim().length === 0
    ) {
      throw new Error(`Unit reference ${reference.key} has invalid final-ruleset review evidence.`);
    }
    const deltaFields = new Set<TrialComparableField>();
    for (const delta of reference.source.trialDeltas) {
      if (deltaFields.has(delta.field) || delta.reason.trim().length === 0) {
        throw new Error(`Unit reference ${reference.key} has invalid Trial delta evidence.`);
      }
      deltaFields.add(delta.field);
    }

    const lane = rosterByKey.get(reference.key);
    if (lane === undefined) throw new Error(`Unit reference ${reference.key} has no roster lane.`);
    if (
      reference.id !== lane.id ||
      reference.family !== lane.family ||
      reference.expected.label !== lane.label ||
      reference.expected.culture !== lane.culture ||
      reference.expected.requiredGod !== lane.requiredGod ||
      lane.trainedAt === null ||
      !relationshipsMatch(reference.expected.trainedAt, lane.trainedAt)
    ) {
      throw new Error(`Unit reference ${reference.key} does not match its canonical roster lane.`);
    }
  }

  for (const lane of roster) {
    if (lane.status !== "blocked" && !referencesByKey.has(lane.key)) {
      throw new Error(`Open unit lane ${lane.lane} has no integration-owned reference spec.`);
    }
  }
}

function meleeDefinitionSnapshot(definition: UnitTypeStats): MeleeUnitReferenceExpected {
  if (definition.attack?.kind !== "melee") {
    throw new Error(`${definition.key} reference requires a melee attack.`);
  }
  return {
    label: definition.label,
    culture: definition.culture,
    classes: definition.classes,
    maxHp: definition.maxHp,
    lineOfSight: definition.lineOfSight,
    movementSpeed: definition.movementSpeed,
    workRange: definition.workRange ?? null,
    armor: definition.armor,
    meleeAttack: definition.attack,
    isStatic: definition.isStatic,
    resource: definition.resource,
    bodyRadius: definition.bodyRadius,
    footprint: definition.footprint,
    cost: [definition.costFood, definition.costWood, definition.costGold, definition.costFavor],
    buildTicks: definition.buildTicks,
    populationCost: definition.populationCost,
    popBonus: definition.popBonus,
    trainExitOffset: definition.trainExitOffset,
    isDropsite: definition.isDropsite,
    requiredAge: definition.requiredAge,
    requiredGod: definition.requiredGod,
    prerequisiteBuildings: definition.prerequisiteBuildings,
    trainedAt: definition.trainedAt,
    builtBy: definition.builtBy,
  };
}

export function validateDefinitionAgainstReference(
  definition: UnitTypeStats,
  reference: UnitReferenceSpec,
): void {
  if (definition.id !== reference.id || definition.key !== reference.key) {
    throw new Error(
      `${reference.key} reference identity ${reference.id} does not match ${definition.key} (${definition.id}).`,
    );
  }

  switch (reference.family) {
    case "ordinary-melee": {
      const actual = meleeDefinitionSnapshot(definition);
      if (!structurallyEqual(actual, reference.expected)) {
        throw new Error(
          `${reference.key} differs from its integration-owned ${reference.family} reference spec.\nExpected: ${JSON.stringify(reference.expected)}\nActual:   ${JSON.stringify(actual)}`,
        );
      }
      return;
    }
  }
}
