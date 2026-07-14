import axeHatchetUrl from "../assets/models/attachments-a-axe-hatchet.glb?url";
import basketUrl from "../assets/models/attachments-a-basket.glb?url";
import militiaIdleUrl from "../assets/models/infantry-g-militia-idle.glb?url";
import militiaWalkUrl from "../assets/models/infantry-g-militia-walk.glb?url";
import hammerUrl from "../assets/models/tool-hammer.glb?url";
import pickaxeUrl from "../assets/models/tool-pickaxe-miners.glb?url";
import villagerFemaleBuildUrl from "../assets/models/villager-g-female-build.glb?url";
import villagerFemaleChopUrl from "../assets/models/villager-g-female-chop.glb?url";
import villagerFemaleHarvestUrl from "../assets/models/villager-g-female-harvest.glb?url";
import villagerFemaleIdleUrl from "../assets/models/villager-g-female-idle.glb?url";
import villagerFemaleMineUrl from "../assets/models/villager-g-female-mine.glb?url";
import villagerFemaleWalkUrl from "../assets/models/villager-g-female-walk.glb?url";
import villagerBuildUrl from "../assets/models/villager-g-male-build.glb?url";
import villagerChopUrl from "../assets/models/villager-g-male-chop.glb?url";
import villagerHarvestUrl from "../assets/models/villager-g-male-harvest.glb?url";
import villagerIdleUrl from "../assets/models/villager-g-male-idle.glb?url";
import villagerMineUrl from "../assets/models/villager-g-male-mine.glb?url";
import villagerWalkUrl from "../assets/models/villager-g-male-walk.glb?url";

interface ModelAttachmentDefinition<Model extends string> {
  readonly model: Model;
  readonly targetNode: string;
  readonly hotspotNode: string;
}

interface ModelDefinition<Model extends string> {
  readonly url: string;
  readonly grounded: boolean;
  readonly attachment?: ModelAttachmentDefinition<Model>;
}

function defineModelRegistry<
  const Definitions extends Record<string, ModelDefinition<Extract<keyof Definitions, string>>>,
>(definitions: Definitions): Definitions {
  return definitions;
}

const MODEL_DEFINITIONS = defineModelRegistry({
  villagerMaleIdle: { url: villagerIdleUrl, grounded: true },
  villagerMaleWalk: { url: villagerWalkUrl, grounded: true },
  villagerMaleMine: {
    url: villagerMineUrl,
    grounded: true,
    attachment: {
      model: "pickaxe",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  villagerMaleHarvest: {
    url: villagerHarvestUrl,
    grounded: true,
    attachment: {
      model: "basket",
      targetNode: "Dummy_lefthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  militiaIdle: { url: militiaIdleUrl, grounded: true },
  militiaWalk: { url: militiaWalkUrl, grounded: true },
  pickaxe: { url: pickaxeUrl, grounded: false },
  basket: { url: basketUrl, grounded: false },
  villagerMaleChop: {
    url: villagerChopUrl,
    grounded: true,
    attachment: {
      model: "axeHatchet",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  villagerMaleBuild: {
    url: villagerBuildUrl,
    grounded: true,
    attachment: {
      model: "hammer",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  axeHatchet: { url: axeHatchetUrl, grounded: false },
  hammer: { url: hammerUrl, grounded: false },
  villagerFemaleIdle: { url: villagerFemaleIdleUrl, grounded: true },
  villagerFemaleWalk: { url: villagerFemaleWalkUrl, grounded: true },
  villagerFemaleMine: {
    url: villagerFemaleMineUrl,
    grounded: true,
    attachment: {
      model: "pickaxe",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  villagerFemaleHarvest: {
    url: villagerFemaleHarvestUrl,
    grounded: true,
    attachment: {
      model: "basket",
      targetNode: "Dummy_lefthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  villagerFemaleChop: {
    url: villagerFemaleChopUrl,
    grounded: true,
    attachment: {
      model: "axeHatchet",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  villagerFemaleBuild: {
    url: villagerFemaleBuildUrl,
    grounded: true,
    attachment: {
      model: "hammer",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
});

export type ModelKey = Extract<keyof typeof MODEL_DEFINITIONS, string>;

interface ModelConfig extends ModelDefinition<ModelKey> {
  readonly key: ModelKey;
}

const modelKeys = Object.keys(MODEL_DEFINITIONS) as ModelKey[];

export const MODEL_CONFIGS: readonly ModelConfig[] = modelKeys.map((key) => ({
  key,
  ...MODEL_DEFINITIONS[key],
}));

export const MODEL_INDEX: Readonly<Record<ModelKey, number>> = Object.freeze(
  Object.fromEntries(modelKeys.map((key, index) => [key, index])) as Record<ModelKey, number>,
);
