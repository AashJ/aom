import type { UnitRosterEntry } from "./unit-roster";
import {
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
  type Attack,
  type ArmorProfile,
  type DamageBonus,
  type MeleeAttack,
  type ProjectileAttack,
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
  | "attack.damage"
  | "attack.range"
  | "attack.bonuses"
  | "attack.accuracy"
  | "attack.accuracyReductionFactor"
  | "attack.aimBonus"
  | "attack.spreadFactor"
  | "attack.maxSpread"
  | "attack.trackRating"
  | "attack.unintentionalDamageMultiplier"
  | "attack.projectile.speed"
  | "attack.projectile.lifespanTicks"
  | "attack.projectile.collisionRadius"
  | "bodyRadius"
  | "collidesWithProjectiles"
  | "cost"
  | "buildTicks"
  | "populationCost"
  | "requiredAge";

export type TrialComparableValue =
  | string
  | number
  | boolean
  | readonly number[]
  | readonly DamageBonus[];

export interface TrialFidelityDelta {
  readonly field: TrialComparableField;
  readonly trial: TrialComparableValue;
  readonly final: TrialComparableValue;
  readonly reason: string;
}

export interface UnitAssetInventoryEvidence {
  readonly sha256: string;
  readonly rosterName: string;
  readonly rootAnimation: string;
}

export interface ProjectileReleaseEvidence {
  readonly sha256: string;
  readonly action: string;
  readonly tag: "Attack";
  readonly fraction: number;
}

interface UnitReferenceSourceCommon<A extends UnitAssetInventoryEvidence> {
  readonly culture: ReferenceCulture;
  readonly ruleset: "Age of Mythology Classic" | "Age of Mythology Extended Edition / The Titans";
  readonly trialProto: {
    readonly sha256: string;
    readonly unitId: number;
    readonly unitName: string;
  };
  readonly assetInventory: A;
  readonly trialDeltas: readonly TrialFidelityDelta[];
}

export type UnitReferenceSource<A extends UnitAssetInventoryEvidence = UnitAssetInventoryEvidence> =
    | (UnitReferenceSourceCommon<A> & {
        readonly stage: "candidate";
      })
    | (UnitReferenceSourceCommon<A> & {
        readonly stage: "final";
        readonly finalRulesetReview: {
          readonly commit: string;
          readonly scope: string;
        };
      });

export type ProjectileUnitReferenceSource = UnitReferenceSource<
  UnitAssetInventoryEvidence & {
    readonly attackRelease: ProjectileReleaseEvidence;
  }
>;

interface UnitReferenceCommonExpected {
  readonly label: string;
  readonly culture: number;
  readonly classes: number;
  readonly maxHp: number;
  readonly lineOfSight: number;
  readonly movementSpeed: number;
  readonly workRange: number | null;
  readonly armor: ArmorProfile;
  readonly isStatic: boolean;
  readonly resource: number;
  readonly bodyRadius: number;
  readonly collidesWithProjectiles: boolean;
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

export interface OrdinaryUnitReferenceExpected<
  A extends Attack,
> extends UnitReferenceCommonExpected {
  readonly attack: A;
}

export type MeleeUnitReferenceExpected = OrdinaryUnitReferenceExpected<MeleeAttack>;
export type ProjectileUnitReferenceExpected = OrdinaryUnitReferenceExpected<ProjectileAttack>;

type OrdinaryExpectedInput<A extends Attack> = Omit<
  OrdinaryUnitReferenceExpected<A>,
  | "workRange"
  | "isStatic"
  | "resource"
  | "collidesWithProjectiles"
  | "footprint"
  | "popBonus"
  | "trainExitOffset"
  | "isDropsite"
  | "builtBy"
>;

export function ordinaryUnitExpected<A extends Attack>(
  expected: OrdinaryExpectedInput<A>,
): OrdinaryUnitReferenceExpected<A> {
  return {
    ...expected,
    workRange: null,
    isStatic: false,
    resource: -1,
    collidesWithProjectiles: true,
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

export interface ProjectileUnitReferenceSpec {
  readonly family: "ordinary-projectile";
  readonly id: number;
  readonly key: string;
  readonly source: ProjectileUnitReferenceSource;
  readonly expected: ProjectileUnitReferenceExpected;
}

export type UnitReferenceSpec = MeleeUnitReferenceSpec | ProjectileUnitReferenceSpec;

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
  reference: UnitReferenceSpec,
): Readonly<Partial<Record<TrialComparableField, TrialComparableValue>>> {
  const expected = reference.expected;
  const common = {
    label: expected.label,
    classes: expected.classes,
    maxHp: expected.maxHp,
    lineOfSight: expected.lineOfSight,
    movementSpeed: expected.movementSpeed,
    armor: expected.armor,
    bodyRadius: expected.bodyRadius,
    collidesWithProjectiles: expected.collidesWithProjectiles,
    cost: expected.cost,
    buildTicks: expected.buildTicks,
    populationCost: expected.populationCost,
    requiredAge: expected.requiredAge,
  };

  const attack = expected.attack;
  const attackFields = {
    ...common,
    "attack.damage": attack.damage,
    "attack.range": attack.range,
    "attack.bonuses": attack.bonuses,
  };

  if (reference.family === "ordinary-melee") return attackFields;
  return {
    ...attackFields,
    "attack.accuracy": reference.expected.attack.accuracy,
    "attack.accuracyReductionFactor": reference.expected.attack.accuracyReductionFactor,
    "attack.aimBonus": reference.expected.attack.aimBonus,
    "attack.spreadFactor": reference.expected.attack.spreadFactor,
    "attack.maxSpread": reference.expected.attack.maxSpread,
    "attack.trackRating": reference.expected.attack.trackRating,
    "attack.unintentionalDamageMultiplier": reference.expected.attack.unintentionalDamageMultiplier,
    "attack.projectile.speed": reference.expected.attack.projectile.speed,
    "attack.projectile.lifespanTicks": reference.expected.attack.projectile.lifespanTicks,
    "attack.projectile.collisionRadius": reference.expected.attack.projectile.collisionRadius,
  };
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
    if (reference.source.stage === "final") {
      if (
        !/^[0-9a-f]{40}$/.test(reference.source.finalRulesetReview.commit) ||
        reference.source.finalRulesetReview.scope.trim().length === 0
      ) {
        throw new Error(
          `Unit reference ${reference.key} has invalid final-ruleset review evidence.`,
        );
      }
    }
    const deltaFields = new Set<TrialComparableField>();
    for (const delta of reference.source.trialDeltas) {
      if (deltaFields.has(delta.field) || delta.reason.trim().length === 0) {
        throw new Error(`Unit reference ${reference.key} has invalid Trial delta evidence.`);
      }
      deltaFields.add(delta.field);
    }
    if (reference.family === "ordinary-projectile") {
      const release = reference.source.assetInventory.attackRelease;
      if (
        !/^[0-9a-f]{64}$/.test(release.sha256) ||
        release.action.trim().length === 0 ||
        !Number.isFinite(release.fraction) ||
        release.fraction < 0 ||
        release.fraction >= 1
      ) {
        throw new Error(`${reference.key} has invalid projectile release evidence.`);
      }
      if (
        Math.round(release.fraction * reference.expected.attack.cooldownTicks) !==
        reference.expected.attack.launchDelayTicks
      ) {
        throw new Error(`${reference.key} release evidence does not match launchDelayTicks.`);
      }
    }

    const lane = rosterByKey.get(reference.key);
    if (lane === undefined) throw new Error(`Unit reference ${reference.key} has no roster lane.`);
    if (lane.status === "blocked") {
      throw new Error(`Blocked unit lane ${lane.lane} cannot own a reference spec.`);
    }
    const requiredStage = lane.status === "ready" ? "candidate" : "final";
    if (reference.source.stage !== requiredStage) {
      throw new Error(
        `${lane.status === "ready" ? "Ready" : "Implemented"} unit lane ${lane.lane} requires a ${requiredStage} reference spec.`,
      );
    }
    if (
      reference.id !== lane.id ||
      reference.family !== lane.family ||
      reference.expected.label !== lane.label ||
      reference.expected.culture !== lane.culture ||
      reference.expected.requiredGod !== lane.requiredGod ||
      lane.trainedAt === null ||
      !structurallyEqual(reference.expected.trainedAt, lane.trainedAt)
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

function definitionSnapshot(definition: UnitTypeStats): OrdinaryUnitReferenceExpected<Attack> {
  if (definition.attack === null)
    throw new Error(`${definition.key} reference requires an attack.`);
  return {
    label: definition.label,
    culture: definition.culture,
    classes: definition.classes,
    maxHp: definition.maxHp,
    lineOfSight: definition.lineOfSight,
    movementSpeed: definition.movementSpeed,
    workRange: definition.workRange ?? null,
    armor: definition.armor,
    attack: definition.attack,
    isStatic: definition.isStatic,
    resource: definition.resource,
    bodyRadius: definition.bodyRadius,
    collidesWithProjectiles: definition.collidesWithProjectiles,
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

function assertNever(value: never): never {
  throw new Error(`Unsupported unit reference family ${JSON.stringify(value)}.`);
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
      if (definition.attack?.kind !== "melee") {
        throw new Error(`${definition.key} reference requires a melee attack.`);
      }
      break;
    }
    case "ordinary-projectile": {
      if (definition.attack?.kind !== "projectile") {
        throw new Error(`${definition.key} reference requires a projectile attack.`);
      }
      break;
    }
    default:
      return assertNever(reference);
  }

  const actual = definitionSnapshot(definition);
  if (!structurallyEqual(actual, reference.expected)) {
    throw new Error(
      `${reference.key} differs from its integration-owned ${reference.family} reference spec.\nExpected: ${JSON.stringify(reference.expected)}\nActual:   ${JSON.stringify(actual)}`,
    );
  }
}
