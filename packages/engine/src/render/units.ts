import type { RenderSnapshot } from "@aom/sim";
import { createModelRenderer } from "./model-renderer";
import { createStaticSpriteRenderer } from "./static-sprite-renderer";
import { createUnitOverlayRenderer } from "./unit-overlay-renderer";
import { UNIT_PRESENTATIONS } from "./unit-presentation";

export interface UnitsRenderer {
  draw(
    pass: GPURenderPassEncoder,
    queue: GPUQueue,
    viewProj: Float32Array,
    cameraViewDir: Float32Array,
    prev: RenderSnapshot,
    curr: RenderSnapshot,
    alpha: number,
    heights: Float32Array,
    ghostType: number,
    ghostX: number,
    ghostZ: number,
    ghostValid: boolean,
  ): number;
}

export async function createUnitsRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
  heights: Float32Array,
): Promise<UnitsRenderer> {
  const [models, sprites] = await Promise.all([
    createModelRenderer(device, format, maxInstances),
    createStaticSpriteRenderer(device, format, maxInstances, heights),
  ]);
  const overlays = createUnitOverlayRenderer(device, format, maxInstances, heights);

  return {
    draw(
      pass,
      queue,
      viewProj,
      _cameraViewDir,
      prev,
      curr,
      alpha,
      terrainHeights,
      ghostType,
      ghostX,
      ghostZ,
      ghostValid,
    ): number {
      models.draw(pass, queue, viewProj, prev, curr, alpha, terrainHeights);
      sprites.draw(
        pass,
        queue,
        viewProj,
        prev,
        curr,
        alpha,
        terrainHeights,
        ghostType,
        ghostX,
        ghostZ,
        ghostValid,
      );
      const visibleInstances = overlays.draw(
        pass,
        queue,
        viewProj,
        prev,
        curr,
        alpha,
        terrainHeights,
      );
      // Keep the existing public metric stable; render statistics ownership is handled separately.
      const ghostInstances = ghostType >= 0 && UNIT_PRESENTATIONS[ghostType] ? 1 : 0;
      return visibleInstances + ghostInstances;
    },
  };
}
