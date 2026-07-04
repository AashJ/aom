import { describe, expect, test } from "bun:test";
import { MAP_TILES, VERTS_PER_ROW } from "../terrain/heightmap";
import { buildMinimapTexels, MINIMAP_TEX_SIZE } from "./minimap";

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

test("builds a 256x256 rgba texture with opaque alpha", () => {
        const texels = buildMinimapTexels(flatHeights(0));
        expect(texels).toBeInstanceOf(Uint8Array);
        expect(texels.length).toBe(MINIMAP_TEX_SIZE * MINIMAP_TEX_SIZE * 4);

        for (let offset = 3; offset < texels.length; offset += 4) {
                expect(texels[offset]).toBe(255);
        }
});
