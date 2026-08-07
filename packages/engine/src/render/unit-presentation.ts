import {
  AGE_MYTHIC,
  FOOD,
  GATHER_COOLDOWN_TICKS,
  GOLD,
  idIndex,
  MODE_BUILDING,
  MODE_EATING_RESOURCE,
  MODE_GATHERING,
  MODE_HEALING,
  MODE_EMPOWERING,
  MODE_CONVERTING,
  MODE_PRAYING,
  TARGET_REACTION_NONE,
  TARGET_REACTION_THROWN,
  TICK_HZ,
  UNIT_TYPES,
  WOOD,
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
    const special = stats.specialAttack;
    if (special?.kind === "charged-jump") {
      const elapsedTicks = special.actionTicks - snapshot.specialActionRemaining[index]!;
      if (elapsedTicks < special.takeoffTicks && actions.jumpTakeoff) return "jumpTakeoff";
      if (elapsedTicks >= special.impactDelayTicks && actions.jumpLand) return "jumpLand";
    }
    return "specialAttack";
  }
  const carriesRelic = snapshot.carriedRelicCount[index]! > 0;
  if (moved && carriesRelic && actions.carryWalk) return "carryWalk";
  if (moved && actions.walk) return "walk";
  if (snapshot.mode[index] === MODE_PRAYING && actions.pray) return "pray";
  if (snapshot.mode[index] === MODE_HEALING && actions.heal) return "heal";
  if (snapshot.mode[index] === MODE_EMPOWERING && actions.empower) return "empower";
  if (snapshot.mode[index] === MODE_CONVERTING && actions.convert) return "convert";
  if (snapshot.mode[index] === MODE_BUILDING && actions.build) return "build";
  if (
    snapshot.mode[index] === MODE_GATHERING ||
    snapshot.mode[index] === MODE_EATING_RESOURCE
  ) {
    const targetType = snapshot.gatherTargetType[index]!;
    const targetStats = UNIT_TYPES[targetType];
    if (targetStats?.resource === GOLD && actions.gatherGold) return "gatherGold";
    if (targetStats?.resource === FOOD && actions.gatherFood) return "gatherFood";
    if (targetStats?.resource === WOOD && actions.gatherWood) return "gatherWood";
  }
  if (snapshot.actionCooldown[index]! > 0 && actions.attack) {
    if (snapshot.secondaryAttack[index] === 1 && actions.secondaryAttack) {
      return "secondaryAttack";
    }
    const attack = stats.attack;
    if (
      attack?.kind !== "melee" ||
      attack.cycleVariants === undefined ||
      snapshot.meleeActionVariant[index]! < attack.cycleVariants.length
    ) {
      return "attack";
    }
  }
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
  if (action === "attack") {
    const attack = UNIT_TYPES[snapshot.unitType[index]!]!.attack;
    const authoredVariant = snapshot.meleeActionVariant[index]!;
    if (
      attack?.kind === "melee" &&
      attack.cycleVariants !== undefined &&
      authoredVariant < attack.cycleVariants.length
    ) {
      variant = authoredVariant;
    }
  }
  if (definition.variant === "construction-stage") {
    const stats = UNIT_TYPES[snapshot.unitType[index]!]!;
    const buildFraction = snapshot.buildProgress[index]! / Math.max(1, stats.buildTicks);
    variant = Math.min(
      definition.modelIndices.length - 1,
      Math.floor(buildFraction * definition.modelIndices.length),
    );
  }
  if (definition.variant === "experience-tier") {
    const attackDefinition = UNIT_TYPES[snapshot.unitType[index]!]!.attack;
    const scaling = attackDefinition?.kind === "melee" ? attackDefinition.killScaling : undefined;
    if (scaling === undefined)
      throw new TypeError("Experience-tier presentation requires melee kill scaling.");
    // A kill can cross a tier on the impact frame. The selected attack clip
    // remains authoritative through recovery; idle/walk switch immediately.
    if (
      action !== "attack" ||
      snapshot.meleeActionVariant[index]! >= definition.modelIndices.length
    ) {
      variant = Math.min(
        definition.modelIndices.length - 1,
        Math.floor(snapshot.combatExperienceKills[index]! / scaling.killsPerVariant),
      );
    }
  }
  if (definition.variant === "inventory") {
    variant = snapshot.carried[index]! > 0 ? definition.modelIndices.length - 1 : 0;
  }
  if (definition.variant === "owner-age") {
    const age = snapshot.playerAges[snapshot.owner[index]!]!;
    const firstAuthoredAge = AGE_MYTHIC - (definition.modelIndices.length - 1);
    variant = Math.min(definition.modelIndices.length - 1, Math.max(0, age - firstAuthoredAge));
  }
  if (definition.variant === "gate-state") {
    variant = snapshot.gateOpen[index] === 1 ? definition.modelIndices.length - 1 : 0;
  }
  if (definition.variant === "major-god") {
    const values = definition.variantValues;
    const majorGod = snapshot.playerMajorGods[snapshot.owner[index]!]!;
    const authoredIndex = values?.indexOf(majorGod) ?? -1;
    variant = authoredIndex >= 0 ? authoredIndex : 0;
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
  if (
    presentation.hideDuringSpecialAttack === true &&
    snapshot.specialActionRemaining[index]! > 0
  ) {
    return null;
  }

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
  combatExperienceKills = 0,
  ownerAge = 0,
  carried = 0,
): ResolvedModelPresentation | null {
  const presentation = UNIT_PRESENTATIONS[unitType];
  if (!presentation || presentation.kind !== "model") return null;
  const action = presentation.actions.death;
  if (!action) return null;
  let variant = idIndex(entityId) % action.modelIndices.length;
  if (action.variant === "experience-tier") {
    const attack = UNIT_TYPES[unitType]!.attack;
    const scaling = attack?.kind === "melee" ? attack.killScaling : undefined;
    if (scaling === undefined) {
      throw new TypeError("Experience-tier death presentation requires melee kill scaling.");
    }
    variant = Math.min(
      action.modelIndices.length - 1,
      Math.floor(combatExperienceKills / scaling.killsPerVariant),
    );
  }
  if (action.variant === "inventory") {
    variant = carried > 0 ? action.modelIndices.length - 1 : 0;
  }
  if (action.variant === "owner-age") {
    const firstAuthoredAge = AGE_MYTHIC - (action.modelIndices.length - 1);
    variant = Math.min(action.modelIndices.length - 1, Math.max(0, ownerAge - firstAuthoredAge));
  }
  return {
    modelIndex: action.modelIndices[variant]!,
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
    const special = stats.specialAttack;
    if (
      special?.kind === "charged-jump" &&
      (presentation.action === "jumpTakeoff" ||
        presentation.action === "specialAttack" ||
        presentation.action === "jumpLand")
    ) {
      const elapsedTicks = special.actionTicks - snapshot.specialActionRemaining[index]! + alpha;
      const phaseStart =
        presentation.action === "jumpTakeoff"
          ? 0
          : presentation.action === "specialAttack"
            ? special.takeoffTicks
            : special.impactDelayTicks;
      const phaseTicks =
        presentation.action === "jumpTakeoff"
          ? special.takeoffTicks
          : presentation.action === "specialAttack"
            ? special.flightTicks
            : special.landingTicks;
      return duration * (Math.min(phaseTicks, Math.max(0, elapsedTicks - phaseStart)) / phaseTicks);
    }
    const actionTicks =
      presentation.action === "attack"
        ? stats.attack?.kind === "melee" && stats.attack.cycleVariants !== undefined
          ? (stats.attack.cycleVariants[snapshot.meleeActionVariant[index]!]?.actionTicks ??
            stats.attack.cooldownTicks)
          : (stats.attack?.cooldownTicks ?? GATHER_COOLDOWN_TICKS)
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
