import {
  GATHER_COOLDOWN_TICKS,
  GOD_RA,
  idIndex,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_PRAYING,
  TICK_HZ,
  TYPE_BARRACKS,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_HOUSE,
  TYPE_MILITIA,
  TYPE_TEMPLE,
  TYPE_TOWN_CENTER,
  TYPE_TREE,
  TYPE_VILLAGER,
  UNIT_TYPES,
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
  {
    // Temporary presentation until the Greek Temple model is added to the
    // existing private-asset extraction pipeline.
    kind: "sprite",
    url: barracksSpriteUrl,
    frames: { kind: "fixed", columns: 1 },
    worldHeight: 4.8,
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

const EGYPTIAN_VILLAGER_PRESENTATIONS = {
  male: {
    idle: looping("egyptianVillagerMaleIdle"),
    walk: looping("egyptianVillagerMaleWalk"),
    mine: actionCycle("egyptianVillagerMaleMine"),
    harvest: actionCycle("egyptianVillagerMaleHarvest"),
    chop: actionCycle("egyptianVillagerMaleChop"),
    build: actionCycle("egyptianVillagerMaleBuild"),
  },
  female: {
    idle: looping("egyptianVillagerFemaleIdle"),
    walk: looping("egyptianVillagerFemaleWalk"),
    mine: actionCycle("egyptianVillagerFemaleMine"),
    harvest: actionCycle("egyptianVillagerFemaleHarvest"),
    chop: actionCycle("egyptianVillagerFemaleChop"),
    build: actionCycle("egyptianVillagerFemaleBuild"),
  },
} satisfies Record<VillagerSex, Record<VillagerAction, ResolvedModelPresentation>>;

const GREEK_PRAYER_PRESENTATIONS = {
  male: [looping("villagerMalePrayA"), looping("villagerMalePrayB")],
  female: [looping("villagerFemalePrayA"), looping("villagerFemalePrayB")],
} satisfies Record<VillagerSex, readonly [ResolvedModelPresentation, ResolvedModelPresentation]>;

const MILITIA_PRESENTATIONS = {
  idle: looping("militiaIdle"),
  walk: looping("militiaWalk"),
};

const EGYPTIAN_HOUSE_PRESENTATION = looping("egyptianHouse");
const EGYPTIAN_TOWN_CENTER_PRESENTATION = looping("egyptianTownCenter");
const GREEK_BARRACKS_PRESENTATION = looping("greekBarracks");
const GREEK_HOUSE_PRESENTATIONS = [
  looping("greekHouseA"),
  looping("greekHouseB"),
  looping("greekHouseC"),
] as const;
const GREEK_HOUSE_CONSTRUCTION_PRESENTATIONS = [
  looping("greekHouseConstructionA"),
  looping("greekHouseConstructionB"),
  looping("greekHouseConstructionC"),
] as const;
const GREEK_TEMPLE_PRESENTATION = looping("greekTemple");
const GREEK_TOWN_CENTER_PRESENTATION = looping("greekTownCenter");

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
  const isEgyptian = snapshot.playerMajorGods[snapshot.owner[index]!] === GOD_RA;

  if (type === TYPE_VILLAGER) {
    const entityIndex = idIndex(snapshot.ids[index]!);
    const sex: VillagerSex = (entityIndex & 1) === 0 ? "male" : "female";
    if (!isEgyptian && snapshot.moving[index] === 0 && snapshot.mode[index] === MODE_PRAYING) {
      const prayers = GREEK_PRAYER_PRESENTATIONS[sex];
      return prayers[(entityIndex >>> 1) % prayers.length]!;
    }
    const presentations = isEgyptian ? EGYPTIAN_VILLAGER_PRESENTATIONS : VILLAGER_PRESENTATIONS;
    return presentations[sex][villagerAction(snapshot, index, moved)];
  }

  if (type === TYPE_TOWN_CENTER) {
    return isEgyptian ? EGYPTIAN_TOWN_CENTER_PRESENTATION : GREEK_TOWN_CENTER_PRESENTATION;
  }
  if (type === TYPE_HOUSE) {
    if (isEgyptian) return EGYPTIAN_HOUSE_PRESENTATION;
    const buildTicks = UNIT_TYPES[TYPE_HOUSE]!.buildTicks;
    const buildProgress = snapshot.buildProgress[index]!;
    if (buildProgress < buildTicks) {
      const buildFrac = buildProgress / buildTicks;
      const stage = buildFrac < 0.33 ? 0 : buildFrac < 0.66 ? 1 : 2;
      return GREEK_HOUSE_CONSTRUCTION_PRESENTATIONS[stage];
    }
    return GREEK_HOUSE_PRESENTATIONS[
      idIndex(snapshot.ids[index]!) % GREEK_HOUSE_PRESENTATIONS.length
    ]!;
  }
  if (!isEgyptian && type === TYPE_BARRACKS) return GREEK_BARRACKS_PRESENTATION;
  if (!isEgyptian && type === TYPE_TEMPLE) return GREEK_TEMPLE_PRESENTATION;
  if (type === TYPE_MILITIA) return moved ? MILITIA_PRESENTATIONS.walk : MILITIA_PRESENTATIONS.idle;
  return null;
}

export function resolveModelGhostPresentation(
  snapshot: RenderSnapshot,
  unitType: number,
): ResolvedModelPresentation | null {
  const isEgyptian = snapshot.majorGod === GOD_RA;
  if (unitType === TYPE_TOWN_CENTER) {
    return isEgyptian ? EGYPTIAN_TOWN_CENTER_PRESENTATION : GREEK_TOWN_CENTER_PRESENTATION;
  }
  if (unitType === TYPE_HOUSE) {
    return isEgyptian ? EGYPTIAN_HOUSE_PRESENTATION : GREEK_HOUSE_PRESENTATIONS[0];
  }
  if (!isEgyptian && unitType === TYPE_BARRACKS) return GREEK_BARRACKS_PRESENTATION;
  if (!isEgyptian && unitType === TYPE_TEMPLE) return GREEK_TEMPLE_PRESENTATION;
  return null;
}

export function resolveStaticSpriteUnitPresentation(
  snapshot: RenderSnapshot,
  index: number,
): StaticSpritePresentation | null {
  const presentation = UNIT_PRESENTATIONS[snapshot.unitType[index]!];

  if (!presentation || presentation.kind !== "sprite") return null;
  return resolveModelPresentation(snapshot, index, false) ? null : presentation;
}

export function resolveStaticSpriteGhostPresentation(
  snapshot: RenderSnapshot,
  unitType: number,
): StaticSpritePresentation | null {
  const presentation = UNIT_PRESENTATIONS[unitType];

  if (!presentation || presentation.kind !== "sprite") return null;
  return resolveModelGhostPresentation(snapshot, unitType) ? null : presentation;
}

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

  return (snapshot.tick + alpha) / TICK_HZ + (snapshot.ids[index]! % 17) * 0.037;
}
