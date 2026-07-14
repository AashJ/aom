import {
  GATHER_COOLDOWN_TICKS,
  MODE_GATHERING,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_MILITIA,
  TYPE_VILLAGER,
  type RenderSnapshot,
} from "@aom/sim";
import barracksSpriteUrl from "../assets/barracks.png";
import berryBushSpriteUrl from "../assets/berry-bush.png";
import goldMineSpriteUrl from "../assets/gold-mine.png";
import houseSpriteUrl from "../assets/house.png";
import townCenterSpriteUrl from "../assets/town-center.png";
import treeWoodSpriteUrl from "../assets/tree-wood.png";
import {
  MODEL_MILITIA_IDLE,
  MODEL_MILITIA_WALK,
  MODEL_VILLAGER_HARVEST,
  MODEL_VILLAGER_IDLE,
  MODEL_VILLAGER_MINE,
  MODEL_VILLAGER_WALK,
} from "./model-assets";

interface PresentationMetrics {
  worldHeight: number;
  bottomPadding: number;
}

export interface ModelUnitPresentation extends PresentationMetrics {
  kind: "model";
}

export interface StaticSpritePresentation extends PresentationMetrics {
  kind: "sprite";
  url: string;
  columns: number;
  staticFrames?: "variation" | "depletion";
}

export type UnitPresentation = ModelUnitPresentation | StaticSpritePresentation;

export const UNIT_PRESENTATIONS: readonly UnitPresentation[] = [
  { kind: "model", worldHeight: 2.2, bottomPadding: 0 },
  { kind: "model", worldHeight: 2.2, bottomPadding: 0 },
  {
    kind: "sprite",
    url: treeWoodSpriteUrl,
    columns: 3,
    worldHeight: 3.8,
    bottomPadding: 0,
    staticFrames: "variation",
  },
  {
    kind: "sprite",
    url: berryBushSpriteUrl,
    columns: 1,
    worldHeight: 1.3,
    bottomPadding: 0,
  },
  {
    kind: "sprite",
    url: townCenterSpriteUrl,
    columns: 1,
    worldHeight: 5.5,
    // The source has 189 transparent pixels below the visible base (189 / 1254 * 5.5).
    bottomPadding: 0.83,
  },
  {
    kind: "sprite",
    url: houseSpriteUrl,
    columns: 1,
    worldHeight: 2.6,
    bottomPadding: 0,
  },
  {
    kind: "sprite",
    url: barracksSpriteUrl,
    columns: 1,
    worldHeight: 4.2,
    bottomPadding: 0,
  },
  {
    kind: "sprite",
    url: goldMineSpriteUrl,
    columns: 4,
    worldHeight: 2.8,
    bottomPadding: 0,
    staticFrames: "depletion",
  },
];

export type ModelAnimationClock = "loop" | "gather-cycle";

export interface ResolvedModelPresentation {
  modelIndex: number;
  animationClock: ModelAnimationClock;
}

const VILLAGER_IDLE: ResolvedModelPresentation = {
  modelIndex: MODEL_VILLAGER_IDLE,
  animationClock: "loop",
};
const VILLAGER_WALK: ResolvedModelPresentation = {
  modelIndex: MODEL_VILLAGER_WALK,
  animationClock: "loop",
};
const VILLAGER_MINE: ResolvedModelPresentation = {
  modelIndex: MODEL_VILLAGER_MINE,
  animationClock: "gather-cycle",
};
const VILLAGER_HARVEST: ResolvedModelPresentation = {
  modelIndex: MODEL_VILLAGER_HARVEST,
  animationClock: "gather-cycle",
};
const MILITIA_IDLE: ResolvedModelPresentation = {
  modelIndex: MODEL_MILITIA_IDLE,
  animationClock: "loop",
};
const MILITIA_WALK: ResolvedModelPresentation = {
  modelIndex: MODEL_MILITIA_WALK,
  animationClock: "loop",
};

export function resolveModelPresentation(
  snapshot: RenderSnapshot,
  index: number,
  moved: boolean,
): ResolvedModelPresentation | null {
  const type = snapshot.unitType[index]!;

  if (type === TYPE_VILLAGER) {
    if (snapshot.mode[index] === MODE_GATHERING && snapshot.moving[index] === 0) {
      if (snapshot.gatherTargetType[index] === TYPE_GOLD_MINE) return VILLAGER_MINE;
      if (snapshot.gatherTargetType[index] === TYPE_BERRY) return VILLAGER_HARVEST;
    }

    return moved ? VILLAGER_WALK : VILLAGER_IDLE;
  }

  if (type === TYPE_MILITIA) return moved ? MILITIA_WALK : MILITIA_IDLE;
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
  if (presentation.animationClock === "gather-cycle") {
    const elapsedTicks = Math.min(
      GATHER_COOLDOWN_TICKS,
      Math.max(0, GATHER_COOLDOWN_TICKS - snapshot.actionCooldown[index]! + alpha),
    );
    return duration * (elapsedTicks / Math.max(1, GATHER_COOLDOWN_TICKS));
  }

  return (snapshot.tick + alpha) / SIM_TICK_HZ + (snapshot.ids[index]! % 17) * 0.037;
}
