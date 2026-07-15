import { MAP_TILES, TERRAIN_MATERIAL_COUNT, VERTS_PER_ROW } from "@aom/sim";
import {
  CORNER_BLEND_MASK_IDS,
  EDGE_BLEND_MASK_IDS,
  OPPOSITE_CORNERS_BLEND_MASK_ID,
  THREE_CORNERS_BLEND_MASK_ID,
  type TerrainBlendMaskId,
} from "./catalog";

const DESCRIPTOR_COMPONENTS = 4;
const NO_OVERLAY_MATERIAL = 255;
export const TERRAIN_BLEND_PASS_COUNT = 3;
const DESCRIPTOR_LAYER_BYTES = MAP_TILES * MAP_TILES * DESCRIPTOR_COMPONENTS;

// Mask source orientations in Classic AoM's blend set:
// corner = bottom-left, edge = left, opposite = bottom-left/top-right,
// three = every corner except top-right.
const ROTATION_BY_CASE = new Uint8Array([
  0, // 0000
  3, // 0001 top-left
  2, // 0010 top-right
  3, // 0011 top edge
  1, // 0100 bottom-right
  1, // 0101 opposite
  2, // 0110 right edge
  2, // 0111 except bottom-left
  0, // 1000 bottom-left
  0, // 1001 left edge
  0, // 1010 opposite
  3, // 1011 except bottom-right
  1, // 1100 bottom edge
  0, // 1101 except top-right
  1, // 1110 except top-left
  0, // 1111
]);

function maskLayer(blendCase: number, variant: number): TerrainBlendMaskId {
  switch (blendCase) {
    case 1:
    case 2:
    case 4:
    case 8:
      return CORNER_BLEND_MASK_IDS[variant % CORNER_BLEND_MASK_IDS.length]!;
    case 3:
    case 6:
    case 9:
    case 12:
      return EDGE_BLEND_MASK_IDS[variant % EDGE_BLEND_MASK_IDS.length]!;
    case 5:
    case 10:
      return OPPOSITE_CORNERS_BLEND_MASK_ID;
    case 7:
    case 11:
    case 13:
    case 14:
      return THREE_CORNERS_BLEND_MASK_ID;
    default:
      throw new RangeError(`Unsupported terrain blend case ${blendCase}.`);
  }
}

export function buildTerrainBlendDescriptors(materials: Uint8Array): Uint8Array {
  if (materials.length !== VERTS_PER_ROW * VERTS_PER_ROW) {
    throw new RangeError("Terrain materials must contain one id per terrain vertex.");
  }

  for (let index = 0; index < materials.length; index += 1) {
    if (materials[index]! >= TERRAIN_MATERIAL_COUNT) {
      throw new RangeError(`Terrain material id ${materials[index]} is outside the catalog.`);
    }
  }

  const descriptors = new Uint8Array(DESCRIPTOR_LAYER_BYTES * TERRAIN_BLEND_PASS_COUNT);

  for (let z = 0; z < MAP_TILES; z += 1) {
    for (let x = 0; x < MAP_TILES; x += 1) {
      const topLeft = materials[z * VERTS_PER_ROW + x]!;
      const topRight = materials[z * VERTS_PER_ROW + x + 1]!;
      const bottomRight = materials[(z + 1) * VERTS_PER_ROW + x + 1]!;
      const bottomLeft = materials[(z + 1) * VERTS_PER_ROW + x]!;
      const base = Math.min(topLeft, topRight, bottomRight, bottomLeft);
      const tileOffset = (z * MAP_TILES + x) * DESCRIPTOR_COMPONENTS;

      const variant =
        (Math.imul(x, 73_856_093) ^ Math.imul(z, 19_349_663) ^ Math.imul(x + z, 83_492_791)) >>> 0;
      let previousMaterial = base;

      for (let pass = 0; pass < TERRAIN_BLEND_PASS_COUNT; pass += 1) {
        const output = pass * DESCRIPTOR_LAYER_BYTES + tileOffset;
        let overlayMaterial = NO_OVERLAY_MATERIAL;

        descriptors[output] = base;
        descriptors[output + 1] = NO_OVERLAY_MATERIAL;

        if (topLeft > previousMaterial && topLeft < overlayMaterial) overlayMaterial = topLeft;
        if (topRight > previousMaterial && topRight < overlayMaterial) overlayMaterial = topRight;
        if (bottomRight > previousMaterial && bottomRight < overlayMaterial) {
          overlayMaterial = bottomRight;
        }
        if (bottomLeft > previousMaterial && bottomLeft < overlayMaterial) {
          overlayMaterial = bottomLeft;
        }

        if (overlayMaterial === NO_OVERLAY_MATERIAL) {
          continue;
        }

        // Classic terrain is painted in blend order. Every pass covers corners
        // whose final material is this layer or any later layer; later passes then
        // paint their own mask over it. This preserves all 2-4 materials in a quad.
        const blendCase =
          (topLeft >= overlayMaterial ? 1 : 0) |
          (topRight >= overlayMaterial ? 2 : 0) |
          (bottomRight >= overlayMaterial ? 4 : 0) |
          (bottomLeft >= overlayMaterial ? 8 : 0);

        descriptors[output + 1] = overlayMaterial;
        descriptors[output + 2] = maskLayer(blendCase, variant);
        descriptors[output + 3] = ROTATION_BY_CASE[blendCase]!;
        previousMaterial = overlayMaterial;
      }
    }
  }

  return descriptors;
}
