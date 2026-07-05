import barracksSpriteUrl from "../assets/barracks.png";
import berryBushSpriteUrl from "../assets/berry-bush.png";
import houseSpriteUrl from "../assets/house.png";
import militiaSpriteUrl from "../assets/militia-walk.png";
import townCenterSpriteUrl from "../assets/town-center.png";
import treeWoodSpriteUrl from "../assets/tree-wood.png";
import villagerSpriteUrl from "../assets/villager-walk.png";

export interface SpriteConfig {
  url: string;
  columns: number;
  idleFrame: number;
  walkFirstFrame: number;
  walkFrameCount: number;
  worldHeight: number;
  animated: boolean;
}

export const SPRITE_CONFIGS: readonly SpriteConfig[] = [
  {
    url: villagerSpriteUrl,
    columns: 7,
    idleFrame: 0,
    walkFirstFrame: 1,
    walkFrameCount: 6,
    worldHeight: 2.2,
    animated: true,
  },
  {
    url: militiaSpriteUrl,
    columns: 7,
    idleFrame: 0,
    walkFirstFrame: 1,
    walkFrameCount: 6,
    worldHeight: 2.2,
    animated: true,
  },
  {
    url: treeWoodSpriteUrl,
    columns: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 3.8,
    animated: false,
  },
  {
    url: berryBushSpriteUrl,
    columns: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 1.3,
    animated: false,
  },
  // Building rows exist ahead of M6-2's spawns; harmless while no sim unit uses them.
  {
    url: townCenterSpriteUrl,
    columns: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 5.5,
    animated: false,
  },
  {
    url: houseSpriteUrl,
    columns: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 2.6,
    animated: false,
  },
  {
    url: barracksSpriteUrl,
    columns: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 4.2,
    animated: false,
  },
];
