import { describe, expect, test } from "bun:test";
import { MAP_TILES } from "@aom/sim";
import { buildWaterVertices } from "./water";

describe("water mesh", () => {
  test("emits two consistently wound triangles for every navigable tile", () => {
    const mask = new Uint8Array(MAP_TILES * MAP_TILES);
    mask[2 * MAP_TILES + 3] = 1;
    const vertices = buildWaterVertices(mask);

    expect(Array.from(vertices)).toEqual([3, 2, 3, 3, 4, 2, 4, 2, 3, 3, 4, 3]);
  });

  test("rejects masks that do not match the authoritative map grid", () => {
    expect(() => buildWaterVertices(new Uint8Array(1))).toThrow(RangeError);
  });
});
