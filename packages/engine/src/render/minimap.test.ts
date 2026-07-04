import { describe, expect, test } from "bun:test";
import { MAP_TILES, VERTS_PER_ROW, generateHeightmap } from "@aom/sim";
import { MINIMAP_TEX_SIZE, buildMinimapTexels, worldToMinimapUnit } from "./minimap";

function flatHeights(height: number): Float32Array {
  const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);
  heights.fill(height);
  return heights;
}

function offsetOf(x: number, z: number): number {
  return (z * MINIMAP_TEX_SIZE + x) * 4;
}

function brightness(texels: Uint8Array, x: number, z: number): number {
  const offset = offsetOf(x, z);
  return texels[offset]! + texels[offset + 1]! + texels[offset + 2]!;
}

// Heights that depend on z only: 0 below the step row, `high` at and above it.
function stepHeights(stepZ: number, high: number): Float32Array {
  const heights = new Float32Array(VERTS_PER_ROW * VERTS_PER_ROW);

  for (let z = stepZ; z < VERTS_PER_ROW; z += 1) {
    for (let x = 0; x < VERTS_PER_ROW; x += 1) {
      heights[z * VERTS_PER_ROW + x] = high;
    }
  }

  return heights;
}

describe("buildMinimapTexels", () => {
  test("builds a 256x256 rgba texture with opaque alpha", () => {
    const texels = buildMinimapTexels(flatHeights(0));
    expect(texels).toBeInstanceOf(Uint8Array);
    expect(texels.length).toBe(MINIMAP_TEX_SIZE * MINIMAP_TEX_SIZE * 4);

    for (let offset = 3; offset < texels.length; offset += 4) {
      expect(texels[offset]).toBe(255);
    }
  });

  test("is deterministic for the same input", () => {
    const heights = flatHeights(4);
    heights[10 * VERTS_PER_ROW + 20] = 9;
    heights[30 * VERTS_PER_ROW + 40] = 2;

    const a = buildMinimapTexels(heights);
    const b = buildMinimapTexels(heights);

    expect(a).toEqual(b);
  });

  test("addresses texels as row = z, column = x", () => {
    // Heights vary only along z, so two texels on the same row must match and
    // two texels on the same column must differ. A transposed implementation
    // flips that pattern.
    const texels = buildMinimapTexels(stepHeights(128, 12));

    expect(brightness(texels, 10, 50)).toBe(brightness(texels, 200, 50));
    expect(brightness(texels, 10, 200)).toBe(brightness(texels, 200, 200));
    expect(brightness(texels, 10, 50)).not.toBe(brightness(texels, 10, 200));
  });

  test("flat terrain gets brighter as height climbs the color ramp", () => {
    // Flat maps isolate the height ramp: normals are all straight up, so the
    // slope blend and lighting are identical and only the ramp stop changes.
    const low = brightness(buildMinimapTexels(flatHeights(0)), 128, 128);
    const mid = brightness(buildMinimapTexels(flatHeights(6)), 128, 128);
    const high = brightness(buildMinimapTexels(flatHeights(12)), 128, 128);

    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  test("steep slopes read darker than flat ground at the same height", () => {
    const texels = buildMinimapTexels(stepHeights(128, 12));

    // (64, 200) sits deep in the flat high plateau; (64, 128) sits on the cliff
    // face, where the tilted normal loses most of its sun term.
    expect(brightness(texels, 64, 128)).toBeLessThan(brightness(texels, 64, 200));
  });

  test("never renders pitch black even on back-facing slopes", () => {
    const texels = buildMinimapTexels(stepHeights(128, 12));

    // The 0.45 ambient floor keeps the cliff face visible.
    expect(brightness(texels, 64, 128)).toBeGreaterThan(0);
  });

  test("smoke: real generated terrain produces a varied opaque image", () => {
    const texels = buildMinimapTexels(generateHeightmap(1337));

    expect(texels.length).toBe(MINIMAP_TEX_SIZE * MINIMAP_TEX_SIZE * 4);
    expect(texels[3]).toBe(255);
    expect(brightness(texels, 20, 20)).not.toBe(brightness(texels, 200, 130));
  });
});

describe("worldToMinimapUnit", () => {
  function unitAt(x: number, z: number): [number, number] {
    const out = new Float32Array(2);
    worldToMinimapUnit(x, z, out, 0);
    return [out[0]!, out[1]!];
  }

  test("maps the four world corners onto the diamond corners", () => {
    // These pin the WGSL corner table; a sign flip mirrors the whole minimap.
    expect(unitAt(0, 0)).toEqual([0.5, 0]);
    expect(unitAt(MAP_TILES, MAP_TILES)).toEqual([0.5, 1]);
    expect(unitAt(0, MAP_TILES)).toEqual([1, 0.5]);
    expect(unitAt(MAP_TILES, 0)).toEqual([0, 0.5]);
  });

  test("maps the map center to the diamond center", () => {
    expect(unitAt(128, 128)).toEqual([0.5, 0.5]);
  });

  test("writes exactly two floats at the requested offset", () => {
    // Callers pack footprint points and dot instances into shared staging
    // arrays, so touching neighbors would corrupt adjacent points.
    const out = new Float32Array(6).fill(7);
    worldToMinimapUnit(0, 0, out, 2);

    expect(out[0]).toBe(7);
    expect(out[1]).toBe(7);
    expect(out[2]).toBe(0.5);
    expect(out[3]).toBe(0);
    expect(out[4]).toBe(7);
    expect(out[5]).toBe(7);
  });

  test("is affine along the main diagonal", () => {
    // 25% of the way from world (0,0) to (256,256) is 25% up the diamond.
    expect(unitAt(64, 64)).toEqual([0.5, 0.25]);
  });

  test("camera-forward (+x+z) is minimap-up", () => {
    const [nearX, nearY] = unitAt(100, 100);
    const [farX, farY] = unitAt(140, 140);

    expect(farY).toBeGreaterThan(nearY);
    expect(farX).toBe(nearX);
  });

  test("screen-right (+z-x) is minimap-right", () => {
    // Equal x+z keeps the height on the diamond fixed; only z-x moves it right.
    const [leftX, leftY] = unitAt(120, 120);
    const [rightX, rightY] = unitAt(100, 140);

    expect(rightX).toBeGreaterThan(leftX);
    expect(rightY).toBe(leftY);
  });
});
