import { describe, expect, test } from "bun:test";
import { createCamera, MIN_DISTANCE, updateMatrices } from "../camera/camera";
import { aabbIntersectsFrustum } from "./frustum";

describe("frustum", () => {
  test("culls terrain-like chunk bounds", () => {
    const cam = createCamera();
    const bounds: {
      minX: number;
      minY: number;
      minZ: number;
      maxX: number;
      maxY: number;
      maxZ: number;
    }[] = [];

    for (let z = 0; z < 8; z += 1) {
      for (let x = 0; x < 8; x += 1) {
        bounds.push({
          minX: x * 32,
          minY: 0,
          minZ: z * 32,
          maxX: x * 32 + 32,
          maxY: 13,
          maxZ: z * 32 + 32,
        });
      }
    }

    updateMatrices(cam, 16 / 9);

    const targetChunkX = Math.floor(cam.target[0]! / 32);
    const targetChunkZ = Math.floor(cam.target[2]! / 32);
    const targetBounds = bounds[targetChunkZ * 8 + targetChunkX]!;

    expect(
      aabbIntersectsFrustum(
        cam.frustum,
        targetBounds.minX,
        targetBounds.minY,
        targetBounds.minZ,
        targetBounds.maxX,
        targetBounds.maxY,
        targetBounds.maxZ,
      ),
    ).toBe(true);

    cam.distance = MIN_DISTANCE;
    updateMatrices(cam, 16 / 9);
    let nearCount = 0;

    for (const b of bounds) {
      if (aabbIntersectsFrustum(cam.frustum, b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ)) {
        nearCount += 1;
      }
    }

    cam.distance = 80;
    updateMatrices(cam, 16 / 9);
    let farCount = 0;

    for (const b of bounds) {
      if (aabbIntersectsFrustum(cam.frustum, b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ)) {
        farCount += 1;
      }
    }

    expect(nearCount).toBeLessThan(farCount);

    const behindX = cam.eye[0]! + cam.viewDir[0]! * -50;
    const behindY = cam.eye[1]! + cam.viewDir[1]! * -50;
    const behindZ = cam.eye[2]! + cam.viewDir[2]! * -50;

    expect(
      aabbIntersectsFrustum(
        cam.frustum,
        behindX - 1,
        behindY - 1,
        behindZ - 1,
        behindX + 1,
        behindY + 1,
        behindZ + 1,
      ),
    ).toBe(false);
    expect(aabbIntersectsFrustum(cam.frustum, -1000, -1000, -1000, 1000, 1000, 1000)).toBe(true);
  });
});
