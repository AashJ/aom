export interface IconConfig {
  readonly url: string;
  // Horizontal frames in the source image; 1 = a plain portrait.
  readonly columns: number;
}

export interface AudioCueDefinition {
  readonly files: readonly string[];
  readonly volume: number;
  readonly maxVoices: number;
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
  | "death"
  | "build"
  | "gatherFood"
  | "gatherWood"
  | "gatherGold"
  | "pray"
  | "construction";

export type ModelAnimationClock = "loop" | "action-cycle" | "once";
export type ModelVariantPolicy = "entity" | "construction-stage";

export interface ModelActionDefinition {
  readonly models: readonly [string, ...string[]];
  readonly animationClock: ModelAnimationClock;
  readonly variant: ModelVariantPolicy;
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
  readonly forwardAxis: ProjectileModelForwardAxis;
}

export interface ProjectileMediaDefinition extends ProjectilePresentationMetrics {
  readonly type: number;
  readonly key: string;
  readonly model: ModelAssetDefinition;
}

export interface RuntimeProjectilePresentation extends ProjectilePresentationMetrics {
  readonly modelIndex: number;
}

export interface RuntimeModelActionDefinition {
  readonly modelIndices: readonly [number, ...number[]];
  readonly animationClock: ModelAnimationClock;
  readonly variant: ModelVariantPolicy;
}

interface PresentationMetrics {
  readonly worldHeight: number;
  readonly bottomPadding: number;
}

export interface ModelUnitPresentation extends PresentationMetrics {
  readonly kind: "model";
  readonly actions: Readonly<
    { idle: ModelActionDefinition } & Partial<Record<UnitMediaAction, ModelActionDefinition>>
  >;
}

export interface RuntimeModelUnitPresentation extends PresentationMetrics {
  readonly kind: "model";
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
