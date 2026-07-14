import {
  GATHER_COOLDOWN_TICKS,
  idIndex,
  MODE_BUILDING,
  MODE_GATHERING,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_MILITIA,
  TYPE_TREE,
  TYPE_VILLAGER,
  type RenderSnapshot,
} from "@aom/sim";
import barracksSpriteUrl from "../assets/barracks.png";
import berryBushSpriteUrl from "../assets/berry-bush.png";
import goldMineSpriteUrl from "../assets/gold-mine.png";
import houseSpriteUrl from "../assets/house.png";
import townCenterSpriteUrl from "../assets/town-center.png";
import treeWoodSpriteUrl from "../assets/tree-wood.png";
import type { ModelKey } from "./model-assets";

interface PresentationMetrics {
  worldHeight: number;
  bottomPadding: number;
}

export interface ModelUnitPresentation extends PresentationMetrics {
  kind: "model";
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
  kind: "sprite";
  url: string;
  frames: StaticSpriteFramePolicy;
}

export type UnitPresentation = ModelUnitPresentation | StaticSpritePresentation;

export const UNIT_PRESENTATIONS: readonly UnitPresentation[] = [
  { kind: "model", worldHeight: 2.2, bottomPadding: 0 },
  { kind: "model", worldHeight: 2.2, bottomPadding: 0 },
  {
    kind: "sprite",
    url: treeWoodSpriteUrl,
    frames: { kind: "variation", columns: 3 },
    worldHeight: 3.8,
    bottomPadding: 0,
  },
  {
    kind: "sprite",
    url: berryBushSpriteUrl,
    frames: { kind: "fixed", columns: 1 },
    worldHeight: 1.3,
    bottomPadding: 0,
  },
  {
    kind: "sprite",
    url: townCenterSpriteUrl,
    frames: { kind: "fixed", columns: 1 },
    worldHeight: 5.5,
    bottomPadding: 0,
  },
  {
    kind: "sprite",
    url: houseSpriteUrl,
    frames: {
      kind: "construction",
      completedFrames: 3,
      stages: [{ threshold: 0 }, { threshold: 0.33 }, { threshold: 0.66 }],
    },
    worldHeight: 2.6,
    bottomPadding: 0,
  },
  {
    kind: "sprite",
    url: barracksSpriteUrl,
    frames: { kind: "fixed", columns: 1 },
    worldHeight: 4.2,
    bottomPadding: 0,
  },
  {
    kind: "sprite",
    url: goldMineSpriteUrl,
    frames: { kind: "depletion", columns: 4 },
    worldHeight: 2.8,
    bottomPadding: 0,
  },
];

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
      for (let i = 1; i < policy.stages.length; i += 1) {
        if (buildFrac < policy.stages[i]!.threshold) break;
        stage = i;
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

export type ModelAnimationClock = "loop" | "action-cycle";

export interface ResolvedModelPresentation {
  model: ModelKey;
  animationClock: ModelAnimationClock;
}

type VillagerSex = "male" | "female";
type VillagerAction = "idle" | "walk" | "mine" | "harvest" | "chop" | "build";

function looping(model: ModelKey): ResolvedModelPresentation {
  return { model, animationClock: "loop" };
}

function actionCycle(model: ModelKey): ResolvedModelPresentation {
  return { model, animationClock: "action-cycle" };
}

const VILLAGER_PRESENTATIONS = {
  male: {
    idle: looping("villagerMaleIdle"),
    walk: looping("villagerMaleWalk"),
    mine: actionCycle("villagerMaleMine"),
    harvest: actionCycle("villagerMaleHarvest"),
    chop: actionCycle("villagerMaleChop"),
    build: actionCycle("villagerMaleBuild"),
  },
  female: {
    idle: looping("villagerFemaleIdle"),
    walk: looping("villagerFemaleWalk"),
    mine: actionCycle("villagerFemaleMine"),
    harvest: actionCycle("villagerFemaleHarvest"),
    chop: actionCycle("villagerFemaleChop"),
    build: actionCycle("villagerFemaleBuild"),
  },
} satisfies Record<VillagerSex, Record<VillagerAction, ResolvedModelPresentation>>;

const MILITIA_PRESENTATIONS = {
  idle: looping("militiaIdle"),
  walk: looping("militiaWalk"),
};

function villagerAction(snapshot: RenderSnapshot, index: number, moved: boolean): VillagerAction {
  if (snapshot.moving[index] === 0) {
    if (snapshot.mode[index] === MODE_BUILDING) return "build";
    if (snapshot.mode[index] === MODE_GATHERING) {
      if (snapshot.gatherTargetType[index] === TYPE_GOLD_MINE) return "mine";
      if (snapshot.gatherTargetType[index] === TYPE_BERRY) return "harvest";
      if (snapshot.gatherTargetType[index] === TYPE_TREE) return "chop";
    }
  }

  return moved ? "walk" : "idle";
}

export function resolveModelPresentation(
  snapshot: RenderSnapshot,
  index: number,
  moved: boolean,
): ResolvedModelPresentation | null {
  const type = snapshot.unitType[index]!;

  if (type === TYPE_VILLAGER) {
    const sex: VillagerSex = (idIndex(snapshot.ids[index]!) & 1) === 0 ? "male" : "female";
    return VILLAGER_PRESENTATIONS[sex][villagerAction(snapshot, index, moved)];
  }

  if (type === TYPE_MILITIA) return moved ? MILITIA_PRESENTATIONS.walk : MILITIA_PRESENTATIONS.idle;
  return null;
}

const SIM_TICK_HZ = 20;

export function modelAnimationTime(
  presentation: ResolvedModelPresentation,
  snapshot: RenderSnapshot,
  index: number,
  alpha: number,
  duration: number,
): number {
  if (presentation.animationClock === "action-cycle") {
    const elapsedTicks = Math.min(
      GATHER_COOLDOWN_TICKS,
      Math.max(0, GATHER_COOLDOWN_TICKS - snapshot.actionCooldown[index]! + alpha),
    );
    return duration * (elapsedTicks / Math.max(1, GATHER_COOLDOWN_TICKS));
  }

  return (snapshot.tick + alpha) / SIM_TICK_HZ + (snapshot.ids[index]! % 17) * 0.037;
}
