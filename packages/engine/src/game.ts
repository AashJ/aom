import { createCamera, smoothCamera, updateMatrices } from "./camera/camera";
import { initGPU } from "./gpu/device";
import { observeCanvasSize } from "./gpu/surface";
import { applyInput } from "./input/apply";
import { attachInput } from "./input/input";
import { createGroundRenderer } from "./render/ground";
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
        ground = createGroundRenderer(nextGpu.device, nextGpu.format);

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
  let ground = createGroundRenderer(gpu.device, gpu.format);
  const unobserveResize = observeCanvasSize(canvas, gpu.device);
  const input = attachInput(canvas);

  const colorAttachment: GPURenderPassColorAttachment = {
    clearValue: { r: 0.05, g: 0.07, b: 0.1, a: 1 },
    loadOp: "clear",
    storeOp: "store",
    view: undefined as unknown as GPUTextureView,
  };
  const passDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [colorAttachment],
  };

  function tick(): void {}

  function render(alpha: number, dtMs: number): void {
    void alpha;

    applyInput(input.state, camera, dtMs / 1000, canvas);
    smoothCamera(camera, dtMs);
    updateMatrices(camera, gpu.canvas.width / gpu.canvas.height);
    colorAttachment.view = gpu.context.getCurrentTexture().createView();

    const encoder = gpu.device.createCommandEncoder();
    const pass = encoder.beginRenderPass(passDescriptor);
    ground.draw(pass, gpu.device.queue, camera.viewProj);
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
