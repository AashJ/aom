import { createCamera, smoothCamera, updateMatrices } from "./camera/camera";
import { DEPTH_FORMAT, initGPU } from "./gpu/device";
import { observeCanvasSize } from "./gpu/surface";
import { applyInput } from "./input/apply";
import { attachInput } from "./input/input";
import { createTerrainRenderer } from "./render/terrain";
import { createFrameLoop } from "./render/loop";
import { createStatsCollector, type StatsCallback } from "./render/stats";
import { generateHeightmap } from "./terrain/heightmap";

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
  // CPU terrain data survives device loss; only GPU buffers/pipelines are recreated.
  const heights = generateHeightmap(1337);
  let terrain = createTerrainRenderer(gpu.device, gpu.format, heights);
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

  function tick(): void {}

  function render(alpha: number, dtMs: number): void {
    void alpha;

    applyInput(input.state, camera, dtMs / 1000, canvas);
    smoothCamera(camera, dtMs);
    updateMatrices(camera, gpu.canvas.width / gpu.canvas.height);
    colorAttachment.view = gpu.context.getCurrentTexture().createView();

    const encoder = gpu.device.createCommandEncoder();
    const pass = encoder.beginRenderPass(passDescriptor);
    const visibleChunks = terrain.draw(pass, gpu.device.queue, camera.viewProj, camera.frustum);
    statsCollector.frameGauges.chunksVisible = visibleChunks;
    statsCollector.frameGauges.chunksTotal = terrain.chunkBounds.length;
    pass.end();
    gpu.device.queue.submit([encoder.finish()]);
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
