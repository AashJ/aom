import basketUrl from "../assets/models/attachments-a-basket.glb?url";
import militiaIdleUrl from "../assets/models/infantry-g-militia-idle.glb?url";
import militiaWalkUrl from "../assets/models/infantry-g-militia-walk.glb?url";
import pickaxeUrl from "../assets/models/tool-pickaxe-miners.glb?url";
import villagerHarvestUrl from "../assets/models/villager-g-male-harvest.glb?url";
import villagerIdleUrl from "../assets/models/villager-g-male-idle.glb?url";
import villagerMineUrl from "../assets/models/villager-g-male-mine.glb?url";
import villagerWalkUrl from "../assets/models/villager-g-male-walk.glb?url";

export interface ModelAttachmentConfig {
  modelIndex: number;
  targetNode: string;
  hotspotNode: string;
}

export interface ModelConfig {
  url: string;
  grounded: boolean;
  attachment?: ModelAttachmentConfig;
}

export const MODEL_VILLAGER_IDLE = 0;
export const MODEL_VILLAGER_WALK = 1;
export const MODEL_VILLAGER_MINE = 2;
export const MODEL_VILLAGER_HARVEST = 3;
export const MODEL_MILITIA_IDLE = 4;
export const MODEL_MILITIA_WALK = 5;
export const MODEL_PICKAXE = 6;
export const MODEL_BASKET = 7;

export const MODEL_CONFIGS: readonly ModelConfig[] = [
  { url: villagerIdleUrl, grounded: true },
  { url: villagerWalkUrl, grounded: true },
  {
    url: villagerMineUrl,
    grounded: true,
    attachment: {
      modelIndex: MODEL_PICKAXE,
      targetNode: "Dummy_righthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  {
    url: villagerHarvestUrl,
    grounded: true,
    attachment: {
      modelIndex: MODEL_BASKET,
      targetNode: "Dummy_lefthand",
      hotspotNode: "Dummy_hotspot",
    },
  },
  { url: militiaIdleUrl, grounded: true },
  { url: militiaWalkUrl, grounded: true },
  { url: pickaxeUrl, grounded: false },
  { url: basketUrl, grounded: false },
];
