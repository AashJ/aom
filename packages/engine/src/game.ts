import {
  createSnapshot,
  createWorld,
  FOOD,
  hashWorld,
  MAX_UNITS,
  RESOURCE_COUNT,
  spawnResourceNodes,
  spawnUnits,
  tickWorld,
  WOOD,
  writeSnapshot,
} from "@aom/sim";
import { applyCameraTerrain, createCamera, smoothCamera, updateMatrices } from "./camera/camera";
import { DEPTH_FORMAT, initGPU } from "./gpu/device";
import { observeCanvasSize } from "./gpu/surface";
import { applyInput } from "./input/apply";
import { attachInput } from "./input/input";
import { dumpWorldState } from "./net/dump";
import type { NetSession } from "./net/relay";
import { createLoopbackSink } from "./net/sink";
import { consumeCommandInput, consumeSelectionInput } from "./picking/pick";
import { createGpuTimer } from "./render/gpu-timer";
import { createMarkerRenderer } from "./render/marker";
import { createMinimapRenderer } from "./render/minimap";
import { SPRITE_CONFIGS } from "./render/sprites";
import { createTerrainRenderer } from "./render/terrain";
import { createUnitsRenderer } from "./render/units";
import { createFrameLoop } from "./render/loop";
import { createStatsCollector, type StatsCallback } from "./render/stats";

export interface GameHandle {
  start(): void;
  stop(): void;
  dispose(): void;
  onMatchEnd(cb: (winner: number) => void): () => void;
  onStats(cb: StatsCallback): () => void;
}

export interface GameOptions {
  session?: NetSession;
}

export async function createGame(
  canvas: HTMLCanvasElement,
  options: GameOptions = {},
): Promise<GameHandle> {
  let disposed = false;
  let running = false;
  let loop: ReturnType<typeof createFrameLoop>;
  const session = options.session ?? null;
  const matchEndCbs = new Set<(winner: number) => void>();
  let matchEnded = false;

  function handleDeviceLost(): void {
    const wasRunning = running;
    loop.stop();
    running = false;

    void initGPU(canvas, handleDeviceLost)
      .then(async (nextGpu) => {
        if (disposed) {
          nextGpu.device.destroy();
          return;
        }

        // Units renderer creation is async (sprite decode); the image itself is
        // cached across device loss, only GPU resources are rebuilt.
        const nextUnits = await createUnitsRenderer(
          nextGpu.device,
          nextGpu.format,
          MAX_UNITS,
          heights,
        );

        if (disposed) {
          nextGpu.device.destroy();
          return;
        }

        gpu = nextGpu;
        // GPU resources die with their device, so recreate renderer-owned state.
        terrain = createTerrainRenderer(nextGpu.device, nextGpu.format, heights, world.walkable);
        units = nextUnits;
        minimap = createMinimapRenderer(nextGpu.device, nextGpu.format, heights);
        marker = createMarkerRenderer(nextGpu.device, nextGpu.format, heights);
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

  // The lobby is React chrome, the match is the engine: createGame never sees lobby states.
  const beginInfo = session ? await session.begin : null;

  let gpu = await initGPU(canvas, handleDeviceLost);
  const camera = createCamera();
  const world = createWorld(beginInfo ? beginInfo.seed : 1337);
  const sink = session ? session.sink : createLoopbackSink(world);
  const selfPlayerId = beginInfo ? beginInfo.selfId : 0;
  // Init handoff: createWorld(seed) derives terrain from the same seed the sim owns,
  // so rendering receives identical heights without a per-tick channel.
  const heights = world.heights;
  spawnUnits(world, 1_000, beginInfo ? beginInfo.players.map((p) => p.id) : [0]);
  spawnResourceNodes(world); // Fixed call order after armies - rng stream and handle ids must match on every client.
  let prevSnap = createSnapshot(MAX_UNITS);
  let currSnap = createSnapshot(MAX_UNITS);
  const unitDrawCallSeen = new Uint8Array(SPRITE_CONFIGS.length);
  const markerPos = new Float32Array(2);
  let markerAgeMs = Number.POSITIVE_INFINITY;
  let markerKind = 1;
  writeSnapshot(world, prevSnap);
  writeSnapshot(world, currSnap);
  let terrain = createTerrainRenderer(gpu.device, gpu.format, heights, world.walkable);
  let units = await createUnitsRenderer(gpu.device, gpu.format, MAX_UNITS, heights);
  let minimap = createMinimapRenderer(gpu.device, gpu.format, heights);
  let marker = createMarkerRenderer(gpu.device, gpu.format, heights);
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
  let blockedTickCalls = 0;
  let stallNotified = false;

  function tick(): boolean {
    if (session) {
      if (session.isDesynced()) {
        // A desynced match freezes forever — detection, not recovery, per the doc.
        return false;
      }

      if (!session.buffer.has(world.tick)) {
        blockedTickCalls += 1;
        if (blockedTickCalls >= 5 && !stallNotified) {
          // ~250 ms at 20 Hz: the waiting-UI threshold from ARCHITECTURE.md.
          session.notifyStalled(true);
          stallNotified = true;
        }

        return false;
      }

      session.buffer.applyTo(world, world.tick);
    }

    const tickStart = performance.now();

    tickWorld(world);

    // Prev/curr double-buffer swap: render interpolates between the last two completed ticks,
    // so display runs one tick behind real time by design.
    const tmp = prevSnap;
    prevSnap = currSnap;
    currSnap = tmp;
    writeSnapshot(world, currSnap);
    // Max-since-emit, reset by the collector.
    statsCollector.frameGauges.tickMsMax = Math.max(
      statsCollector.frameGauges.tickMsMax,
      performance.now() - tickStart,
    );

    if (session) {
      if (world.tick % beginInfo!.hashIntervalTicks === 0) {
        // world.tick has already advanced — every client hashes at the same post-tick boundaries.
        session.reportHash(world.tick, hashWorld(world));
      }

      blockedTickCalls = 0;
      if (stallNotified) {
        session.notifyStalled(false);
        stallNotified = false;
      }
    }

    return true;
  }

  function onGpuSample(gpuMs: number): void {
    statsCollector.frameGauges.gpuMs = gpuMs;
  }

  function render(alpha: number, dtMs: number): void {
    applyInput(input.state, camera, dtMs / 1000, canvas);
    applyCameraTerrain(camera, heights, dtMs);
    smoothCamera(camera, dtMs);
    updateMatrices(camera, gpu.canvas.width / gpu.canvas.height);

    // the war is over — commands die here, but the camera stays live to survey the aftermath; the sim keeps ticking peacefully and identically on every client.
    if (!matchEnded) {
      consumeSelectionInput(input.state, world, camera, prevSnap, currSnap, alpha, heights, canvas);
      if (input.state.corruptPending) {
        input.state.corruptPending = false;
        if (session) {
          // A DELIBERATE violation of the command seam — the whole point is to simulate the class of bug the hash exchange exists to catch. Networked only; meaningless in single-player.
          world.posX[0] = world.posX[0]! + 0.001;
          console.warn("[dev] corrupted posX[0] to force a desync");
        }
      }

      const issued = consumeCommandInput(
        input.state,
        world,
        sink,
        selfPlayerId,
        camera,
        prevSnap,
        currSnap,
        alpha,
        heights,
        canvas,
        markerPos,
      );
      if (issued !== 0) {
        markerAgeMs = 0;
        markerKind = issued;
      }
    }
    markerAgeMs += dtMs;
    colorAttachment.view = gpu.context.getCurrentTexture().createView();

    const encoder = gpu.device.createCommandEncoder();
    const pass = encoder.beginRenderPass(passDescriptor);
    const visibleChunks = terrain.draw(
      pass,
      gpu.device.queue,
      camera.viewProj,
      camera.frustum,
      input.state.debugOverlay,
    );
    const instances = units.draw(
      pass,
      gpu.device.queue,
      camera.viewProj,
      prevSnap,
      currSnap,
      alpha,
      heights,
    );
    unitDrawCallSeen.fill(0);
    let unitDrawCalls = 0;
    for (let i = 0; i < currSnap.count; i += 1) {
      const unitType = currSnap.unitType[i]!;

      if (unitDrawCallSeen[unitType] === 0) {
        unitDrawCallSeen[unitType] = 1;
        unitDrawCalls += 1;
      }
    }
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
    if (markerAgeMs < 600) {
      marker.draw(
        pass,
        gpu.device.queue,
        camera.viewProj,
        markerPos[0]!,
        markerPos[1]!,
        markerAgeMs / 600,
        markerKind,
      );
    }
    // +3 = minimap base + minimap footprint + minimap dots; units draw once per occupied sprite bucket.
    statsCollector.frameGauges.drawCalls =
      visibleChunks + unitDrawCalls + 3 + (markerAgeMs < 600 ? 1 : 0);
    statsCollector.frameGauges.instances = instances;
    statsCollector.frameGauges.chunksVisible = visibleChunks;
    statsCollector.frameGauges.chunksTotal = terrain.chunkBounds.length;
    const stockpileBase = selfPlayerId * RESOURCE_COUNT;
    statsCollector.frameGauges.food = currSnap.stockpiles[stockpileBase + FOOD] ?? 0;
    statsCollector.frameGauges.wood = currSnap.stockpiles[stockpileBase + WOOD] ?? 0;
    statsCollector.frameGauges.pingMs = session ? session.pingMs() : 0;
    pass.end();
    gpuTimer.afterPass(encoder);
    gpu.device.queue.submit([encoder.finish()]);
    gpuTimer.afterSubmit(onGpuSample);

    // the sim decided the outcome ticks ago and hashed it; the engine only announces. Fires once.
    if (!matchEnded && currSnap.winner !== -1) {
      matchEnded = true;
      for (const cb of matchEndCbs) {
        cb(currSnap.winner);
      }
    }
  }

  const statsCollector = createStatsCollector();
  loop = createFrameLoop({ render, sample: statsCollector.sample, tick });
  let hiddenTickTimer = 0;

  function stopHiddenTicking(): void {
    if (hiddenTickTimer === 0) {
      return;
    }

    window.clearInterval(hiddenTickTimer);
    hiddenTickTimer = 0;
  }

  function syncHiddenTicking(): void {
    if (!session || disposed) {
      return;
    }

    if (document.hidden) {
      if (hiddenTickTimer === 0) {
        // Hidden tabs get no rAF, which would stall every opponent. This interval keeps
        // consuming turns and ticking the sim with no rendering; ticks are cheap, frames are not.
        hiddenTickTimer = window.setInterval(() => tick(), 50);
      }
    } else {
      stopHiddenTicking();
    }
  }

  if (session) {
    document.addEventListener("visibilitychange", syncHiddenTicking);
    syncHiddenTicking();
  }

  const unsubscribeDesync = session
    ? session.onEvent((event) => {
        if (event.kind === "desynced") {
          dumpWorldState(world, event.tick);
        }
      })
    : null;

  function dispose(): void {
    if (disposed) {
      return;
    }

    disposed = true;
    running = false;
    stopHiddenTicking();
    if (session) {
      document.removeEventListener("visibilitychange", syncHiddenTicking);
    }
    unsubscribeDesync?.();
    loop.stop();
    unobserveResize();
    input.detach();
    depthTexture?.destroy();
    gpu.device.destroy();
  }

  return {
    dispose,
    onMatchEnd(cb: (winner: number) => void): () => void {
      matchEndCbs.add(cb);
      // React effects may attach after a fast finish.
      if (matchEnded) {
        cb(currSnap.winner);
      }
      return () => matchEndCbs.delete(cb);
    },
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
