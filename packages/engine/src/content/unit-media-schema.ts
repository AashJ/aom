export interface IconConfig {
  readonly url: string;
  // Horizontal frames in the source image; 1 = a plain portrait.
  readonly columns: number;
}

export interface AudioCueDefinition {
  readonly files: readonly string[];
  readonly volume: number;
  readonly maxVoices: number;
  readonly delaySeconds?: number;
}

export interface UnitAudioDefinition {
  readonly selection?: AudioCueDefinition;
  readonly acknowledge?: AudioCueDefinition;
  readonly attackAcknowledge?: AudioCueDefinition;
  readonly gatherFood?: AudioCueDefinition;
  readonly gatherWood?: AudioCueDefinition;
  readonly gatherGold?: AudioCueDefinition;
  readonly repair?: AudioCueDefinition;
  readonly created?: AudioCueDefinition;
  readonly death?: AudioCueDefinition;
  readonly completed?: AudioCueDefinition;
  readonly attack?: AudioCueDefinition;
  readonly specialAttack?: AudioCueDefinition;
  // Some Classic animation actions emit several independently timed specific
  // sound tags. Layers play together instead of being randomized as variants.
  readonly specialAttackLayers?: readonly AudioCueDefinition[];
}

export interface ParticleEffectMediaDefinition {
  readonly key: string;
  readonly trigger: "special-attack" | "beam-attack" | "poisoned-status";
  readonly textureUrl: string;
  readonly additionalTextureUrls?: readonly string[];
}

export interface ParticleEffectDefinition {
  readonly key: string;
  readonly trigger: "special-attack" | "beam-attack" | "poisoned-status";
  readonly textureUrl: string;
  readonly blend: "additive" | "normal";
  readonly spreader: "forward" | "radial-horizontal" | "vertical";
  readonly emissionShape?: "rectangle-horizontal";
  readonly emissionRadiusX?: number;
  readonly emissionRadiusZ?: number;
  readonly appearanceWeightStart: number;
  readonly appearanceWeightEnd: number;
  readonly emissionMode: "finite" | "continuous";
  readonly maxParticles: number;
  readonly particleLifetimeSeconds: number;
  readonly emissionStartSeconds: number;
  readonly emissionDurationSeconds: number;
  readonly emissionRatePerSecond: number;
  readonly emissionRateVariance: number;
  readonly initialVelocity: number;
  readonly heightOffset: number;
  readonly baseScale: number;
  readonly scaleStart: number;
  readonly scaleEnd: number;
  readonly scaleFadeInSeconds: number;
  readonly peakOpacity: number;
  readonly opacityVariance: number;
  readonly opacityFadeInSeconds: number;
  readonly opacityFadeOutSeconds: number;
}

export interface BeamEffectMediaDefinition {
  readonly beamTextureUrl: string;
  readonly headTextureUrl: string;
  readonly blend: "additive";
  readonly startTicks: number;
  readonly endTicks: number;
  readonly width: number;
  readonly headLength: number;
  readonly sourceHeight: number;
  readonly targetHeightFactor: number;
}

export interface ModelAttachmentDefinition {
  readonly model: string;
  readonly targetNode: string;
  readonly hotspotNode: string;
}

export interface ModelAssetDefinition {
  readonly key: string;
  readonly url: string;
  readonly grounded: boolean;
  readonly attachments?: readonly ModelAttachmentDefinition[];
}

export type UnitMediaAction =
  | "idle"
  | "walk"
  | "attack"
  | "secondaryAttack"
  | "specialAttack"
  | "jumpTakeoff"
  | "jumpLand"
  | "death"
  | "build"
  | "gatherFood"
  | "gatherWood"
  | "gatherGold"
  | "pray"
  | "heal"
  | "empower"
  | "convert"
  | "carryIdle"
  | "carryWalk"
  | "construction";

export type ModelAnimationClock = "loop" | "action-cycle" | "once";
export type ModelVariantPolicy =
  | "entity"
  | "construction-stage"
  | "experience-tier"
  | "inventory"
  | "owner-age"
  | "gate-state"
  | "major-god";

export interface ModelActionDefinition {
  readonly models: readonly [string, ...string[]];
  readonly animationClock: ModelAnimationClock;
  readonly variant: ModelVariantPolicy;
  readonly variantValues?: readonly number[];
}

export interface RuntimeModelAttachmentDefinition {
  readonly modelIndex: number;
  readonly targetNode: string;
  readonly hotspotNode: string;
}

export interface RuntimeModelAssetDefinition {
  readonly key: string;
  readonly url: string;
  readonly grounded: boolean;
  readonly attachments?: readonly RuntimeModelAttachmentDefinition[];
}

export type ProjectileModelForwardAxis = "positive-z" | "negative-z" | "positive-y";

interface ProjectilePresentationMetrics {
  // Render-only height above terrain and parabolic arc. Gameplay collision
  // remains entirely in the simulation's horizontal plane.
  readonly flightHeight: number;
  readonly arcHeight: number;
  readonly audio?: AudioCueDefinition;
}

export interface ProjectileModelMediaDefinition extends ProjectilePresentationMetrics {
  readonly type: number;
  readonly key: string;
  readonly kind: "model";
  // Classic projectile proto visuals may select among multiple authored meshes.
  // Stable projectile identity selects the presentation variant without adding
  // renderer RNG or authoritative simulation state.
  readonly models: readonly [ModelAssetDefinition, ...ModelAssetDefinition[]];
  readonly forwardAxis: ProjectileModelForwardAxis;
}

export interface ProjectileParticleMediaDefinition extends ProjectilePresentationMetrics {
  readonly type: number;
  readonly key: string;
  readonly kind: "particle";
  readonly textureUrl: string;
  readonly blend: "additive" | "normal";
  readonly particleCount: number;
  readonly trailLength: number;
  readonly baseScale: number;
  readonly scaleStart: number;
  readonly scaleEnd: number;
  readonly peakOpacity: number;
}

export interface ProjectileInvisibleMediaDefinition extends ProjectilePresentationMetrics {
  readonly type: number;
  readonly key: string;
  readonly kind: "invisible";
}

export type ProjectileMediaDefinition =
  | ProjectileModelMediaDefinition
  | ProjectileParticleMediaDefinition
  | ProjectileInvisibleMediaDefinition;

export interface RuntimeProjectileModelPresentation extends ProjectilePresentationMetrics {
  readonly kind: "model";
  readonly modelIndices: readonly [number, ...number[]];
  readonly forwardAxis: ProjectileModelForwardAxis;
}

export type RuntimeProjectilePresentation =
  | RuntimeProjectileModelPresentation
  | ProjectileParticleMediaDefinition
  | ProjectileInvisibleMediaDefinition;

export interface RuntimeModelActionDefinition {
  readonly modelIndices: readonly [number, ...number[]];
  readonly animationClock: ModelAnimationClock;
  readonly variant: ModelVariantPolicy;
  readonly variantValues?: readonly number[];
}

interface PresentationMetrics {
  readonly worldHeight: number;
  readonly bottomPadding: number;
}

export interface ModelUnitPresentation extends PresentationMetrics {
  readonly kind: "model";
  readonly hideDuringSpecialAttack?: boolean;
  readonly actions: Readonly<
    { idle: ModelActionDefinition } & Partial<Record<UnitMediaAction, ModelActionDefinition>>
  >;
}

export interface RuntimeModelUnitPresentation extends PresentationMetrics {
  readonly kind: "model";
  readonly hideDuringSpecialAttack?: boolean;
  readonly actions: Readonly<
    { idle: RuntimeModelActionDefinition } & Partial<
      Record<UnitMediaAction, RuntimeModelActionDefinition>
    >
  >;
}

interface ConstructionStage {
  readonly threshold: number;
}

type ConstructionStages = readonly [ConstructionStage, ...ConstructionStage[]];

export type StaticSpriteFramePolicy =
  | { readonly kind: "fixed"; readonly columns: 1 }
  | { readonly kind: "variation"; readonly columns: number }
  | { readonly kind: "depletion"; readonly columns: number }
  | {
      readonly kind: "construction";
      readonly completedFrames: number;
      readonly stages: ConstructionStages;
    };

export interface StaticSpritePresentation extends PresentationMetrics {
  readonly kind: "sprite";
  readonly url: string;
  readonly frames: StaticSpriteFramePolicy;
}

export type UnitPresentation = ModelUnitPresentation | StaticSpritePresentation;
export type RuntimeUnitPresentation = RuntimeModelUnitPresentation | StaticSpritePresentation;

export interface UnitMediaDefinition {
  readonly type: number;
  readonly key: string;
  readonly presentation: UnitPresentation;
  readonly models: readonly ModelAssetDefinition[];
  readonly effects?: readonly ParticleEffectMediaDefinition[];
  readonly beam?: BeamEffectMediaDefinition;
  readonly icon: IconConfig | null;
  readonly audio: UnitAudioDefinition;
}

export const NO_MODELS: readonly ModelAssetDefinition[] = Object.freeze([]);
export const NO_AUDIO: UnitAudioDefinition = Object.freeze({});

export function loop(
  models: readonly [string, ...string[]],
  variant: ModelVariantPolicy = "entity",
): ModelActionDefinition {
  return { models, animationClock: "loop", variant };
}

export function actionCycle(
  models: readonly [string, ...string[]],
  variant: ModelVariantPolicy = "entity",
): ModelActionDefinition {
  return { models, animationClock: "action-cycle", variant };
}

export function once(
  models: readonly [string, ...string[]],
  variant: ModelVariantPolicy = "entity",
): ModelActionDefinition {
  return { models, animationClock: "once", variant };
}
