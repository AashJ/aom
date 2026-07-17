import type { UnitRosterEntry } from "./unit-roster";
import {
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
  type Attack,
  type ArmorProfile,
  type DamageBonus,
  type DamageBonusTarget,
  type HeroTraits,
  type MeleeAttack,
  type MeleeAttackCycle,
  type ProjectileAttack,
  type SpecialAttack,
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
  | "attack.cycleVariants"
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
  | "specialAttack.damage"
  | "specialAttack.range"
  | "specialAttack.bonuses"
  | "specialAttack.rechargeTicks"
  | "specialAttack.validTargets"
  | "specialAttack.radius"
  | "specialAttack.damageRelations"
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
  | readonly DamageBonus[]
  | readonly DamageBonusTarget[]
  | readonly MeleeAttackCycle[];

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

export interface SpecialImpactEvidence extends ProjectileReleaseEvidence {
  readonly durationTicks: number;
}

export interface MeleeAttackCycleEvidence extends SpecialImpactEvidence {
  readonly model: string;
  readonly modelSha256: string;
}

export interface SpecialParticleEvidence {
  readonly key: string;
  readonly prtFile: string;
  readonly prtSha256: string;
  readonly textureFile: string;
  readonly textureSha256: string;
  readonly animationSelector: string;
  readonly attachmentNode: string;
  readonly loop: true;
  readonly syncWithAttackAnimation: true;
  readonly maxParticles: number;
  readonly particleLifetimeSeconds: number;
  readonly emissionStartSeconds: number;
  readonly emissionDurationSeconds: number;
  readonly emissionRatePerSecond: number;
  readonly emissionRateVariance: number;
  readonly initialVelocity: number;
  readonly spreader: "point";
  readonly offAxisDegrees: number;
  readonly offPlaneDegrees: number;
  readonly blend: "additive";
  readonly baseScale: number;
  readonly scaleCycleSeconds: number;
  readonly opacityStages: readonly (readonly [number, number, number, number])[];
  readonly scaleStages: readonly (readonly [number, number, number, number])[];
  readonly textureWidth: number;
  readonly textureHeight: number;
  // Explicit source-to-runtime mapping. The source verifier pins the raw PRT
  // fields above; catalog generation consumes this complete presentation shape
  // instead of duplicating a hand-picked subset in the authored media pack.
  readonly presentation: {
    readonly spreader: "radial-horizontal";
    readonly heightOffset: number;
    readonly scaleFadeInSeconds: number;
    readonly peakOpacity: number;
    readonly opacityVariance: number;
    readonly opacityFadeInSeconds: number;
    readonly opacityFadeOutSeconds: number;
  };
}

export interface AreaSpecialEvidence {
  readonly executableSha256: string;
  readonly handlerAddress: `0x${string}`;
  readonly center: "attacker";
  readonly falloff: "linear";
}

export interface ThrownTargetReactionEvidence {
  readonly executableSha256: string;
  readonly goreHandlerAddress: `0x${string}`;
  readonly thrownActionAddress: `0x${string}`;
  readonly distance: readonly [base: number, randomRange: number];
  readonly maxVelocity: readonly [base: number, randomRange: number];
  readonly maxHeight: readonly [base: number, randomRange: number];
  readonly bounces: readonly [base: number, randomRange: number];
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

type SpecialUnitReferenceSourceCommon = UnitReferenceSourceCommon<
  UnitAssetInventoryEvidence & {
    readonly specialImpact: SpecialImpactEvidence;
    readonly meleeAttackCycles?: readonly MeleeAttackCycleEvidence[];
    readonly specialParticles?: readonly SpecialParticleEvidence[];
  }
> & {
  readonly targetReaction?: ThrownTargetReactionEvidence;
  readonly areaSpecial?: AreaSpecialEvidence;
};

export type SpecialUnitReferenceSource =
  | (SpecialUnitReferenceSourceCommon & { readonly stage: "candidate" })
  | (SpecialUnitReferenceSourceCommon & {
      readonly stage: "final";
      readonly finalRulesetReview: {
        readonly commit: string;
        readonly scope: string;
      };
    });

interface UnitReferenceCommonExpected {
  readonly label: string;
  readonly culture: number;
  readonly classes: number;
  readonly hero: HeroTraits | null;
  readonly specialAttack: SpecialAttack | null;
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
export type HeroUnitReferenceExpected<A extends Attack = Attack> = Omit<
  OrdinaryUnitReferenceExpected<A>,
  "hero"
> & {
  readonly hero: HeroTraits;
};

type OrdinaryExpectedInput<A extends Attack> = Omit<
  OrdinaryUnitReferenceExpected<A>,
  | "hero"
  | "specialAttack"
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
    hero: null,
    specialAttack: null,
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

type HeroExpectedInput<A extends Attack> = Omit<
  HeroUnitReferenceExpected<A>,
  | "specialAttack"
  | "workRange"
  | "isStatic"
  | "resource"
  | "collidesWithProjectiles"
  | "footprint"
  | "popBonus"
  | "trainExitOffset"
  | "isDropsite"
  | "builtBy"
> & { readonly hero: HeroTraits };

export function heroUnitExpected<A extends Attack>(
  expected: HeroExpectedInput<A>,
): HeroUnitReferenceExpected<A> {
  return {
    ...expected,
    specialAttack: null,
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

interface HeroUnitReferenceSpecBase {
  readonly family: "hero";
  readonly id: number;
  readonly key: string;
}

export interface MeleeHeroUnitReferenceSpec extends HeroUnitReferenceSpecBase {
  readonly attackKind: "melee";
  readonly source: UnitReferenceSource;
  readonly expected: HeroUnitReferenceExpected<MeleeAttack>;
}

export interface ProjectileHeroUnitReferenceSpec extends HeroUnitReferenceSpecBase {
  readonly attackKind: "projectile";
  readonly source: ProjectileUnitReferenceSource;
  readonly expected: HeroUnitReferenceExpected<ProjectileAttack>;
}

export type HeroUnitReferenceSpec = MeleeHeroUnitReferenceSpec | ProjectileHeroUnitReferenceSpec;

export type MythUnitReferenceExpected = Omit<
  OrdinaryUnitReferenceExpected<MeleeAttack>,
  "specialAttack"
> & {
  readonly specialAttack: SpecialAttack;
};

export interface MythUnitReferenceSpec {
  readonly family: "myth";
  readonly attackKind: "melee";
  readonly id: number;
  readonly key: string;
  readonly source: SpecialUnitReferenceSource;
  readonly expected: MythUnitReferenceExpected;
}

type MythExpectedInput = Omit<
  MythUnitReferenceExpected,
  | "hero"
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

export function mythUnitExpected(expected: MythExpectedInput): MythUnitReferenceExpected {
  return {
    ...expected,
    hero: null,
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

export type UnitReferenceSpec =
  | MeleeUnitReferenceSpec
  | ProjectileUnitReferenceSpec
  | HeroUnitReferenceSpec
  | MythUnitReferenceSpec;

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
    ...(attack.kind === "melee" && attack.cycleVariants !== undefined
      ? { "attack.cycleVariants": attack.cycleVariants }
      : {}),
  };

  const primaryFields =
    reference.expected.attack.kind === "melee"
      ? attackFields
      : {
          ...attackFields,
          "attack.accuracy": reference.expected.attack.accuracy,
          "attack.accuracyReductionFactor": reference.expected.attack.accuracyReductionFactor,
          "attack.aimBonus": reference.expected.attack.aimBonus,
          "attack.spreadFactor": reference.expected.attack.spreadFactor,
          "attack.maxSpread": reference.expected.attack.maxSpread,
          "attack.trackRating": reference.expected.attack.trackRating,
          "attack.unintentionalDamageMultiplier":
            reference.expected.attack.unintentionalDamageMultiplier,
          "attack.projectile.speed": reference.expected.attack.projectile.speed,
          "attack.projectile.lifespanTicks": reference.expected.attack.projectile.lifespanTicks,
          "attack.projectile.collisionRadius": reference.expected.attack.projectile.collisionRadius,
        };

  const special = reference.expected.specialAttack;
  if (special === null) return primaryFields;
  return {
    ...primaryFields,
    "specialAttack.damage": special.damage,
    "specialAttack.range": special.range,
    "specialAttack.bonuses": special.bonuses,
    "specialAttack.rechargeTicks": special.rechargeTicks,
    "specialAttack.validTargets": special.validTargets,
    ...(special.kind === "charged-area-pulse"
      ? {
          "specialAttack.radius": special.radius,
          "specialAttack.damageRelations": special.damageRelations,
        }
      : {}),
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
    if (
      reference.family === "ordinary-projectile" ||
      (reference.family === "hero" && reference.attackKind === "projectile")
    ) {
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
    if (reference.family === "myth") {
      const impact = reference.source.assetInventory.specialImpact;
      if (
        !/^[0-9a-f]{64}$/.test(impact.sha256) ||
        impact.action.trim().length === 0 ||
        !Number.isInteger(impact.durationTicks) ||
        impact.durationTicks < 1 ||
        !Number.isFinite(impact.fraction) ||
        impact.fraction < 0 ||
        impact.fraction >= 1 ||
        Math.round(impact.fraction * impact.durationTicks) !==
          reference.expected.specialAttack.impactDelayTicks ||
        impact.durationTicks !== reference.expected.specialAttack.actionTicks
      ) {
        throw new Error(`${reference.key} has invalid special-impact evidence.`);
      }

      const expectedReaction =
        reference.expected.specialAttack.kind === "charged-melee"
          ? reference.expected.specialAttack.targetReaction
          : undefined;
      const reactionEvidence = reference.source.targetReaction;
      if (expectedReaction?.kind === "thrown") {
        if (
          reactionEvidence === undefined ||
          !/^[0-9a-f]{64}$/.test(reactionEvidence.executableSha256) ||
          !/^0x[0-9a-f]+$/i.test(reactionEvidence.goreHandlerAddress) ||
          !/^0x[0-9a-f]+$/i.test(reactionEvidence.thrownActionAddress) ||
          !structurallyEqual(reactionEvidence.distance, [
            expectedReaction.distanceBase,
            expectedReaction.distanceRandomRange,
          ]) ||
          !structurallyEqual(reactionEvidence.maxVelocity, [
            expectedReaction.maxVelocityBase,
            expectedReaction.maxVelocityRandomRange,
          ]) ||
          !structurallyEqual(reactionEvidence.maxHeight, [
            expectedReaction.maxHeightBase,
            expectedReaction.maxHeightRandomRange,
          ]) ||
          !structurallyEqual(reactionEvidence.bounces, [
            expectedReaction.bounceBase,
            expectedReaction.bounceRandomRange,
          ])
        ) {
          throw new Error(`${reference.key} has invalid thrown target-reaction evidence.`);
        }
      } else if (reactionEvidence !== undefined) {
        throw new Error(`${reference.key} has unused thrown target-reaction evidence.`);
      }

      const areaEvidence = reference.source.areaSpecial;
      if (reference.expected.specialAttack.kind === "charged-area-pulse") {
        if (
          areaEvidence === undefined ||
          !/^[0-9a-f]{64}$/.test(areaEvidence.executableSha256) ||
          !/^0x[0-9a-f]+$/i.test(areaEvidence.handlerAddress) ||
          areaEvidence.center !== "attacker" ||
          areaEvidence.falloff !== reference.expected.specialAttack.falloff
        ) {
          throw new Error(`${reference.key} has invalid area-special evidence.`);
        }
      } else if (areaEvidence !== undefined) {
        throw new Error(`${reference.key} has unused area-special evidence.`);
      }

      const particleEvidence = reference.source.assetInventory.specialParticles;
      if (particleEvidence !== undefined) {
        const particleKeys = new Set<string>();
        if (
          particleEvidence.length === 0 ||
          particleEvidence.some((particle) => {
            const presentation = particle.presentation;
            if (particleKeys.has(particle.key)) return true;
            particleKeys.add(particle.key);
            return (
              particle.key.trim().length === 0 ||
              !/^[0-9a-f]{64}$/.test(particle.prtSha256) ||
              !/^[0-9a-f]{64}$/.test(particle.textureSha256) ||
              particle.prtFile.trim().length === 0 ||
              particle.textureFile.trim().length === 0 ||
              particle.animationSelector.trim().length === 0 ||
              particle.attachmentNode.trim().length === 0 ||
              !Number.isInteger(particle.maxParticles) ||
              particle.maxParticles < 1 ||
              particle.particleLifetimeSeconds <= 0 ||
              particle.emissionStartSeconds < 0 ||
              particle.emissionDurationSeconds <= 0 ||
              particle.emissionRatePerSecond <= 0 ||
              particle.emissionRateVariance < 0 ||
              particle.initialVelocity < 0 ||
              particle.textureWidth < 1 ||
              particle.textureHeight < 1 ||
              particle.opacityStages.length === 0 ||
              particle.scaleStages.length === 0 ||
              !Number.isFinite(presentation.heightOffset) ||
              presentation.heightOffset < 0 ||
              !Number.isFinite(presentation.scaleFadeInSeconds) ||
              presentation.scaleFadeInSeconds <= 0 ||
              !Number.isFinite(presentation.peakOpacity) ||
              presentation.peakOpacity <= 0 ||
              presentation.peakOpacity > 1 ||
              !Number.isFinite(presentation.opacityVariance) ||
              presentation.opacityVariance < 0 ||
              presentation.opacityVariance >= presentation.peakOpacity ||
              presentation.peakOpacity + presentation.opacityVariance > 1 ||
              !Number.isFinite(presentation.opacityFadeInSeconds) ||
              presentation.opacityFadeInSeconds <= 0 ||
              !Number.isFinite(presentation.opacityFadeOutSeconds) ||
              presentation.opacityFadeOutSeconds <= 0
            );
          })
        ) {
          throw new Error(`${reference.key} has invalid particle evidence.`);
        }
      }

      const expectedCycles = reference.expected.attack.cycleVariants;
      const cycleEvidence = reference.source.assetInventory.meleeAttackCycles;
      if (expectedCycles !== undefined) {
        if (
          cycleEvidence === undefined ||
          cycleEvidence.length !== expectedCycles.length ||
          cycleEvidence.some(
            (evidence, index) =>
              !/^[0-9a-f]{64}$/.test(evidence.sha256) ||
              !/^[0-9a-f]{64}$/.test(evidence.modelSha256) ||
              evidence.action !== "attack" ||
              evidence.tag !== "Attack" ||
              evidence.model.trim().length === 0 ||
              evidence.durationTicks !== expectedCycles[index]!.actionTicks ||
              Math.round(evidence.fraction * evidence.durationTicks) !==
                expectedCycles[index]!.impactDelayTicks,
          )
        ) {
          throw new Error(`${reference.key} has invalid variable melee-cycle evidence.`);
        }
      } else if (cycleEvidence !== undefined) {
        throw new Error(`${reference.key} has unused variable melee-cycle evidence.`);
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
    hero: definition.hero ?? null,
    specialAttack: definition.specialAttack ?? null,
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
    case "hero": {
      if (definition.attack?.kind !== reference.attackKind || definition.hero === undefined) {
        throw new Error(`${definition.key} reference requires a ${reference.attackKind} hero.`);
      }
      break;
    }
    case "ordinary-projectile": {
      if (definition.attack?.kind !== "projectile") {
        throw new Error(`${definition.key} reference requires a projectile attack.`);
      }
      break;
    }
    case "myth": {
      if (definition.attack?.kind !== "melee" || definition.specialAttack === undefined) {
        throw new Error(`${definition.key} reference requires a charged melee myth unit.`);
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
