import type { UnitRosterEntry } from "./unit-roster";
import {
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_UNITS,
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
  type Attack,
  type ArmorProfile,
  type BeamAttack,
  type ConstructionTraits,
  type DamageBonus,
  type DamageBonusTarget,
  type DeathAreaAttack,
  type DeathReplacement,
  type GarrisonTraits,
  type GatherTraits,
  type HeroTraits,
  type MeleeAttack,
  type MeleeAttackCycle,
  type MovementDomain,
  type ProjectileAttack,
  type ResourceEatTraits,
  type SpecialAttack,
  type TradeTraits,
  type TrainingSiteTraits,
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
  | "attack.minimumRange"
  | "attack.autoAcquireBuildings"
  | "attack.bonuses"
  | "attack.cycleVariants"
  | "attack.accuracy"
  | "attack.accuracyReductionFactor"
  | "attack.aimBonus"
  | "attack.spreadFactor"
  | "attack.maxSpread"
  | "attack.trackRating"
  | "attack.unintentionalDamageMultiplier"
  | "attack.projectileCount"
  | "attack.projectile.speed"
  | "attack.projectile.lifespanTicks"
  | "attack.projectile.collisionRadius"
  | "buildingAttack.damage"
  | "buildingAttack.range"
  | "buildingAttack.bonuses"
  | "specialAttack.damage"
  | "specialAttack.minimumRange"
  | "specialAttack.range"
  | "specialAttack.bonuses"
  | "specialAttack.rechargeTicks"
  | "specialAttack.validTargets"
  | "specialAttack.invalidTargetConditions"
  | "specialAttack.effect"
  | "specialAttack.accuracy"
  | "specialAttack.accuracyReductionFactor"
  | "specialAttack.aimBonus"
  | "specialAttack.spreadFactor"
  | "specialAttack.maxSpread"
  | "specialAttack.trackRating"
  | "specialAttack.unintentionalDamageMultiplier"
  | "specialAttack.poisonFraction"
  | "specialAttack.projectileCount"
  | "specialAttack.projectile.speed"
  | "specialAttack.projectile.lifespanTicks"
  | "specialAttack.projectile.collisionRadius"
  | "specialAttack.radius"
  | "specialAttack.damageRelations"
  | "deathAreaAttack.damage"
  | "deathAreaAttack.radius"
  | "deathAreaAttack.bonuses"
  | "deathAreaAttack.damageRelations"
  | "trade.capacity"
  | "trade.interactionRange"
  | "trade.townCenterWorkRate"
  | "trade.townCenterMinimumRate"
  | "trade.incomeMultiplier"
  | "movementDomain"
  | "workRange"
  | "gather.capacity"
  | "gather.ratePerSecond"
  | "garrison.capacity"
  | "resourceEat.resourceTypes"
  | "resourceEat.consumePerSecond"
  | "construction.range"
  | "construction.ratePerSecond"
  | "bodyRadius"
  | "collidesWithUnits"
  | "collidesWithProjectiles"
  | "cost"
  | "buildTicks"
  | "regenerationPerSecond"
  | "lifespanTicks"
  | "populationCost"
  | "requiredAge";

export type TrialComparableValue =
  | null
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
  readonly meleeAttackCycles?: readonly MeleeAttackCycleEvidence[];
  readonly secondaryMeleeAttackCycles?: readonly MeleeAttackCycleEvidence[];
  readonly meleeImpactArea?: MeleeImpactAreaEvidence;
  readonly meleeCycleSelector?: {
    readonly kind: "experience";
    readonly thresholds: readonly number[];
    readonly killsPerVariant: number;
  };
  readonly attackParticles?: readonly AttackParticleEvidence[];
  readonly beamAttackCycle?: MeleeAttackCycleEvidence;
  readonly beamParticles?: readonly SpecialParticleEvidence[];
  readonly beamVisual?: {
    readonly beamAnimationFile: string;
    readonly beamAnimationSha256: string;
    readonly beamVisual: string;
    readonly headAnimationFile: string;
    readonly headAnimationSha256: string;
    readonly headVisual: string;
    readonly beamTextureFile: string;
    readonly beamTextureSha256: string;
    readonly beamTextureWidth: number;
    readonly beamTextureHeight: number;
    readonly headTextureFile: string;
    readonly headTextureSha256: string;
    readonly headTextureWidth: number;
    readonly headTextureHeight: number;
  };
  readonly jumpSpecial?: JumpSpecialEvidence;
  readonly pickupThrowSpecial?: PickupThrowSpecialEvidence;
}

export interface MeleeImpactAreaEvidence {
  readonly action: "HandAttack";
  readonly components: readonly {
    readonly type: "Hack" | "Pierce" | "Crush";
    readonly damage: number;
    readonly radius: number | null;
    readonly options: string | null;
  }[];
}

export type JumpSpecialEvidence = PhasedJumpSpecialEvidence | SingleCycleJumpSpecialEvidence;

export interface PhasedJumpSpecialEvidence {
  readonly kind: "phased";
  readonly sha256: string;
  readonly takeoffModel: string;
  readonly takeoffModelSha256: string;
  readonly takeoffTicks: number;
  readonly flightModel: string;
  readonly flightModelSha256: string;
  readonly flightSourceTicks: number;
  readonly flightRuntimeTicks: number;
  readonly landingModel: string;
  readonly landingModelSha256: string;
  readonly landingTicks: number;
  readonly impact: "landing-start";
}

export interface SingleCycleJumpSpecialEvidence {
  readonly kind: "single-cycle";
  readonly sha256: string;
  readonly model: string;
  readonly modelSha256: string;
  readonly durationTicks: number;
  readonly impact: "cycle-end";
}

export interface ProjectileReleaseEvidence {
  readonly sha256: string;
  readonly action: string;
  readonly tag: "Attack";
  readonly fraction: number;
  readonly durationTicks?: number;
  readonly model?: string;
  readonly modelSha256?: string;
  // Root animation selectors may override the raw projectile attack model.
  readonly modelDurationTicks?: number;
}

export interface SpecialImpactEvidence extends ProjectileReleaseEvidence {
  readonly durationTicks: number;
}

export interface PickupThrowSpecialEvidence {
  readonly sha256: string;
  readonly action: "Pickup";
  readonly model: string;
  readonly modelSha256: string;
  readonly durationTicks: number;
  readonly pickupTag: "Pickup";
  readonly pickupFraction: number;
  readonly throwTag: "Throw";
  readonly throwFraction: number;
}

export interface MeleeAttackCycleEvidence extends SpecialImpactEvidence {
  readonly model: string;
  readonly modelSha256: string;
  // Root animation selectors may override the raw model duration.
  readonly modelDurationTicks?: number;
}

export interface SpecialParticleEvidence {
  readonly key: string;
  readonly trigger?: "special-attack" | "beam-attack" | "poisoned-status";
  readonly prtFile: string;
  readonly prtSha256: string;
  readonly textureFile: string;
  readonly textureSha256: string;
  readonly additionalTextures?: readonly {
    readonly file: string;
    readonly sha256: string;
    readonly width: number;
    readonly height: number;
  }[];
  readonly appearanceWeights?: readonly number[];
  readonly animationSelector: string;
  readonly attachmentNode: string;
  readonly sourceAnimationFile?: string;
  readonly sourceAnimationSha256?: string;
  readonly sourceAnimationBinding?: "connect" | "visual-particle";
  readonly loop: boolean;
  readonly syncWithAttackAnimation: boolean;
  readonly maxParticles: number;
  readonly particleLifetimeSeconds: number;
  readonly emissionStartSeconds: number;
  readonly emissionDurationSeconds: number;
  readonly emissionRatePerSecond: number;
  readonly emissionRateVariance: number;
  readonly initialVelocity: number;
  readonly spreader: "point" | "box" | "rectangle";
  readonly shapeOuterRadii?: readonly [x: number, y: number, z: number];
  readonly shapeCenterHeight?: number;
  readonly offAxisDegrees: number;
  readonly offPlaneDegrees: number;
  readonly blend: "additive" | "normal";
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
    readonly spreader: "forward" | "radial-horizontal" | "vertical";
    readonly emissionMode?: "finite" | "continuous";
    readonly emissionDurationSeconds: number;
    readonly heightOffset: number;
    readonly scaleStart: number;
    readonly scaleEnd: number;
    readonly scaleFadeInSeconds: number;
    readonly peakOpacity: number;
    readonly opacityVariance: number;
    readonly opacityFadeInSeconds: number;
    readonly opacityFadeOutSeconds: number;
  };
}

export interface AttackParticleEvidence extends Omit<SpecialParticleEvidence, "presentation"> {
  readonly presentation: {
    readonly kind: "projectile-trail";
    readonly projectileType: number;
    readonly flightHeight: number;
    readonly arcHeight: number;
    readonly particleCount: number;
    readonly trailLength: number;
    readonly baseScale: number;
    readonly scaleStart: number;
    readonly scaleEnd: number;
    readonly peakOpacity: number;
  };
}

export interface AreaSpecialEvidence {
  readonly executableSha256: string;
  readonly handlerAddress: `0x${string}`;
  readonly center: "attacker";
  readonly falloff: "linear";
}

export interface DeathAreaAttackEvidence {
  readonly replacementUnitId: number;
  readonly replacementUnitName: string;
  readonly falloff: "constant";
}

export interface DeathReplacementEvidence {
  readonly replacementUnitType: number;
  readonly trialReplacementUnitId: number;
  readonly replacementUnitName: string;
  readonly trialMaxHp: number;
  readonly trainsUnitName: string;
  readonly commandSlot: number;
  readonly trainOnce: true;
}

export interface ThrownTargetReactionEvidence {
  readonly executableSha256: string;
  readonly actionHandlerAddress: `0x${string}`;
  readonly thrownActionAddress: `0x${string}`;
  readonly randomDrawOrder: readonly string[];
  readonly distance: readonly [base: number, randomRange: number];
  readonly maxVelocity: readonly [base: number, randomRange: number];
  readonly maxHeight: readonly [base: number, randomRange: number];
  readonly bounces: readonly [base: number, randomRange: number];
}

export interface ConeThrowSpecialEvidence {
  readonly executableSha256: string;
  readonly handlerAddress: `0x${string}`;
  readonly center: "attacker";
  readonly queryRadiusPadding: number;
  readonly coneHalfAngleDegrees: number;
}

export interface PickupThrowActionEvidence {
  readonly executableSha256: string;
  readonly handlerAddress: `0x${string}`;
  readonly unitActionType: 35;
  readonly victimLifetime: "action-completion";
  readonly areaCenter: "attacker";
  readonly falloff: "constant";
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
  readonly deathAreaAttack?: DeathAreaAttackEvidence;
  readonly deathReplacement?: DeathReplacementEvidence;
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
    readonly specialImpact?: SpecialImpactEvidence;
    readonly pickupThrowSpecial?: PickupThrowSpecialEvidence;
    readonly attackRelease?: ProjectileReleaseEvidence;
    readonly specialParticles?: readonly SpecialParticleEvidence[];
  }
> & {
  readonly targetReaction?: ThrownTargetReactionEvidence;
  readonly areaSpecial?: AreaSpecialEvidence;
  readonly coneThrowSpecial?: ConeThrowSpecialEvidence;
  readonly pickupThrowAction?: PickupThrowActionEvidence;
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
  readonly deathAreaAttack: DeathAreaAttack | null;
  readonly deathReplacement?: DeathReplacement;
  readonly garrison: GarrisonTraits | null;
  readonly buildingAttack: MeleeAttack | null;
  readonly resourceEat: ResourceEatTraits | null;
  readonly trade: TradeTraits | null;
  readonly tradeSite: "market" | "town-center" | null;
  readonly maxHp: number;
  readonly lineOfSight: number;
  readonly movementSpeed: number;
  readonly movementDomain?: MovementDomain;
  readonly workRange: number | null;
  readonly armor: ArmorProfile;
  readonly isStatic: boolean;
  readonly resource: number;
  readonly bodyRadius: number;
  readonly collidesWithUnits?: boolean;
  readonly collidesWithProjectiles: boolean;
  readonly footprint: number;
  readonly cost: readonly [food: number, wood: number, gold: number, favor: number];
  readonly buildTicks: number;
  readonly regenerationPerSecond: number | null;
  readonly lifespanTicks: number | null;
  readonly populationCost: number;
  readonly popBonus: number;
  readonly trainExitOffset: number;
  readonly trainingSite?: TrainingSiteTraits;
  readonly isDropsite: boolean;
  readonly requiredAge: number;
  readonly requiredGod: number;
  readonly prerequisiteBuildings: readonly number[];
  readonly trainedAt: readonly TypeCommandRelationship[];
  readonly builtBy: readonly TypeCommandRelationship[];
}

export interface OrdinaryUnitReferenceExpected<
  A extends Attack | null,
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
  | "deathAreaAttack"
  | "garrison"
  | "buildingAttack"
  | "resourceEat"
  | "trade"
  | "tradeSite"
  | "workRange"
  | "isStatic"
  | "resource"
  | "collidesWithProjectiles"
  | "footprint"
  | "regenerationPerSecond"
  | "lifespanTicks"
  | "popBonus"
  | "trainExitOffset"
  | "isDropsite"
  | "builtBy"
> & {
  readonly lifespanTicks?: number;
  readonly regenerationPerSecond?: number;
  readonly garrison?: GarrisonTraits;
  readonly buildingAttack?: MeleeAttack;
  readonly resourceEat?: ResourceEatTraits;
};

export function ordinaryUnitExpected<A extends Attack>(
  expected: OrdinaryExpectedInput<A>,
): OrdinaryUnitReferenceExpected<A> {
  return {
    ...expected,
    hero: null,
    specialAttack: null,
    deathAreaAttack: null,
    garrison: expected.garrison ?? null,
    buildingAttack: expected.buildingAttack ?? null,
    resourceEat: expected.resourceEat ?? null,
    trade: null,
    tradeSite: null,
    workRange: null,
    isStatic: false,
    resource: -1,
    collidesWithProjectiles: true,
    footprint: 0,
    regenerationPerSecond: expected.regenerationPerSecond ?? null,
    lifespanTicks: expected.lifespanTicks ?? null,
    popBonus: 0,
    trainExitOffset: 0,
    isDropsite: false,
    builtBy: [],
  };
}

type HeroExpectedInput<A extends Attack> = Omit<
  HeroUnitReferenceExpected<A>,
  | "specialAttack"
  | "deathAreaAttack"
  | "garrison"
  | "buildingAttack"
  | "resourceEat"
  | "trade"
  | "tradeSite"
  | "workRange"
  | "isStatic"
  | "resource"
  | "collidesWithProjectiles"
  | "footprint"
  | "regenerationPerSecond"
  | "lifespanTicks"
  | "popBonus"
  | "trainExitOffset"
  | "isDropsite"
  | "builtBy"
> & {
  readonly hero: HeroTraits;
  readonly specialAttack?: SpecialAttack;
  readonly lifespanTicks?: number;
  readonly regenerationPerSecond?: number;
  readonly garrison?: GarrisonTraits;
  readonly buildingAttack?: MeleeAttack;
  readonly resourceEat?: ResourceEatTraits;
};

export function heroUnitExpected<A extends Attack>(
  expected: HeroExpectedInput<A>,
): HeroUnitReferenceExpected<A> {
  return {
    ...expected,
    specialAttack: expected.specialAttack ?? null,
    deathAreaAttack: null,
    garrison: expected.garrison ?? null,
    buildingAttack: expected.buildingAttack ?? null,
    resourceEat: expected.resourceEat ?? null,
    trade: null,
    tradeSite: null,
    workRange: null,
    isStatic: false,
    resource: -1,
    collidesWithProjectiles: true,
    footprint: 0,
    regenerationPerSecond: expected.regenerationPerSecond ?? null,
    lifespanTicks: expected.lifespanTicks ?? null,
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

export interface EconomicUnitReferenceExpected extends UnitReferenceCommonExpected {
  readonly attack: null;
  readonly trade: TradeTraits;
}

type EconomicExpectedInput = Omit<
  EconomicUnitReferenceExpected,
  | "hero"
  | "specialAttack"
  | "deathAreaAttack"
  | "garrison"
  | "buildingAttack"
  | "resourceEat"
  | "tradeSite"
  | "workRange"
  | "isStatic"
  | "resource"
  | "collidesWithProjectiles"
  | "footprint"
  | "regenerationPerSecond"
  | "lifespanTicks"
  | "popBonus"
  | "trainExitOffset"
  | "isDropsite"
  | "builtBy"
>;

export function economicUnitExpected(
  expected: EconomicExpectedInput,
): EconomicUnitReferenceExpected {
  return {
    ...expected,
    hero: null,
    specialAttack: null,
    deathAreaAttack: null,
    garrison: null,
    buildingAttack: null,
    resourceEat: null,
    tradeSite: null,
    workRange: null,
    isStatic: false,
    resource: -1,
    collidesWithProjectiles: true,
    footprint: 0,
    regenerationPerSecond: null,
    lifespanTicks: null,
    popBonus: 0,
    trainExitOffset: 0,
    isDropsite: false,
    builtBy: [],
  };
}

export interface EconomicUnitReferenceSpec {
  readonly family: "trade";
  readonly id: number;
  readonly key: string;
  readonly source: UnitReferenceSource;
  readonly expected: EconomicUnitReferenceExpected;
}

export interface NavalUnitReferenceExpected extends UnitReferenceCommonExpected {
  readonly attack: Attack | null;
  readonly movementDomain: MovementDomain;
  readonly gather: GatherTraits | null;
  readonly construction: ConstructionTraits | null;
}

type NavalExpectedInput = Omit<
  NavalUnitReferenceExpected,
  | "hero"
  | "specialAttack"
  | "deathAreaAttack"
  | "garrison"
  | "buildingAttack"
  | "resourceEat"
  | "trade"
  | "tradeSite"
  | "isStatic"
  | "resource"
  | "collidesWithProjectiles"
  | "footprint"
  | "regenerationPerSecond"
  | "lifespanTicks"
  | "popBonus"
  | "trainExitOffset"
  | "isDropsite"
  | "builtBy"
  | "gather"
  | "construction"
> & {
  readonly gather?: GatherTraits;
  readonly construction?: ConstructionTraits;
  readonly garrison?: GarrisonTraits;
  readonly buildingAttack?: MeleeAttack;
  readonly resourceEat?: ResourceEatTraits;
};

export function navalUnitExpected(expected: NavalExpectedInput): NavalUnitReferenceExpected {
  return {
    ...expected,
    hero: null,
    specialAttack: null,
    deathAreaAttack: null,
    garrison: expected.garrison ?? null,
    buildingAttack: expected.buildingAttack ?? null,
    resourceEat: expected.resourceEat ?? null,
    trade: null,
    tradeSite: null,
    isStatic: false,
    resource: -1,
    collidesWithProjectiles: true,
    footprint: 0,
    regenerationPerSecond: null,
    lifespanTicks: null,
    popBonus: 0,
    trainExitOffset: 0,
    isDropsite: false,
    builtBy: [],
    gather: expected.gather ?? null,
    construction: expected.construction ?? null,
  };
}

export interface NavalUnitReferenceSpec {
  readonly family: "naval";
  readonly id: number;
  readonly key: string;
  readonly source: UnitReferenceSource | ProjectileUnitReferenceSource;
  readonly expected: NavalUnitReferenceExpected;
}

export interface ProjectileUnitReferenceSpec {
  readonly family: "ordinary-projectile";
  readonly id: number;
  readonly key: string;
  readonly source: ProjectileUnitReferenceSource;
  readonly expected: ProjectileUnitReferenceExpected;
}

export interface SiegeUnitReferenceSpec {
  readonly family: "siege";
  readonly attackKind: "projectile";
  readonly id: number;
  readonly key: string;
  readonly source: ProjectileUnitReferenceSource;
  readonly expected: ProjectileUnitReferenceExpected;
}

export interface ExceptionalLifecycleUnitReferenceSpec {
  readonly family: "exceptional-lifecycle";
  readonly attackKind: "melee";
  readonly id: number;
  readonly key: string;
  readonly source: UnitReferenceSource;
  readonly expected: MeleeUnitReferenceExpected;
}

interface HeroUnitReferenceSpecBase {
  readonly family: "hero";
  readonly id: number;
  readonly key: string;
}

export interface MeleeHeroUnitReferenceSpec extends HeroUnitReferenceSpecBase {
  readonly attackKind: "melee";
  readonly source: UnitReferenceSource | SpecialUnitReferenceSource;
  readonly expected: HeroUnitReferenceExpected<MeleeAttack>;
}

export interface ProjectileHeroUnitReferenceSpec extends HeroUnitReferenceSpecBase {
  readonly attackKind: "projectile";
  readonly source: ProjectileUnitReferenceSource;
  readonly expected: HeroUnitReferenceExpected<ProjectileAttack>;
}

export interface BeamHeroUnitReferenceSpec extends HeroUnitReferenceSpecBase {
  readonly attackKind: "beam";
  readonly source: UnitReferenceSource;
  readonly expected: HeroUnitReferenceExpected<BeamAttack>;
}

export type HeroUnitReferenceSpec =
  | MeleeHeroUnitReferenceSpec
  | ProjectileHeroUnitReferenceSpec
  | BeamHeroUnitReferenceSpec;

export type MythUnitReferenceExpected<A extends Attack | null = Attack | null> =
  OrdinaryUnitReferenceExpected<A>;

export interface MythUnitReferenceSpec {
  readonly family: "myth";
  readonly attackKind: "none" | "melee" | "projectile" | "beam";
  readonly id: number;
  readonly key: string;
  readonly source: SpecialUnitReferenceSource | UnitReferenceSource | ProjectileUnitReferenceSource;
  readonly expected: MythUnitReferenceExpected;
}

type MythExpectedInput<A extends Attack | null> = Omit<
  MythUnitReferenceExpected<A>,
  | "hero"
  | "deathAreaAttack"
  | "garrison"
  | "buildingAttack"
  | "resourceEat"
  | "trade"
  | "tradeSite"
  | "workRange"
  | "isStatic"
  | "resource"
  | "collidesWithProjectiles"
  | "footprint"
  | "regenerationPerSecond"
  | "lifespanTicks"
  | "popBonus"
  | "trainExitOffset"
  | "isDropsite"
  | "builtBy"
> & {
  readonly lifespanTicks?: number;
  readonly regenerationPerSecond?: number;
  readonly deathAreaAttack?: DeathAreaAttack;
  readonly garrison?: GarrisonTraits;
  readonly buildingAttack?: MeleeAttack;
  readonly resourceEat?: ResourceEatTraits;
};

export function mythUnitExpected<A extends Attack | null>(
  expected: MythExpectedInput<A>,
): MythUnitReferenceExpected<A> {
  return {
    ...expected,
    hero: null,
    deathAreaAttack: expected.deathAreaAttack ?? null,
    garrison: expected.garrison ?? null,
    buildingAttack: expected.buildingAttack ?? null,
    resourceEat: expected.resourceEat ?? null,
    trade: null,
    tradeSite: null,
    workRange: null,
    isStatic: false,
    resource: -1,
    collidesWithProjectiles: true,
    footprint: 0,
    regenerationPerSecond: expected.regenerationPerSecond ?? null,
    lifespanTicks: expected.lifespanTicks ?? null,
    popBonus: 0,
    trainExitOffset: 0,
    isDropsite: false,
    builtBy: [],
  };
}

export type UnitReferenceSpec =
  | EconomicUnitReferenceSpec
  | NavalUnitReferenceSpec
  | MeleeUnitReferenceSpec
  | ProjectileUnitReferenceSpec
  | SiegeUnitReferenceSpec
  | ExceptionalLifecycleUnitReferenceSpec
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
    ...(expected.movementDomain === undefined ? {} : { movementDomain: expected.movementDomain }),
    armor: expected.armor,
    bodyRadius: expected.bodyRadius,
    ...(expected.collidesWithUnits === undefined
      ? {}
      : { collidesWithUnits: expected.collidesWithUnits }),
    collidesWithProjectiles: expected.collidesWithProjectiles,
    cost: expected.cost,
    buildTicks: expected.buildTicks,
    regenerationPerSecond: expected.regenerationPerSecond,
    lifespanTicks: expected.lifespanTicks,
    populationCost: expected.populationCost,
    requiredAge: expected.requiredAge,
  };

  const attack = expected.attack;
  if (attack === null) {
    if (reference.family === "naval") {
      if (reference.expected.gather === null) {
        return {
          ...common,
          movementDomain: reference.expected.movementDomain,
          ...(reference.expected.garrison === null
            ? {}
            : { "garrison.capacity": reference.expected.garrison.capacity }),
        };
      }
      return {
        ...common,
        movementDomain: reference.expected.movementDomain,
        workRange: reference.expected.workRange,
        "gather.capacity": reference.expected.gather.capacity,
        "gather.ratePerSecond": reference.expected.gather.ratePerSecond,
        ...(reference.expected.construction === null
          ? {}
          : {
              "construction.range": reference.expected.construction.range,
              "construction.ratePerSecond": reference.expected.construction.ratePerSecond,
            }),
      };
    }
    const trade = expected.trade;
    return trade === null
      ? common
      : {
          ...common,
          "trade.capacity": trade.capacity,
          "trade.interactionRange": trade.interactionRange,
          "trade.townCenterWorkRate": trade.townCenterWorkRate,
          "trade.townCenterMinimumRate": trade.townCenterMinimumRate,
          "trade.incomeMultiplier": trade.incomeMultiplier,
        };
  }
  const attackFields = {
    ...common,
    ...(expected.movementDomain === undefined ? {} : { movementDomain: expected.movementDomain }),
    ...(expected.garrison === null ? {} : { "garrison.capacity": expected.garrison.capacity }),
    "attack.damage": attack.damage,
    "attack.range": attack.range,
    "attack.bonuses": attack.bonuses,
    ...(attack.kind === "melee" && attack.cycleVariants !== undefined
      ? { "attack.cycleVariants": attack.cycleVariants }
      : {}),
    ...(expected.buildingAttack === null
      ? {}
      : {
          "buildingAttack.damage": expected.buildingAttack.damage,
          "buildingAttack.range": expected.buildingAttack.range,
          "buildingAttack.bonuses": expected.buildingAttack.bonuses,
        }),
    ...(expected.resourceEat === null
      ? {}
      : {
          "resourceEat.resourceTypes": expected.resourceEat.resourceTypes,
          "resourceEat.consumePerSecond": expected.resourceEat.consumePerSecond,
        }),
  };

  const primaryFields =
    attack.kind === "projectile"
      ? {
          ...attackFields,
          "attack.minimumRange": attack.minimumRange ?? 0,
          "attack.autoAcquireBuildings": attack.autoAcquireBuildings ?? false,
          "attack.accuracy": attack.accuracy,
          "attack.accuracyReductionFactor": attack.accuracyReductionFactor,
          "attack.aimBonus": attack.aimBonus,
          "attack.spreadFactor": attack.spreadFactor,
          "attack.maxSpread": attack.maxSpread,
          "attack.trackRating": attack.trackRating,
          "attack.unintentionalDamageMultiplier": attack.unintentionalDamageMultiplier,
          "attack.projectileCount": attack.projectileCount ?? 1,
          "attack.projectile.speed": attack.projectile.speed,
          "attack.projectile.lifespanTicks": attack.projectile.lifespanTicks,
          "attack.projectile.collisionRadius": attack.projectile.collisionRadius,
        }
      : attackFields;

  const special = reference.expected.specialAttack;
  const deathArea = reference.expected.deathAreaAttack;
  const deathAreaFields =
    deathArea === null
      ? {}
      : {
          "deathAreaAttack.damage": deathArea.damage,
          "deathAreaAttack.radius": deathArea.radius,
          "deathAreaAttack.bonuses": deathArea.bonuses,
          "deathAreaAttack.damageRelations": deathArea.damageRelations,
        };
  if (special === null) return { ...primaryFields, ...deathAreaFields };
  return {
    ...primaryFields,
    ...deathAreaFields,
    "specialAttack.damage": special.damage,
    ...(special.kind === "charged-jump"
      ? { "specialAttack.minimumRange": special.minimumRange }
      : {}),
    "specialAttack.range": special.range,
    "specialAttack.bonuses": special.bonuses,
    "specialAttack.rechargeTicks": special.rechargeTicks,
    "specialAttack.validTargets": special.validTargets,
    "specialAttack.invalidTargetConditions": special.invalidTargetConditions ?? 0,
    ...(special.kind === "charged-terminal" ? { "specialAttack.effect": special.effect } : {}),
    ...(special.kind === "charged-projectile"
      ? {
          "specialAttack.accuracy": special.accuracy,
          "specialAttack.accuracyReductionFactor": special.accuracyReductionFactor,
          "specialAttack.aimBonus": special.aimBonus,
          "specialAttack.spreadFactor": special.spreadFactor,
          "specialAttack.maxSpread": special.maxSpread,
          "specialAttack.trackRating": special.trackRating,
          "specialAttack.unintentionalDamageMultiplier": special.unintentionalDamageMultiplier,
          "specialAttack.poisonFraction": special.poisonFraction ?? 0,
          "specialAttack.projectileCount": special.projectileCount ?? 1,
          "specialAttack.projectile.speed": special.projectile.speed,
          "specialAttack.projectile.lifespanTicks": special.projectile.lifespanTicks,
          "specialAttack.projectile.collisionRadius": special.projectile.collisionRadius,
          ...(special.impactArea === undefined
            ? {}
            : {
                "specialAttack.radius": special.impactArea.radius,
                "specialAttack.damageRelations": special.impactArea.damageRelations,
              }),
        }
      : {}),
    ...(special.kind === "charged-area-pulse" ||
    special.kind === "charged-area-poison" ||
    special.kind === "charged-cone-throw" ||
    special.kind === "charged-pickup-throw"
      ? {
          "specialAttack.radius": special.radius,
          "specialAttack.damageRelations": special.damageRelations,
        }
      : {}),
    ...(special.kind === "charged-jump"
      ? special.delivery === "area"
        ? {
            "specialAttack.radius": special.radius,
            "specialAttack.damageRelations": special.damageRelations,
          }
        : {}
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
    if (
      reference.expected.lifespanTicks !== null &&
      (!Number.isInteger(reference.expected.lifespanTicks) ||
        reference.expected.lifespanTicks < 1 ||
        reference.expected.lifespanTicks > 0xffff)
    ) {
      throw new Error(`Unit reference ${reference.key} has an invalid fixed lifetime.`);
    }
    if (
      reference.expected.regenerationPerSecond !== null &&
      (!Number.isFinite(reference.expected.regenerationPerSecond) ||
        reference.expected.regenerationPerSecond <= 0)
    ) {
      throw new Error(`Unit reference ${reference.key} has an invalid regeneration rate.`);
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
    if (reference.expected.attack !== null) {
      if (reference.expected.attack.kind === "projectile") {
        const inventory = reference.source.assetInventory;
        if (!("attackRelease" in inventory) || inventory.attackRelease === undefined) {
          throw new Error(`${reference.key} is missing projectile release evidence.`);
        }
        const release = inventory.attackRelease;
        const attack = reference.expected.attack;
        if (
          (attack.projectileCount !== undefined &&
            (!Number.isInteger(attack.projectileCount) || attack.projectileCount < 1)) ||
          (attack.minimumRange !== undefined &&
            (!Number.isFinite(attack.minimumRange) ||
              attack.minimumRange < 0 ||
              attack.minimumRange >= attack.range)) ||
          (attack.impactArea !== undefined &&
            (!Number.isFinite(attack.impactArea.radius) ||
              attack.impactArea.radius <= 0 ||
              attack.impactArea.falloff !== "linear" ||
              (attack.impactArea.damageRelations & AREA_DAMAGE_ENEMIES) === 0 ||
              (attack.impactArea.damageRelations &
                ~(AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS)) !==
                0)) ||
          !/^[0-9a-f]{64}$/.test(release.sha256) ||
          release.action.trim().length === 0 ||
          !Number.isFinite(release.fraction) ||
          release.fraction < 0 ||
          release.fraction >= 1 ||
          (release.durationTicks !== undefined &&
            (!Number.isInteger(release.durationTicks) ||
              release.durationTicks < 1 ||
              release.model === undefined ||
              release.model.trim().length === 0 ||
              release.modelSha256 === undefined ||
              !/^[0-9a-f]{64}$/.test(release.modelSha256) ||
              (release.modelDurationTicks !== undefined &&
                (!Number.isInteger(release.modelDurationTicks) ||
                  release.modelDurationTicks < 1)))) ||
          (release.durationTicks === undefined &&
            (release.model !== undefined ||
              release.modelSha256 !== undefined ||
              release.modelDurationTicks !== undefined))
        ) {
          throw new Error(`${reference.key} has invalid projectile release evidence.`);
        }
        if (
          Math.round(release.fraction * (release.durationTicks ?? attack.cooldownTicks)) !==
          attack.launchDelayTicks
        ) {
          throw new Error(`${reference.key} release evidence does not match launchDelayTicks.`);
        }
      }
      const attackParticles = reference.source.assetInventory.attackParticles;
      if (attackParticles !== undefined) {
        const projectileAttack =
          reference.expected.attack.kind === "projectile" ? reference.expected.attack : null;
        if (
          projectileAttack === null ||
          attackParticles.length === 0 ||
          attackParticles.some(
            (particle) =>
              particle.key.trim().length === 0 ||
              !/^[0-9a-f]{64}$/.test(particle.prtSha256) ||
              !/^[0-9a-f]{64}$/.test(particle.textureSha256) ||
              particle.presentation.kind !== "projectile-trail" ||
              particle.presentation.projectileType !== projectileAttack.projectile.type ||
              !Number.isInteger(particle.presentation.particleCount) ||
              particle.presentation.particleCount < 1 ||
              particle.presentation.trailLength < 0 ||
              particle.presentation.baseScale <= 0,
          )
        ) {
          throw new Error(`${reference.key} has invalid attack-particle evidence.`);
        }
      }
      const expectedCycles =
        reference.expected.attack.kind === "melee"
          ? reference.expected.attack.cycleVariants
          : undefined;
      const cycleEvidence = reference.source.assetInventory.meleeAttackCycles;
      const cycleSelector = reference.source.assetInventory.meleeCycleSelector;
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
      const expectedSecondaryCycles = reference.expected.buildingAttack?.cycleVariants;
      const secondaryCycleEvidence =
        reference.source.assetInventory.secondaryMeleeAttackCycles;
      if (expectedSecondaryCycles !== undefined) {
        if (
          secondaryCycleEvidence === undefined ||
          secondaryCycleEvidence.length !== expectedSecondaryCycles.length ||
          secondaryCycleEvidence.some(
            (evidence, index) =>
              !/^[0-9a-f]{64}$/.test(evidence.sha256) ||
              !/^[0-9a-f]{64}$/.test(evidence.modelSha256) ||
              evidence.action !== "attack" ||
              evidence.tag !== "Attack" ||
              evidence.model.trim().length === 0 ||
              evidence.durationTicks !== expectedSecondaryCycles[index]!.actionTicks ||
              Math.round(evidence.fraction * evidence.durationTicks) !==
                expectedSecondaryCycles[index]!.impactDelayTicks,
          )
        ) {
          throw new Error(`${reference.key} has invalid secondary melee-cycle evidence.`);
        }
      } else if (secondaryCycleEvidence !== undefined) {
        throw new Error(`${reference.key} has unused secondary melee-cycle evidence.`);
      }
      const beamEvidence = reference.source.assetInventory.beamAttackCycle;
      if (reference.expected.attack.kind === "beam") {
        if (
          beamEvidence === undefined ||
          !/^[0-9a-f]{64}$/.test(beamEvidence.sha256) ||
          !/^[0-9a-f]{64}$/.test(beamEvidence.modelSha256) ||
          beamEvidence.action.trim().length === 0 ||
          beamEvidence.tag !== "Attack" ||
          beamEvidence.model.trim().length === 0 ||
          beamEvidence.durationTicks !== reference.expected.attack.cooldownTicks ||
          Math.round(beamEvidence.fraction * beamEvidence.durationTicks) !==
            reference.expected.attack.impactDelayTicks ||
          (beamEvidence.modelDurationTicks !== undefined &&
            (!Number.isInteger(beamEvidence.modelDurationTicks) ||
              beamEvidence.modelDurationTicks < 1))
        ) {
          throw new Error(`${reference.key} has invalid beam-cycle evidence.`);
        }
      } else if (beamEvidence !== undefined) {
        throw new Error(`${reference.key} has unused beam-cycle evidence.`);
      }
      const killScaling =
        reference.expected.attack.kind === "melee"
          ? reference.expected.attack.killScaling
          : undefined;
      if (killScaling !== undefined) {
        if (
          expectedCycles === undefined ||
          cycleSelector === undefined ||
          cycleSelector.kind !== "experience" ||
          cycleSelector.killsPerVariant !== killScaling.killsPerVariant ||
          cycleSelector.thresholds.length !== expectedCycles.length ||
          cycleSelector.thresholds.some(
            (threshold, index) =>
              threshold !== (index * 100) / Math.max(1, expectedCycles.length - 1),
          ) ||
          killScaling.maxKills !== killScaling.killsPerVariant * (expectedCycles.length - 1)
        ) {
          throw new Error(`${reference.key} has invalid experience-cycle evidence.`);
        }
      } else if (cycleSelector !== undefined) {
        throw new Error(`${reference.key} has unused experience-cycle evidence.`);
      }
    }

    if (reference.expected.specialAttack !== null) {
      const special = reference.expected.specialAttack;
      if (
        special.kind === "charged-area-poison" &&
        (!Number.isInteger(special.poisonDurationTicks) ||
          special.poisonDurationTicks < 1 ||
          special.poisonDurationTicks > 0xffff)
      ) {
        throw new Error(`${reference.key} has an invalid poison duration.`);
      }
      if (
        special.kind === "charged-projectile" &&
        ((special.projectileCount !== undefined &&
          (!Number.isInteger(special.projectileCount) || special.projectileCount < 1)) ||
          (special.impactArea !== undefined &&
            (!Number.isFinite(special.impactArea.radius) ||
              special.impactArea.radius <= 0 ||
              special.impactArea.falloff !== "linear" ||
              (special.impactArea.damageRelations & AREA_DAMAGE_ENEMIES) === 0 ||
              (special.impactArea.damageRelations &
                ~(AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS)) !==
                0)))
      ) {
        throw new Error(`${reference.key} has an invalid charged projectile impact contract.`);
      }
      const inventory = reference.source.assetInventory;
      if (special.kind === "charged-jump") {
        const jump = inventory.jumpSpecial;
        const validPhased =
          jump?.kind === "phased" &&
          /^[0-9a-f]{64}$/.test(jump.sha256) &&
          /^[0-9a-f]{64}$/.test(jump.takeoffModelSha256) &&
          /^[0-9a-f]{64}$/.test(jump.flightModelSha256) &&
          /^[0-9a-f]{64}$/.test(jump.landingModelSha256) &&
          jump.takeoffModel.trim().length > 0 &&
          jump.flightModel.trim().length > 0 &&
          jump.landingModel.trim().length > 0 &&
          jump.takeoffTicks === special.takeoffTicks &&
          jump.flightRuntimeTicks === special.flightTicks &&
          jump.landingTicks === special.landingTicks &&
          jump.takeoffTicks + jump.flightRuntimeTicks === special.impactDelayTicks &&
          special.impactDelayTicks + jump.landingTicks === special.actionTicks &&
          jump.impact === "landing-start";
        const validSingleCycle =
          jump?.kind === "single-cycle" &&
          /^[0-9a-f]{64}$/.test(jump.sha256) &&
          /^[0-9a-f]{64}$/.test(jump.modelSha256) &&
          jump.model.trim().length > 0 &&
          jump.durationTicks === special.actionTicks &&
          special.takeoffTicks === 0 &&
          special.flightTicks === jump.durationTicks &&
          special.landingTicks === 0 &&
          special.impactDelayTicks === jump.durationTicks &&
          jump.impact === "cycle-end";
        if (!validPhased && !validSingleCycle) {
          throw new Error(`${reference.key} has invalid jump-special evidence.`);
        }
      } else if (special.kind === "charged-pickup-throw") {
        const pickup = inventory.pickupThrowSpecial;
        if (
          pickup === undefined ||
          !/^[0-9a-f]{64}$/.test(pickup.sha256) ||
          !/^[0-9a-f]{64}$/.test(pickup.modelSha256) ||
          pickup.model.trim().length === 0 ||
          pickup.durationTicks !== special.actionTicks ||
          Math.round(pickup.pickupFraction * pickup.durationTicks) !== special.pickupDelayTicks ||
          Math.round(pickup.throwFraction * pickup.durationTicks) !== special.throwDelayTicks
        ) {
          throw new Error(`${reference.key} has invalid pickup-throw animation evidence.`);
        }
      } else {
        const impact = "specialImpact" in inventory ? inventory.specialImpact : undefined;
        if (impact === undefined) {
          throw new Error(`${reference.key} is missing special-impact evidence.`);
        }
        if (
          !/^[0-9a-f]{64}$/.test(impact.sha256) ||
          impact.action.trim().length === 0 ||
          !Number.isInteger(impact.durationTicks) ||
          impact.durationTicks < 1 ||
          !Number.isFinite(impact.fraction) ||
          impact.fraction < 0 ||
          impact.fraction >= 1 ||
          Math.round(impact.fraction * impact.durationTicks) !== special.impactDelayTicks ||
          impact.durationTicks !== special.actionTicks
        ) {
          throw new Error(`${reference.key} has invalid special-impact evidence.`);
        }
      }

      const expectedReaction =
        reference.expected.specialAttack.kind === "charged-melee" ||
        reference.expected.specialAttack.kind === "charged-cone-throw"
          ? reference.expected.specialAttack.targetReaction
          : undefined;
      const reactionEvidence =
        "targetReaction" in reference.source ? reference.source.targetReaction : undefined;
      if (expectedReaction?.kind === "thrown") {
        if (
          reactionEvidence === undefined ||
          !/^[0-9a-f]{64}$/.test(reactionEvidence.executableSha256) ||
          !/^0x[0-9a-f]+$/i.test(reactionEvidence.actionHandlerAddress) ||
          !/^0x[0-9a-f]+$/i.test(reactionEvidence.thrownActionAddress) ||
          !structurallyEqual(reactionEvidence.randomDrawOrder, expectedReaction.randomDrawOrder) ||
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

      const coneEvidence =
        "coneThrowSpecial" in reference.source ? reference.source.coneThrowSpecial : undefined;
      if (reference.expected.specialAttack.kind === "charged-cone-throw") {
        if (
          coneEvidence === undefined ||
          !/^[0-9a-f]{64}$/.test(coneEvidence.executableSha256) ||
          !/^0x[0-9a-f]+$/i.test(coneEvidence.handlerAddress) ||
          coneEvidence.center !== "attacker" ||
          coneEvidence.queryRadiusPadding !==
            reference.expected.specialAttack.radius - reference.expected.specialAttack.range ||
          coneEvidence.coneHalfAngleDegrees !==
            reference.expected.specialAttack.coneHalfAngleDegrees
        ) {
          throw new Error(`${reference.key} has invalid cone-throw special evidence.`);
        }
      } else if (coneEvidence !== undefined) {
        throw new Error(`${reference.key} has unused cone-throw special evidence.`);
      }

      const pickupThrowEvidence =
        "pickupThrowAction" in reference.source ? reference.source.pickupThrowAction : undefined;
      if (reference.expected.specialAttack.kind === "charged-pickup-throw") {
        if (
          pickupThrowEvidence === undefined ||
          !/^[0-9a-f]{64}$/.test(pickupThrowEvidence.executableSha256) ||
          !/^0x[0-9a-f]+$/i.test(pickupThrowEvidence.handlerAddress) ||
          pickupThrowEvidence.unitActionType !== 35 ||
          pickupThrowEvidence.victimLifetime !== "action-completion" ||
          pickupThrowEvidence.areaCenter !== "attacker" ||
          pickupThrowEvidence.falloff !== reference.expected.specialAttack.falloff
        ) {
          throw new Error(`${reference.key} has invalid pickup-throw action evidence.`);
        }
      } else if (pickupThrowEvidence !== undefined) {
        throw new Error(`${reference.key} has unused pickup-throw action evidence.`);
      }

      const areaEvidence =
        "areaSpecial" in reference.source ? reference.source.areaSpecial : undefined;
      if (
        reference.expected.specialAttack.kind === "charged-area-pulse" ||
        reference.expected.specialAttack.kind === "charged-area-poison"
      ) {
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

      const particleEvidence =
        "specialParticles" in inventory ? inventory.specialParticles : undefined;
      if (particleEvidence !== undefined) {
        const particleKeys = new Set<string>();
        if (
          particleEvidence.length === 0 ||
          particleEvidence.some((particle) => {
            const presentation = particle.presentation;
            const appearanceCount = 1 + (particle.additionalTextures?.length ?? 0);
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
              (particle.sourceAnimationFile === undefined) !==
                (particle.sourceAnimationSha256 === undefined) ||
              (particle.sourceAnimationFile !== undefined &&
                (particle.sourceAnimationFile.trim().length === 0 ||
                  !/^[0-9a-f]{64}$/.test(particle.sourceAnimationSha256!))) ||
              !Number.isInteger(particle.maxParticles) ||
              particle.maxParticles < 1 ||
              particle.particleLifetimeSeconds <= 0 ||
              particle.emissionStartSeconds < 0 ||
              particle.emissionDurationSeconds < 0 ||
              particle.emissionRatePerSecond <= 0 ||
              particle.emissionRateVariance < 0 ||
              particle.initialVelocity < 0 ||
              particle.textureWidth < 1 ||
              particle.textureHeight < 1 ||
              (particle.additionalTextures?.some(
                (texture) =>
                  texture.file.trim().length === 0 ||
                  !/^[0-9a-f]{64}$/.test(texture.sha256) ||
                  texture.width < 1 ||
                  texture.height < 1,
              ) ??
                false) ||
              (particle.appearanceWeights !== undefined &&
                (particle.appearanceWeights.length !== appearanceCount ||
                  particle.appearanceWeights.some(
                    (weight) => !Number.isFinite(weight) || weight <= 0,
                  ))) ||
              particle.opacityStages.length === 0 ||
              (particle.scaleStages.length !== 0 && particle.scaleStages.length < 2) ||
              (particle.spreader === "rectangle" &&
                (particle.shapeOuterRadii === undefined ||
                  particle.shapeCenterHeight === undefined ||
                  particle.shapeOuterRadii.some(
                    (radius) => !Number.isFinite(radius) || radius < 0,
                  ) ||
                  !Number.isFinite(particle.shapeCenterHeight))) ||
              !Number.isFinite(presentation.emissionDurationSeconds) ||
              presentation.emissionDurationSeconds <= 0 ||
              !Number.isFinite(presentation.heightOffset) ||
              presentation.heightOffset < 0 ||
              !Number.isFinite(presentation.scaleStart) ||
              presentation.scaleStart < 0 ||
              !Number.isFinite(presentation.scaleEnd) ||
              presentation.scaleEnd < 0 ||
              !Number.isFinite(presentation.scaleFadeInSeconds) ||
              presentation.scaleFadeInSeconds <= 0 ||
              !Number.isFinite(presentation.peakOpacity) ||
              presentation.peakOpacity <= 0 ||
              presentation.peakOpacity > 1 ||
              !Number.isFinite(presentation.opacityVariance) ||
              presentation.opacityVariance < 0 ||
              presentation.opacityVariance >= presentation.peakOpacity ||
              !Number.isFinite(presentation.opacityFadeInSeconds) ||
              presentation.opacityFadeInSeconds < 0 ||
              !Number.isFinite(presentation.opacityFadeOutSeconds) ||
              presentation.opacityFadeOutSeconds <= 0
            );
          })
        ) {
          throw new Error(`${reference.key} has invalid particle evidence.`);
        }
      }
    } else if (
      reference.family === "myth" &&
      ("specialImpact" in reference.source.assetInventory ||
        reference.source.assetInventory.jumpSpecial !== undefined ||
        reference.source.assetInventory.pickupThrowSpecial !== undefined ||
        ("targetReaction" in reference.source && reference.source.targetReaction !== undefined) ||
        ("pickupThrowAction" in reference.source &&
          reference.source.pickupThrowAction !== undefined) ||
        ("areaSpecial" in reference.source && reference.source.areaSpecial !== undefined))
    ) {
      throw new Error(`${reference.key} has unused charged-special evidence.`);
    }

    const deathAreaEvidence = reference.source.deathAreaAttack;
    if (reference.expected.deathAreaAttack !== null) {
      if (
        deathAreaEvidence === undefined ||
        !Number.isInteger(deathAreaEvidence.replacementUnitId) ||
        deathAreaEvidence.replacementUnitId < 0 ||
        deathAreaEvidence.replacementUnitName.trim().length === 0 ||
        deathAreaEvidence.falloff !== reference.expected.deathAreaAttack.falloff
      ) {
        throw new Error(`${reference.key} has invalid death-area evidence.`);
      }
    } else if (deathAreaEvidence !== undefined) {
      throw new Error(`${reference.key} has unused death-area evidence.`);
    }

    const deathReplacementEvidence = reference.source.deathReplacement;
    if (reference.expected.deathReplacement !== undefined) {
      if (
        deathReplacementEvidence === undefined ||
        deathReplacementEvidence.replacementUnitType !==
          reference.expected.deathReplacement.unitType ||
        !Number.isInteger(deathReplacementEvidence.trialReplacementUnitId) ||
        deathReplacementEvidence.trialReplacementUnitId < 0 ||
        deathReplacementEvidence.replacementUnitName.trim().length === 0 ||
        !Number.isFinite(deathReplacementEvidence.trialMaxHp) ||
        deathReplacementEvidence.trialMaxHp <= 0 ||
        deathReplacementEvidence.trainsUnitName !== reference.source.trialProto.unitName ||
        !Number.isInteger(deathReplacementEvidence.commandSlot) ||
        deathReplacementEvidence.commandSlot < 0 ||
        deathReplacementEvidence.trainOnce !== true
      ) {
        throw new Error(`${reference.key} has invalid death-replacement evidence.`);
      }
    } else if (deathReplacementEvidence !== undefined) {
      throw new Error(`${reference.key} has unused death-replacement evidence.`);
    }

    const meleeImpactArea =
      reference.expected.attack?.kind === "melee"
        ? reference.expected.attack.impactArea
        : undefined;
    const meleeImpactEvidence = reference.source.assetInventory.meleeImpactArea;
    if (meleeImpactArea !== undefined) {
      if (
        meleeImpactEvidence === undefined ||
        meleeImpactEvidence.components.length !== meleeImpactArea.components.length ||
        !meleeImpactEvidence.components.some(
          (component) => component.radius === meleeImpactArea.radius,
        ) ||
        meleeImpactEvidence.components.some(
          (component) =>
            !Number.isFinite(component.damage) ||
            component.damage < 0 ||
            (component.radius !== null && component.radius !== meleeImpactArea.radius),
        )
      ) {
        throw new Error(`${reference.key} has invalid melee impact-area evidence.`);
      }
    } else if (meleeImpactEvidence !== undefined) {
      throw new Error(`${reference.key} has unused melee impact-area evidence.`);
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

interface UnitDefinitionReferenceExpected extends UnitReferenceCommonExpected {
  readonly attack: Attack | null;
}

function definitionSnapshot(definition: UnitTypeStats): UnitDefinitionReferenceExpected {
  return {
    label: definition.label,
    culture: definition.culture,
    classes: definition.classes,
    hero: definition.hero ?? null,
    specialAttack: definition.specialAttack ?? null,
    deathAreaAttack: definition.deathAreaAttack ?? null,
    ...(definition.deathReplacement === undefined
      ? {}
      : { deathReplacement: definition.deathReplacement }),
    garrison: definition.garrison ?? null,
    buildingAttack: definition.buildingAttack ?? null,
    resourceEat: definition.resourceEat ?? null,
    trade: definition.trade ?? null,
    tradeSite: definition.tradeSite ?? null,
    maxHp: definition.maxHp,
    lineOfSight: definition.lineOfSight,
    movementSpeed: definition.movementSpeed,
    workRange: definition.workRange ?? null,
    armor: definition.armor,
    attack: definition.attack,
    isStatic: definition.isStatic,
    resource: definition.resource,
    bodyRadius: definition.bodyRadius,
    ...(definition.collidesWithUnits === undefined
      ? {}
      : { collidesWithUnits: definition.collidesWithUnits }),
    collidesWithProjectiles: definition.collidesWithProjectiles,
    footprint: definition.footprint,
    cost: [definition.costFood, definition.costWood, definition.costGold, definition.costFavor],
    buildTicks: definition.buildTicks,
    regenerationPerSecond: definition.regenerationPerSecond ?? null,
    lifespanTicks: definition.lifespanTicks ?? null,
    populationCost: definition.populationCost,
    popBonus: definition.popBonus,
    trainExitOffset: definition.trainExitOffset,
    ...(definition.trainingSite === undefined ? {} : { trainingSite: definition.trainingSite }),
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
    case "trade": {
      if (definition.attack !== null || definition.trade === undefined) {
        throw new Error(`${definition.key} reference requires an unarmed trade unit.`);
      }
      break;
    }
    case "naval": {
      if (
        definition.movementDomain !== reference.expected.movementDomain ||
        (reference.expected.attack === null
          ? definition.attack !== null ||
            (reference.expected.gather === null
              ? definition.gather !== undefined
              : definition.gather === undefined)
          : definition.attack?.kind !== reference.expected.attack.kind ||
            definition.gather !== undefined)
      ) {
        throw new Error(`${definition.key} differs from its naval action contract.`);
      }
      break;
    }
    case "exceptional-lifecycle": {
      if (definition.attack?.kind !== reference.attackKind) {
        throw new Error(`${definition.key} reference requires an exceptional melee lifecycle.`);
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
    case "siege": {
      if (definition.attack?.kind !== reference.attackKind) {
        throw new Error(`${definition.key} reference requires a projectile siege attack.`);
      }
      break;
    }
    case "myth": {
      if (
        (reference.attackKind === "none" && definition.attack !== null) ||
        (reference.attackKind !== "none" && definition.attack?.kind !== reference.attackKind)
      ) {
        throw new Error(
          `${definition.key} reference requires a ${reference.attackKind} myth unit.`,
        );
      }
      break;
    }
    default:
      return assertNever(reference);
  }

  const snapshot = definitionSnapshot(definition);
  const actual =
    reference.family === "naval"
      ? {
          ...snapshot,
          movementDomain: definition.movementDomain,
          gather: definition.gather ?? null,
          construction: definition.construction ?? null,
        }
      : reference.expected.movementDomain === undefined
        ? snapshot
        : { ...snapshot, movementDomain: definition.movementDomain };
  if (!structurallyEqual(actual, reference.expected)) {
    throw new Error(
      `${reference.key} differs from its integration-owned ${reference.family} reference spec.\nExpected: ${JSON.stringify(reference.expected)}\nActual:   ${JSON.stringify(actual)}`,
    );
  }
}
