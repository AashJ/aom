import {
  createSnapshot,
  createWorld,
  MAX_UNITS,
  spawnUnits,
  tickWorld,
  writeSnapshot,
} from "@aom/sim";
import { createCamera, smoothCamera, updateMatrices } from "./camera/camera";
import { DEPTH_FORMAT, initGPU } from "./gpu/device";
import { observeCanvasSize } from "./gpu/surface";
import { applyInput } from "./input/apply";
import { attachInput } from "./input/input";
import { consumeCommandInput, consumeSelectionInput } from "./picking/pick";
import { createGpuTimer } from "./render/gpu-timer";
import { createMinimapRenderer } from "./render/minimap";
import { createTerrainRenderer } from "./render/terrain";
import { createUnitsRenderer } from "./render/units";
import { createFrameLoop } from "./render/loop";
import { createStatsCollector, type StatsCallback } from "./render/stats";

export interface GameHandle {
  start(): void;
  stop(): void;
  dispose(): void;
  onStats(cb: StatsCallback): () => void;
}

export async function createGame(canvas: HTMLCanvasElement): Promise<GameHandle> {
  let disposed = false;
  let running = false;
  let loop: ReturnType<typeof createFrameLoop>;

  function handleDeviceLost(): void {
    const wasRunning = running;
    loop.stop();
    running = false;

    void initGPU(canvas, handleDeviceLost)
      .then((nextGpu) => {
        if (disposed) {
          nextGpu.device.destroy();
          return;
        }

        gpu = nextGpu;
        // GPU resources die with their device, so recreate renderer-owned state.
        terrain = createTerrainRenderer(nextGpu.device, nextGpu.format, heights);
        units = createUnitsRenderer(nextGpu.device, nextGpu.format, MAX_UNITS, heights);
        minimap = createMinimapRenderer(nextGpu.device, nextGpu.format, heights);
        gpuTimer = createGpuTimer(nextGpu.device);
        passDescriptor.timestampWrites = gpuTimer.passTimestampWrites;
        recreateDepthTexture();

        if (wasRunning) {
          running = true;
          loop.start();
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to reinitialize WebGPU device.", error);
      });
  }

  let gpu = await initGPU(canvas, handleDeviceLost);
  const camera = createCamera();
  const world = createWorld(1337);
  // Init handoff: createWorld(1337) derives the same terrain seed the engine used before,
  // so rendering receives identical heights without a per-tick channel.
  const heights = world.heights;
  spawnUnits(world, 1_000);
  let prevSnap = createSnapshot(MAX_UNITS);
  let currSnap = createSnapshot(MAX_UNITS);
  writeSnapshot(world, prevSnap);
  writeSnapshot(world, currSnap);
  let terrain = createTerrainRenderer(gpu.device, gpu.format, heights);
  let units = createUnitsRenderer(gpu.device, gpu.format, MAX_UNITS, heights);
  let minimap = createMinimapRenderer(gpu.device, gpu.format, heights);
  let gpuTimer = createGpuTimer(gpu.device);
  let depthTexture: GPUTexture | null = null;

  const colorAttachment: GPURenderPassColorAttachment = {
    clearValue: { r: 0.05, g: 0.07, b: 0.1, a: 1 },
    loadOp: "clear",
    storeOp: "store",
    view: undefined as unknown as GPUTextureView,
  };
  const depthAttachment: GPURenderPassDepthStencilAttachment = {
    // Nothing reads depth after the pass, so discard avoids paying to write it back to memory,
    // especially on tile GPUs.
    depthClearValue: 1,
    depthLoadOp: "clear",
    depthStoreOp: "discard",
    view: undefined as unknown as GPUTextureView,
  };
  const passDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [colorAttachment],
    depthStencilAttachment: depthAttachment,
    timestampWrites: gpuTimer.passTimestampWrites,
  };

  function recreateDepthTexture(): void {
    depthTexture?.destroy();
    // Unlike the canvas swapchain texture, the depth texture does not resize itself; this is
    // the lifecycle owned by the resize hook foreshadowed in surface.ts.
    depthTexture = gpu.device.createTexture({
      size: [gpu.canvas.width, gpu.canvas.height],
      format: DEPTH_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    depthAttachment.view = depthTexture.createView();
  }

  const unobserveResize = observeCanvasSize(canvas, gpu.device, recreateDepthTexture);
  recreateDepthTexture();
  const input = attachInput(canvas);

  function tick(): void {
    tickWorld(world);

    // Prev/curr double-buffer swap: render interpolates between the last two completed ticks,
    // so display runs one tick behind real time by design.
    const tmp = prevSnap;
    prevSnap = currSnap;
    currSnap = tmp;
    writeSnapshot(world, currSnap);
  }

  function onGpuSample(gpuMs: number): void {
    statsCollector.frameGauges.gpuMs = gpuMs;
  }

  function render(alpha: number, dtMs: number): void {
    applyInput(input.state, camera, dtMs / 1000, canvas);
    smoothCamera(camera, dtMs);
    updateMatrices(camera, gpu.canvas.width / gpu.canvas.height);
    consumeSelectionInput(input.state, world, camera, prevSnap, currSnap, alpha, heights, canvas);
    consumeCommandInput(input.state, world, camera, heights, canvas);
    colorAttachment.view = gpu.context.getCurrentTexture().createView();

    const encoder = gpu.device.createCommandEncoder();
    const pass = encoder.beginRenderPass(passDescriptor);
    const visibleChunks = terrain.draw(pass, gpu.device.queue, camera.viewProj, camera.frustum);
    const instances = units.draw(
      pass,
      gpu.device.queue,
      camera.viewProj,
      prevSnap,
      currSnap,
      alpha,
      heights,
    );
    minimap.draw(
      pass,
      gpu.device.queue,
      gpu.canvas.width,
      gpu.canvas.height,
      camera,
      prevSnap,
      currSnap,
      alpha,
    );
    // +4 = units + minimap base + minimap footprint + minimap dots.
    statsCollector.frameGauges.drawCalls = visibleChunks + 4;
    statsCollector.frameGauges.instances = instances;
    statsCollector.frameGauges.chunksVisible = visibleChunks;
    statsCollector.frameGauges.chunksTotal = terrain.chunkBounds.length;
    pass.end();
    gpuTimer.afterPass(encoder);
    gpu.device.queue.submit([encoder.finish()]);
    gpuTimer.afterSubmit(onGpuSample);
  }

  const statsCollector = createStatsCollector();
  loop = createFrameLoop({ render, sample: statsCollector.sample, tick });

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    running = false;
    loop.stop();
    unobserveResize();
    input.detach();
    depthTexture?.destroy();
    gpu.device.destroy();
  }

  return {
    dispose,
    onStats: statsCollector.subscribe,
    start(): void {
      if (disposed) {
        return;
      }

      running = true;
      loop.start();
    },
    stop(): void {
      running = false;
      loop.stop();
    },
  };
}
