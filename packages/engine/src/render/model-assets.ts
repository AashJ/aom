import axeHatchetUrl from "../assets/models/attachments-a-axe-hatchet.glb?url";
import basketUrl from "../assets/models/attachments-a-basket.glb?url";
import egyptianHouseUrl from "../assets/models/egyptian-house-age1.glb?url";
import egyptianTownCenterUrl from "../assets/models/egyptian-town-center-age1.glb?url";
import egyptianVillagerFemaleBuildUrl from "../assets/models/egyptian-villager-female-build.glb?url";
import egyptianVillagerFemaleChopUrl from "../assets/models/egyptian-villager-female-chop.glb?url";
import egyptianVillagerFemaleHarvestUrl from "../assets/models/egyptian-villager-female-harvest.glb?url";
import egyptianVillagerFemaleIdleUrl from "../assets/models/egyptian-villager-female-idle.glb?url";
import egyptianVillagerFemaleMineUrl from "../assets/models/egyptian-villager-female-mine.glb?url";
import egyptianVillagerFemaleWalkUrl from "../assets/models/egyptian-villager-female-walk.glb?url";
import egyptianVillagerMaleBuildUrl from "../assets/models/egyptian-villager-male-build.glb?url";
import egyptianVillagerMaleChopUrl from "../assets/models/egyptian-villager-male-chop.glb?url";
import egyptianVillagerMaleHarvestUrl from "../assets/models/egyptian-villager-male-harvest.glb?url";
import egyptianVillagerMaleIdleUrl from "../assets/models/egyptian-villager-male-idle.glb?url";
import egyptianVillagerMaleMineUrl from "../assets/models/egyptian-villager-male-mine.glb?url";
import egyptianVillagerMaleWalkUrl from "../assets/models/egyptian-villager-male-walk.glb?url";
import greekBarracksUrl from "../assets/models/greek-barracks-age1.glb?url";
import greekHouseAUrl from "../assets/models/greek-house-a-age0.glb?url";
import greekHouseBUrl from "../assets/models/greek-house-b-age0.glb?url";
import greekHouseCUrl from "../assets/models/greek-house-c-age0.glb?url";
import greekHouseConstructionAUrl from "../assets/models/greek-house-construction-a.glb?url";
import greekHouseConstructionBUrl from "../assets/models/greek-house-construction-b.glb?url";
import greekHouseConstructionCUrl from "../assets/models/greek-house-construction-c.glb?url";
import greekTempleUrl from "../assets/models/greek-temple-age0.glb?url";
import greekTownCenterUrl from "../assets/models/greek-town-center-age0.glb?url";
import militiaIdleUrl from "../assets/models/infantry-g-militia-idle.glb?url";
import militiaWalkUrl from "../assets/models/infantry-g-militia-walk.glb?url";
import hammerUrl from "../assets/models/tool-hammer.glb?url";
import pickaxeUrl from "../assets/models/tool-pickaxe-miners.glb?url";
import villagerFemaleBuildUrl from "../assets/models/villager-g-female-build.glb?url";
import villagerFemaleChopUrl from "../assets/models/villager-g-female-chop.glb?url";
import villagerFemaleHarvestUrl from "../assets/models/villager-g-female-harvest.glb?url";
import villagerFemaleIdleUrl from "../assets/models/villager-g-female-idle.glb?url";
import villagerFemaleMineUrl from "../assets/models/villager-g-female-mine.glb?url";
import villagerFemalePrayAUrl from "../assets/models/villager-g-female-pray-a.glb?url";
import villagerFemalePrayBUrl from "../assets/models/villager-g-female-pray-b.glb?url";
import villagerFemaleWalkUrl from "../assets/models/villager-g-female-walk.glb?url";
import villagerBuildUrl from "../assets/models/villager-g-male-build.glb?url";
import villagerChopUrl from "../assets/models/villager-g-male-chop.glb?url";
import villagerHarvestUrl from "../assets/models/villager-g-male-harvest.glb?url";
import villagerIdleUrl from "../assets/models/villager-g-male-idle.glb?url";
import villagerMineUrl from "../assets/models/villager-g-male-mine.glb?url";
import villagerPrayAUrl from "../assets/models/villager-g-male-pray-a.glb?url";
import villagerPrayBUrl from "../assets/models/villager-g-male-pray-b.glb?url";
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
  egyptianHouse: { url: egyptianHouseUrl, grounded: true },
  egyptianTownCenter: { url: egyptianTownCenterUrl, grounded: true },
  egyptianVillagerMaleIdle: { url: egyptianVillagerMaleIdleUrl, grounded: true },
  egyptianVillagerMaleWalk: { url: egyptianVillagerMaleWalkUrl, grounded: true },
  egyptianVillagerMaleMine: {
    url: egyptianVillagerMaleMineUrl,
    grounded: true,
    attachment: {
      model: "pickaxe",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  egyptianVillagerMaleHarvest: {
    url: egyptianVillagerMaleHarvestUrl,
    grounded: true,
    attachment: {
      model: "basket",
      targetNode: "Dummy_lefthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  egyptianVillagerMaleChop: {
    url: egyptianVillagerMaleChopUrl,
    grounded: true,
    attachment: {
      model: "axeHatchet",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  egyptianVillagerMaleBuild: {
    url: egyptianVillagerMaleBuildUrl,
    grounded: true,
    attachment: {
      model: "hammer",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  egyptianVillagerFemaleIdle: { url: egyptianVillagerFemaleIdleUrl, grounded: true },
  egyptianVillagerFemaleWalk: { url: egyptianVillagerFemaleWalkUrl, grounded: true },
  egyptianVillagerFemaleMine: {
    url: egyptianVillagerFemaleMineUrl,
    grounded: true,
    attachment: {
      model: "pickaxe",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  egyptianVillagerFemaleHarvest: {
    url: egyptianVillagerFemaleHarvestUrl,
    grounded: true,
    attachment: {
      model: "basket",
      targetNode: "Dummy_lefthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  egyptianVillagerFemaleChop: {
    url: egyptianVillagerFemaleChopUrl,
    grounded: true,
    attachment: {
      model: "axeHatchet",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  egyptianVillagerFemaleBuild: {
    url: egyptianVillagerFemaleBuildUrl,
    grounded: true,
    attachment: {
      model: "hammer",
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  greekBarracks: { url: greekBarracksUrl, grounded: true },
  greekHouseA: { url: greekHouseAUrl, grounded: true },
  greekHouseB: { url: greekHouseBUrl, grounded: true },
  greekHouseC: { url: greekHouseCUrl, grounded: true },
  greekHouseConstructionA: { url: greekHouseConstructionAUrl, grounded: true },
  greekHouseConstructionB: { url: greekHouseConstructionBUrl, grounded: true },
  greekHouseConstructionC: { url: greekHouseConstructionCUrl, grounded: true },
  greekTemple: { url: greekTempleUrl, grounded: true },
  greekTownCenter: { url: greekTownCenterUrl, grounded: true },
  villagerMaleIdle: { url: villagerIdleUrl, grounded: true },
  villagerMaleWalk: { url: villagerWalkUrl, grounded: true },
  villagerMalePrayA: { url: villagerPrayAUrl, grounded: true },
  villagerMalePrayB: { url: villagerPrayBUrl, grounded: true },
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
  villagerFemalePrayA: { url: villagerFemalePrayAUrl, grounded: true },
  villagerFemalePrayB: { url: villagerFemalePrayBUrl, grounded: true },
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
