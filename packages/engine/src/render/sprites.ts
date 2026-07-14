import barracksSpriteUrl from "../assets/barracks.png";
import berryBushSpriteUrl from "../assets/berry-bush.png";
import goldMineSpriteUrl from "../assets/gold-mine.png";
import houseSpriteUrl from "../assets/house.png";
import townCenterSpriteUrl from "../assets/town-center.png";
import treeWoodSpriteUrl from "../assets/tree-wood.png";

export interface SpriteConfig {
  // Null reserves a transparent overlay-only bucket for a 3D model type.
  url: string | null;
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
    url: null,
    columns: 1,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 2.2,
    bottomPadding: 0,
    animated: false,
  },
  {
    url: null,
    columns: 1,
    directions: 1,
    idleFrame: 0,
    walkFirstFrame: 0,
    walkFrameCount: 0,
    worldHeight: 2.2,
    bottomPadding: 0,
    animated: false,
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
