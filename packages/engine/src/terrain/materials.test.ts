import { describe, expect, test } from "bun:test";
import { VERTS_PER_ROW } from "@aom/sim";
import { buildTerrainBlendDescriptors } from "./materials";

const DESCRIPTOR_LAYER_BYTES = (VERTS_PER_ROW - 1) * (VERTS_PER_ROW - 1) * 4;

function descriptorForPass(descriptors: Uint8Array, pass: number): number[] {
  const offset = pass * DESCRIPTOR_LAYER_BYTES;
  return Array.from(descriptors.subarray(offset, offset + 4));
}

function descriptorForCase(blendCase: number): number[] {
  const materials = new Uint8Array(VERTS_PER_ROW * VERTS_PER_ROW);

  if ((blendCase & 1) !== 0) materials[0] = 7;
  if ((blendCase & 2) !== 0) materials[1] = 7;
  if ((blendCase & 4) !== 0) materials[VERTS_PER_ROW + 1] = 7;
  if ((blendCase & 8) !== 0) materials[VERTS_PER_ROW] = 7;

  return descriptorForPass(buildTerrainBlendDescriptors(materials), 0);
}

describe("buildTerrainBlendDescriptors", () => {
  test("keeps a uniform tile on one material", () => {
    const materials = new Uint8Array(VERTS_PER_ROW * VERTS_PER_ROW).fill(6);

    expect(descriptorForPass(buildTerrainBlendDescriptors(materials), 0)).toEqual([6, 255, 0, 0]);
  });

  test.each([
    [1, 3],
    [2, 2],
    [4, 1],
    [8, 0],
  ])("orients a one-corner mask for case %i", (blendCase, rotation) => {
    expect(descriptorForCase(blendCase)).toEqual([0, 7, 0, rotation]);
  });

  test.each([
    [3, 3],
    [6, 2],
    [9, 0],
    [12, 1],
  ])("orients an edge mask for case %i", (blendCase, rotation) => {
    expect(descriptorForCase(blendCase)).toEqual([0, 7, 2, rotation]);
  });

  test.each([
    [5, 1],
    [10, 0],
  ])("orients an opposite-corners mask for case %i", (blendCase, rotation) => {
    expect(descriptorForCase(blendCase)).toEqual([0, 7, 7, rotation]);
  });

  test.each([
    [7, 2],
    [11, 3],
    [13, 0],
    [14, 1],
  ])("orients a three-corners mask for case %i", (blendCase, rotation) => {
    expect(descriptorForCase(blendCase)).toEqual([0, 7, 8, rotation]);
  });

  test("preserves three materials as ordered paint passes", () => {
    const materials = new Uint8Array(VERTS_PER_ROW * VERTS_PER_ROW);

    materials[1] = 2;
    materials[VERTS_PER_ROW + 1] = 5;
    const descriptors = buildTerrainBlendDescriptors(materials);

    expect(descriptorForPass(descriptors, 0)).toEqual([0, 2, 2, 2]);
    expect(descriptorForPass(descriptors, 1)).toEqual([0, 5, 0, 1]);
    expect(descriptorForPass(descriptors, 2)).toEqual([0, 255, 0, 0]);
  });

  test("preserves all four corner materials", () => {
    const materials = new Uint8Array(VERTS_PER_ROW * VERTS_PER_ROW);

    materials[1] = 2;
    materials[VERTS_PER_ROW + 1] = 5;
    materials[VERTS_PER_ROW] = 7;
    const descriptors = buildTerrainBlendDescriptors(materials);

    expect(descriptorForPass(descriptors, 0)).toEqual([0, 2, 8, 1]);
    expect(descriptorForPass(descriptors, 1)).toEqual([0, 5, 2, 1]);
    expect(descriptorForPass(descriptors, 2)).toEqual([0, 7, 0, 0]);
  });

  test("rejects a material field with the wrong dimensions", () => {
    expect(() => buildTerrainBlendDescriptors(new Uint8Array(4))).toThrow(RangeError);
  });

  test("rejects material ids outside the texture catalog", () => {
    const materials = new Uint8Array(VERTS_PER_ROW * VERTS_PER_ROW);

    materials[0] = 8;
    expect(() => buildTerrainBlendDescriptors(materials)).toThrow(RangeError);
  });
});
