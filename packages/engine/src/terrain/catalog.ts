import {
  TERRAIN_CLIFF_GREEK_A,
  TERRAIN_CLIFF_GREEK_B,
  TERRAIN_DIRT_A,
  TERRAIN_GRASS_A,
  TERRAIN_GRASS_B,
  TERRAIN_GRASS_DIRT_25,
  TERRAIN_GRASS_DIRT_50,
  TERRAIN_GRASS_DIRT_75,
  TERRAIN_MATERIAL_IDS,
  type TerrainMaterialId,
} from "@aom/sim";
import blendCornerAUrl from "../assets/terrain/blend-corner-a.png";
import blendCornerBUrl from "../assets/terrain/blend-corner-b.png";
import blendEdgeAUrl from "../assets/terrain/blend-edge-a.png";
import blendEdgeBUrl from "../assets/terrain/blend-edge-b.png";
import blendEdgeCUrl from "../assets/terrain/blend-edge-c.png";
import blendEdgeDUrl from "../assets/terrain/blend-edge-d.png";
import blendEdgeEUrl from "../assets/terrain/blend-edge-e.png";
import blendOppositeCornersUrl from "../assets/terrain/blend-opposite-corners.png";
import blendThreeCornersUrl from "../assets/terrain/blend-three-corners.png";
import cliffGreekAUrl from "../assets/terrain/cliff-greek-a.png";
import cliffGreekBUrl from "../assets/terrain/cliff-greek-b.png";
import dirtAUrl from "../assets/terrain/dirt-a.png";
import grassAUrl from "../assets/terrain/grass-a.png";
import grassBUrl from "../assets/terrain/grass-b.png";
import grassDirt25Url from "../assets/terrain/grass-dirt-25.png";
import grassDirt50Url from "../assets/terrain/grass-dirt-50.png";
import grassDirt75Url from "../assets/terrain/grass-dirt-75.png";

const TERRAIN_TEXTURE_URL_BY_ID: Record<TerrainMaterialId, string> = {
  [TERRAIN_DIRT_A]: dirtAUrl,
  [TERRAIN_CLIFF_GREEK_B]: cliffGreekBUrl,
  [TERRAIN_GRASS_DIRT_75]: grassDirt75Url,
  [TERRAIN_GRASS_DIRT_50]: grassDirt50Url,
  [TERRAIN_GRASS_DIRT_25]: grassDirt25Url,
  [TERRAIN_GRASS_B]: grassBUrl,
  [TERRAIN_GRASS_A]: grassAUrl,
  [TERRAIN_CLIFF_GREEK_A]: cliffGreekAUrl,
};

export const TERRAIN_TEXTURE_URLS = TERRAIN_MATERIAL_IDS.map(
  (materialId) => TERRAIN_TEXTURE_URL_BY_ID[materialId],
);

export const TERRAIN_BLEND_MASK_CATALOG = [
  { id: 0, kind: "corner", url: blendCornerAUrl },
  { id: 1, kind: "corner", url: blendCornerBUrl },
  { id: 2, kind: "edge", url: blendEdgeAUrl },
  { id: 3, kind: "edge", url: blendEdgeBUrl },
  { id: 4, kind: "edge", url: blendEdgeCUrl },
  { id: 5, kind: "edge", url: blendEdgeDUrl },
  { id: 6, kind: "edge", url: blendEdgeEUrl },
  { id: 7, kind: "opposite-corners", url: blendOppositeCornersUrl },
  { id: 8, kind: "three-corners", url: blendThreeCornersUrl },
] as const;

export type TerrainBlendMaskId = (typeof TERRAIN_BLEND_MASK_CATALOG)[number]["id"];

export const CORNER_BLEND_MASK_IDS = [0, 1] as const satisfies readonly TerrainBlendMaskId[];
export const EDGE_BLEND_MASK_IDS = [2, 3, 4, 5, 6] as const satisfies readonly TerrainBlendMaskId[];
export const OPPOSITE_CORNERS_BLEND_MASK_ID = 7 satisfies TerrainBlendMaskId;
export const THREE_CORNERS_BLEND_MASK_ID = 8 satisfies TerrainBlendMaskId;
export const TERRAIN_BLEND_MASK_COUNT = TERRAIN_BLEND_MASK_CATALOG.length;
