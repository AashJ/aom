import barracksSpriteUrl from "../assets/barracks.png";
import berryBushSpriteUrl from "../assets/berry-bush.png";
import goldMineSpriteUrl from "../assets/gold-mine.png";
import houseSpriteUrl from "../assets/house.png";
import militiaSpriteUrl from "../assets/militia-walk.png";
import townCenterSpriteUrl from "../assets/town-center.png";
import treeWoodSpriteUrl from "../assets/tree-wood.png";
import villagerHarvestSpriteUrl from "../assets/villager-harvest.png";
import villagerMineSpriteUrl from "../assets/villager-mine.png";
import villagerSpriteUrl from "../assets/villager-walk.png";

export interface SpriteConfig {
  url: string;
  columns: number;
  directions: number;
  idleFrame: number;
  walkFirstFrame: number;
  walkFrameCount: number;
  worldHeight: number;
  // World-space height of transparent texture padding below the visible art.
  bottomPadding: number;
  animated: boolean;
  staticFrames?: "variation" | "depletion";
}

export const SPRITE_CONFIGS: readonly SpriteConfig[] = [
  {
    url: villagerSpriteUrl,
    columns: 7,
    directions: 8,
    idleFrame: 0,
    walkFirstFrame: 1,
    walkFrameCount: 6,
    worldHeight: 2.2,
    bottomPadding: 0,
    animated: true,
  },
  {
    url: militiaSpriteUrl,
    columns: 7,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 1,
    walkFrameCount: 6,
    worldHeight: 2.2,
    bottomPadding: 0,
    animated: true,
  },
  {
    url: treeWoodSpriteUrl,
    columns: 3,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 3.8,
    bottomPadding: 0,
    animated: false,
    staticFrames: "variation",
  },
  {
    url: berryBushSpriteUrl,
    columns: 1,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 1.3,
    bottomPadding: 0,
    animated: false,
  },
  // Building rows exist ahead of M6-2's spawns; harmless while no sim unit uses them.
  {
    url: townCenterSpriteUrl,
    columns: 1,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 5.5,
    // The source has 189 transparent pixels below the visible base (189 / 1254 * 5.5).
    bottomPadding: 0.83,
    animated: false,
  },
  {
    url: houseSpriteUrl,
    columns: 1,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 2.6,
    bottomPadding: 0,
    animated: false,
  },
  {
    url: barracksSpriteUrl,
    columns: 1,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 4.2,
    bottomPadding: 0,
    animated: false,
  },
  {
    url: goldMineSpriteUrl,
    columns: 4,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 2.8,
    bottomPadding: 0,
    animated: false,
    staticFrames: "depletion",
  },
];

const VILLAGER_MINE_SPRITE_CONFIG: SpriteConfig = {
  url: villagerMineSpriteUrl,
  columns: 6,
  directions: 8,
  idleFrame: 0,
  walkFirstFrame: 0,
  walkFrameCount: 6,
  worldHeight: 2.2,
  bottomPadding: 0,
  animated: true,
};

const VILLAGER_HARVEST_SPRITE_CONFIG: SpriteConfig = {
  url: villagerHarvestSpriteUrl,
  columns: 6,
  directions: 8,
  idleFrame: 0,
  walkFirstFrame: 0,
  walkFrameCount: 6,
  worldHeight: 2.2,
  bottomPadding: 0,
  animated: true,
};

export const VILLAGER_MINE_SPRITE_INDEX = SPRITE_CONFIGS.length;
export const VILLAGER_HARVEST_SPRITE_INDEX = SPRITE_CONFIGS.length + 1;

// Action sheets are render-only variants of the villager type. They stay out of
// SPRITE_CONFIGS so sim unit-type indices continue to map directly to base art.
export const RENDER_SPRITE_CONFIGS: readonly SpriteConfig[] = [
  ...SPRITE_CONFIGS,
  VILLAGER_MINE_SPRITE_CONFIG,
  VILLAGER_HARVEST_SPRITE_CONFIG,
];
