import type { RenderSnapshot } from "@aom/sim";
import { createModelRenderer } from "./model-renderer";
import { createParticleRenderer } from "./particle-renderer";
import {
  addRendererStatistics,
  resetRendererStatistics,
  type RendererStatistics,
} from "./render-statistics";
import { createStaticSpriteRenderer } from "./static-sprite-renderer";
import { createUnitOverlayRenderer } from "./unit-overlay-renderer";

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
  ): RendererStatistics;
}

export async function createUnitsRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  maxInstances: number,
  maxProjectiles: number,
  heights: Float32Array,
): Promise<UnitsRenderer> {
  const [models, sprites, particles] = await Promise.all([
    createModelRenderer(device, format, maxInstances, maxProjectiles),
    createStaticSpriteRenderer(device, format, maxInstances, heights),
    createParticleRenderer(device, format, maxInstances),
  ]);
  const overlays = createUnitOverlayRenderer(device, format, maxInstances, heights);
  const statistics: RendererStatistics = { drawCalls: 0, instances: 0 };

  return {
    draw(
      pass,
      queue,
      viewProj,
      cameraViewDir,
      prev,
      curr,
      alpha,
      terrainHeights,
      ghostType,
      ghostX,
      ghostZ,
      ghostValid,
    ): RendererStatistics {
      resetRendererStatistics(statistics);
      addRendererStatistics(
        statistics,
        models.draw(
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
        ),
      );
      addRendererStatistics(
        statistics,
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
        ),
      );
      addRendererStatistics(
        statistics,
        particles.draw(pass, queue, viewProj, cameraViewDir, prev, curr, alpha, terrainHeights),
      );
      addRendererStatistics(
        statistics,
        overlays.draw(pass, queue, viewProj, prev, curr, alpha, terrainHeights),
      );
      return statistics;
    },
  };
}
