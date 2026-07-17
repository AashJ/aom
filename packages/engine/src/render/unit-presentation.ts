import {
  GATHER_COOLDOWN_TICKS,
  idIndex,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_PRAYING,
  TARGET_REACTION_NONE,
  TARGET_REACTION_THROWN,
  TICK_HZ,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_TREE,
  UNIT_TYPES,
  type RenderSnapshot,
} from "@aom/sim";
import { UNIT_PRESENTATIONS } from "../content/generated/unit-media";
import type {
  ModelAnimationClock,
  RuntimeModelActionDefinition,
  RuntimeModelUnitPresentation,
  StaticSpritePresentation,
  UnitMediaAction,
} from "../content/unit-media-schema";

export { UNIT_PRESENTATIONS };
export type {
  StaticSpriteFramePolicy,
  StaticSpritePresentation,
  UnitPresentation,
} from "../content/unit-media-schema";

export interface ResolvedStaticSpritePresentation {
  readonly frame: number;
  readonly buildFrac: number;
}

export function staticSpriteColumns(presentation: StaticSpritePresentation): number {
  const policy = presentation.frames;
  return policy.kind === "construction"
    ? policy.completedFrames + policy.stages.length
    : policy.columns;
}

export function resolveStaticSpritePresentation(
  presentation: StaticSpritePresentation,
  id: number,
  hpFrac: number,
  buildFrac: number,
): ResolvedStaticSpritePresentation {
  const policy = presentation.frames;

  if (policy.kind === "construction") {
    if (buildFrac < 1) {
      let stage = 0;
      for (let index = 1; index < policy.stages.length; index += 1) {
        if (buildFrac < policy.stages[index]!.threshold) break;
        stage = index;
      }
      return { frame: policy.completedFrames + stage, buildFrac: 1 };
    }

    return { frame: id % policy.completedFrames, buildFrac: 1 };
  }

  if (policy.kind === "variation") return { frame: id % policy.columns, buildFrac };
  if (policy.kind === "depletion") {
    const depletionFrame = Math.floor((1 - hpFrac) * policy.columns);
    return {
      frame: Math.min(policy.columns - 1, Math.max(0, depletionFrame)),
      buildFrac,
    };
  }
  return { frame: 0, buildFrac };
}

export interface ResolvedModelPresentation {
  readonly modelIndex: number;
  readonly action: UnitMediaAction;
  readonly animationClock: ModelAnimationClock;
}

function targetReactionAction(kind: number): UnitMediaAction | null {
  switch (kind) {
    case TARGET_REACTION_NONE:
      return null;
    case TARGET_REACTION_THROWN:
      // Classic's thrown action owns the victim without selecting a locomotion
      // or attack clip. The source model has no separate thrown animation.
      return "idle";
    default:
      throw new RangeError(`Unsupported target-reaction presentation kind ${kind}.`);
  }
}

function actionFor(
  presentation: RuntimeModelUnitPresentation,
  snapshot: RenderSnapshot,
  index: number,
  moved: boolean,
): UnitMediaAction {
  const actions = presentation.actions;
  const stats = UNIT_TYPES[snapshot.unitType[index]!]!;

  if (
    actions.construction &&
    stats.buildTicks > 0 &&
    snapshot.buildProgress[index]! < stats.buildTicks
  ) {
    return "construction";
  }
  const reactionAction = targetReactionAction(snapshot.targetReactionKind[index]!);
  if (reactionAction !== null) return reactionAction;
  if (snapshot.specialActionRemaining[index]! > 0 && actions.specialAttack) {
    return "specialAttack";
  }
  const carriesRelic = snapshot.carriedRelicCount[index]! > 0;
  if (moved && carriesRelic && actions.carryWalk) return "carryWalk";
  if (moved && actions.walk) return "walk";
  if (snapshot.mode[index] === MODE_PRAYING && actions.pray) return "pray";
  if (snapshot.mode[index] === MODE_BUILDING && actions.build) return "build";
  if (snapshot.mode[index] === MODE_GATHERING) {
    const targetType = snapshot.gatherTargetType[index]!;
    if (targetType === TYPE_GOLD_MINE && actions.gatherGold) return "gatherGold";
    if (targetType === TYPE_BERRY && actions.gatherFood) return "gatherFood";
    if (targetType === TYPE_TREE && actions.gatherWood) return "gatherWood";
  }
  if (snapshot.actionCooldown[index]! > 0 && actions.attack) return "attack";
  if (carriesRelic && actions.carryIdle) return "carryIdle";
  return "idle";
}

function resolveModelAction(
  definition: RuntimeModelActionDefinition,
  action: UnitMediaAction,
  snapshot: RenderSnapshot,
  index: number,
): ResolvedModelPresentation {
  let variant = idIndex(snapshot.ids[index]!) % definition.modelIndices.length;
  if (definition.variant === "construction-stage") {
    const stats = UNIT_TYPES[snapshot.unitType[index]!]!;
    const buildFraction = snapshot.buildProgress[index]! / Math.max(1, stats.buildTicks);
    variant = Math.min(
      definition.modelIndices.length - 1,
      Math.floor(buildFraction * definition.modelIndices.length),
    );
  }
  return {
    modelIndex: definition.modelIndices[variant]!,
    action,
    animationClock: definition.animationClock,
  };
}

export function resolveModelPresentation(
  snapshot: RenderSnapshot,
  index: number,
  moved: boolean,
): ResolvedModelPresentation | null {
  const presentation = UNIT_PRESENTATIONS[snapshot.unitType[index]!];
  if (!presentation || presentation.kind !== "model") return null;

  const action = actionFor(presentation, snapshot, index, moved);
  return resolveModelAction(presentation.actions[action]!, action, snapshot, index);
}

export function resolveModelGhostPresentation(
  _snapshot: RenderSnapshot,
  unitType: number,
): ResolvedModelPresentation | null {
  const presentation = UNIT_PRESENTATIONS[unitType];
  if (!presentation || presentation.kind !== "model") return null;
  const action = presentation.actions.idle;
  return {
    modelIndex: action.modelIndices[0],
    action: "idle",
    animationClock: action.animationClock,
  };
}

export function resolveModelDeathPresentation(
  unitType: number,
  entityId: number,
): ResolvedModelPresentation | null {
  const presentation = UNIT_PRESENTATIONS[unitType];
  if (!presentation || presentation.kind !== "model") return null;
  const action = presentation.actions.death;
  if (!action) return null;
  return {
    modelIndex: action.modelIndices[idIndex(entityId) % action.modelIndices.length]!,
    action: "death",
    animationClock: action.animationClock,
  };
}

export function resolveStaticSpriteUnitPresentation(
  snapshot: RenderSnapshot,
  index: number,
): StaticSpritePresentation | null {
  const presentation = UNIT_PRESENTATIONS[snapshot.unitType[index]!];
  return presentation?.kind === "sprite" ? presentation : null;
}

export function resolveStaticSpriteGhostPresentation(
  _snapshot: RenderSnapshot,
  unitType: number,
): StaticSpritePresentation | null {
  const presentation = UNIT_PRESENTATIONS[unitType];
  return presentation?.kind === "sprite" ? presentation : null;
}

export function modelAnimationTime(
  presentation: ResolvedModelPresentation,
  snapshot: RenderSnapshot,
  index: number,
  alpha: number,
  duration: number,
): number {
  if (presentation.animationClock === "action-cycle") {
    const stats = UNIT_TYPES[snapshot.unitType[index]!]!;
    const actionTicks =
      presentation.action === "attack"
        ? (stats.attack?.cooldownTicks ?? GATHER_COOLDOWN_TICKS)
        : presentation.action === "specialAttack"
          ? (stats.specialAttack?.actionTicks ?? GATHER_COOLDOWN_TICKS)
          : GATHER_COOLDOWN_TICKS;
    const remainingTicks =
      presentation.action === "specialAttack"
        ? snapshot.specialActionRemaining[index]!
        : snapshot.actionCooldown[index]!;
    const elapsedTicks = Math.min(actionTicks, Math.max(0, actionTicks - remainingTicks + alpha));
    return duration * (elapsedTicks / Math.max(1, actionTicks));
  }

  return (snapshot.tick + alpha) / TICK_HZ + (snapshot.ids[index]! % 17) * 0.037;
}
