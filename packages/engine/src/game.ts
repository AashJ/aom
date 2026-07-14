import {
  canPlaceBuilding,
  createSnapshot,
  createWorld,
  FOOD,
  hashWorld,
  MAP_TILES,
  MAX_UNITS,
  RESOURCE_COUNT,
  spawnResourceNodes,
  spawnUnits,
  tickWorld,
  TYPE_TOWN_CENTER,
  TYPE_VILLAGER,
  unitIdAt,
  UNIT_TYPES,
  updateVisibility,
  VIS_VISIBLE,
  WOOD,
  writeSnapshot,
} from "@aom/sim";
import {
  applyCameraTerrain,
  createCamera,
  screenRay,
  smoothCamera,
  updateMatrices,
} from "./camera/camera";
import { DEPTH_FORMAT, initGPU } from "./gpu/device";
import { observeCanvasSize } from "./gpu/surface";
import { applyInput } from "./input/apply";
import { attachInput } from "./input/input";
import * as vec3 from "./math/vec3";
import { dumpWorldState } from "./net/dump";
import type { NetSession } from "./net/relay";
import { createLoopbackSink } from "./net/sink";
import { consumeCommandInput, consumeSelectionInput } from "./picking/pick";
import { createGpuTimer } from "./render/gpu-timer";
import { createFogRenderer } from "./render/fog";
import { createMarkerRenderer } from "./render/marker";
import { createMinimapRenderer } from "./render/minimap";
import { SPRITE_CONFIGS } from "./render/sprites";
import { createTerrainRenderer } from "./render/terrain";
import { createUnitsRenderer } from "./render/units";
import { createFrameLoop } from "./render/loop";
import { createStatsCollector, type StatsCallback } from "./render/stats";
import { raycastHeightfield } from "./terrain/raycast";

const placementRayOrigin = vec3.create();
const placementRayDir = vec3.create();
const placementHit = vec3.create();

export interface SelectionSummary {
  // Selected OWN villagers - the build menu gate.
  villagers: number;
  // FIRST selected own production building (packed id), -1 when none.
  producerId: number;
  producerType: number;
  producerComplete: boolean;
}

export interface GameHandle {
  start(): void;
  stop(): void;
  dispose(): void;
  startPlacement(buildingType: number): void;
  cancelPlacement(): void;
  trainSelected(unitType: number): void;
  producerProgress(): number;
  onSelection(cb: (sel: SelectionSummary) => void): () => void;
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
  const selectionCbs = new Set<(sel: SelectionSummary) => void>();
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
        fog = createFogRenderer(nextGpu.device);
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
  spawnUnits(world, 15, beginInfo ? beginInfo.players.map((p) => p.id) : [0]);

  for (let i = 0; i < world.count; i += 1) {
    if (world.owner[i] !== selfPlayerId || world.unitType[i] !== TYPE_TOWN_CENTER) continue;

    vec3.set(camera.goalTarget, world.posX[i]!, camera.goalTarget[1]!, world.posZ[i]!);
    vec3.copy(camera.target, camera.goalTarget);
    break;
  }

  spawnResourceNodes(world); // Fixed call order after armies - rng stream and handle ids must match on every client.
  updateVisibility(world);
  let prevSnap = createSnapshot(MAX_UNITS);
  let currSnap = createSnapshot(MAX_UNITS);
  const unitDrawCallSeen = new Uint8Array(SPRITE_CONFIGS.length);
  const markerPos = new Float32Array(2);
  let markerAgeMs = Number.POSITIVE_INFINITY;
  let markerKind = 1;
  let placementType = -1;
  const placementTile = new Int32Array(2);
  let placementValid = false;
  let lastVillagers = 0;
  let lastProducerId = -1;
  let lastProducerType = -1;
  let lastProducerComplete = false;
  writeSnapshot(world, prevSnap, selfPlayerId);
  writeSnapshot(world, currSnap, selfPlayerId);
  let terrain = createTerrainRenderer(gpu.device, gpu.format, heights, world.walkable);
  let units = await createUnitsRenderer(gpu.device, gpu.format, MAX_UNITS, heights);
  let minimap = createMinimapRenderer(gpu.device, gpu.format, heights);
  let marker = createMarkerRenderer(gpu.device, gpu.format, heights);
  let fog = createFogRenderer(gpu.device);
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
    writeSnapshot(world, currSnap, selfPlayerId);
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
      if (placementType >= 0) {
        const placementStats = UNIT_TYPES[placementType];

        if (placementStats) {
          const ndcX = (input.state.pointerX / canvas.clientWidth) * 2 - 1;
          const ndcY = 1 - (input.state.pointerY / canvas.clientHeight) * 2;
          let hitGround = false;

          screenRay(camera, ndcX, ndcY, placementRayOrigin, placementRayDir);
          hitGround = raycastHeightfield(
            heights,
            placementRayOrigin,
            placementRayDir,
            placementHit,
          );

          if (hitGround) {
            const footprint = placementStats.footprint;

            placementTile[0] = Math.round(placementHit[0]! - footprint / 2);
            placementTile[1] = Math.round(placementHit[2]! - footprint / 2);
          }

          const stockpileBase = selfPlayerId * RESOURCE_COUNT;
          // Preview-validation only — the sim revalidates authoritatively at application.
          const affordable =
            (currSnap.stockpiles[stockpileBase + FOOD] ?? 0) >= placementStats.costFood &&
            (currSnap.stockpiles[stockpileBase + WOOD] ?? 0) >= placementStats.costWood;
          let footprintVisible = hitGround;

          if (footprintVisible) {
            const footprint = placementStats.footprint;

            for (let z = placementTile[1]!; z < placementTile[1]! + footprint; z += 1) {
              for (let x = placementTile[0]!; x < placementTile[0]! + footprint; x += 1) {
                if (
                  x < 0 ||
                  x >= MAP_TILES ||
                  z < 0 ||
                  z >= MAP_TILES ||
                  currSnap.fog[z * MAP_TILES + x] !== VIS_VISIBLE
                ) {
                  footprintVisible = false;
                  break;
                }
              }

              if (!footprintVisible) break;
            }
          }

          placementValid =
            footprintVisible &&
            canPlaceBuilding(world, placementTile[0]!, placementTile[1]!, placementType) &&
            affordable;
        } else {
          placementValid = false;
        }

        // Placement is modal — clicks place, right-click cancels, selection/marquee suppressed.
        if (input.state.clickPending) {
          input.state.clickPending = false;

          if (placementValid) {
            sink.submitPlace(placementType, placementTile[0]!, placementTile[1]!);
            placementType = -1;
            placementValid = false;
          }
        }

        if (input.state.commandPending || input.state.escapePending) {
          input.state.commandPending = false;
          input.state.escapePending = false;
          placementType = -1;
          placementValid = false;
        }

        input.state.marqueePending = false;
      } else {
        consumeSelectionInput(
          input.state,
          world,
          camera,
          prevSnap,
          currSnap,
          alpha,
          heights,
          canvas,
        );
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

        // No placement to cancel: drop the intent so a stray Esc can't linger and
        // instantly cancel the NEXT placement the player starts.
        input.state.escapePending = false;
      }
    }
    let nextVillagers = 0;
    let nextProducerId = -1;
    let nextProducerType = -1;
    let nextProducerComplete = false;

    for (let i = 0; i < world.count; i += 1) {
      if (world.selected[i] !== 1 || world.owner[i] !== selfPlayerId) {
        continue;
      }

      const unitType = world.unitType[i]!;
      const unitStats = UNIT_TYPES[unitType]!;

      if (unitType === TYPE_VILLAGER) {
        nextVillagers += 1;
      }

      if (nextProducerId === -1 && unitStats.trains >= 0) {
        nextProducerId = unitIdAt(world, i);
        nextProducerType = unitType;
        nextProducerComplete = world.buildProgress[i]! >= unitStats.buildTicks;
      }
    }

    if (
      nextVillagers !== lastVillagers ||
      nextProducerId !== lastProducerId ||
      nextProducerType !== lastProducerType ||
      nextProducerComplete !== lastProducerComplete
    ) {
      lastVillagers = nextVillagers;
      lastProducerId = nextProducerId;
      lastProducerType = nextProducerType;
      lastProducerComplete = nextProducerComplete;

      for (const cb of selectionCbs) {
        cb({
          villagers: lastVillagers,
          producerId: lastProducerId,
          producerType: lastProducerType,
          producerComplete: lastProducerComplete,
        });
      }
    }

    markerAgeMs += dtMs;
    colorAttachment.view = gpu.context.getCurrentTexture().createView();

    const encoder = gpu.device.createCommandEncoder();
    const fogView = fog.update(encoder, gpu.device.queue, currSnap.fog, currSnap.tick);
    const pass = encoder.beginRenderPass(passDescriptor);
    const visibleChunks = terrain.draw(
      pass,
      gpu.device.queue,
      camera.viewProj,
      camera.frustum,
      input.state.debugOverlay,
      fogView,
    );
    const placementStats = UNIT_TYPES[placementType];
    const ghostType = placementStats ? placementType : -1;
    const ghostX = placementStats ? placementTile[0]! + placementStats.footprint / 2 : 0;
    const ghostZ = placementStats ? placementTile[1]! + placementStats.footprint / 2 : 0;
    const instances = units.draw(
      pass,
      gpu.device.queue,
      camera.viewProj,
      prevSnap,
      currSnap,
      alpha,
      heights,
      ghostType,
      ghostX,
      ghostZ,
      placementValid,
    );
    unitDrawCallSeen.fill(0);
    let unitDrawCalls = 0;
    for (let i = 0; i < currSnap.count; i += 1) {
      if (currSnap.visible[i] === 0) continue;

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
      fogView,
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
    let pop = 0;
    let popCap = 0;

    for (let i = 0; i < currSnap.count; i += 1) {
      if (currSnap.owner[i] !== selfPlayerId) {
        continue;
      }

      const unitStats = UNIT_TYPES[currSnap.unitType[i]!]!;

      if (unitStats.footprint === 0) {
        pop += 1;
      }

      if (currSnap.trainRemaining[i]! > 0) {
        pop += 1;
      }

      if (unitStats.footprint > 0 && currSnap.buildProgress[i]! >= unitStats.buildTicks) {
        popCap += unitStats.popBonus;
      }
    }

    statsCollector.frameGauges.pop = pop;
    statsCollector.frameGauges.popCap = popCap;
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
    selectionCbs.clear();
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
    startPlacement(buildingType: number): void {
      // UI-driven modal — the React build bar calls this.
      placementType = buildingType;
      placementValid = false;
    },
    cancelPlacement(): void {
      placementType = -1;
      placementValid = false;
    },
    trainSelected(unitType: number): void {
      for (let i = 0; i < world.count; i += 1) {
        if (world.selected[i] !== 1 || world.owner[i] !== selfPlayerId) {
          continue;
        }

        const unitStats = UNIT_TYPES[world.unitType[i]!]!;

        if (unitStats.trains !== unitType || world.buildProgress[i]! < unitStats.buildTicks) {
          continue;
        }

        // Preview-validation only — the sim revalidates authoritatively at application.
        sink.submitTrain(unitIdAt(world, i), unitType);
        return;
      }
    },
    producerProgress(): number {
      for (let i = 0; i < currSnap.count; i += 1) {
        if (currSnap.ids[i] !== lastProducerId) {
          continue;
        }

        const remaining = currSnap.trainRemaining[i]!;

        if (remaining > 0) {
          return 1 - remaining / UNIT_TYPES[currSnap.trainType[i]!]!.buildTicks;
        }

        return -1;
      }

      return -1;
    },
    onSelection(cb: (sel: SelectionSummary) => void): () => void {
      selectionCbs.add(cb);
      cb({
        villagers: lastVillagers,
        producerId: lastProducerId,
        producerType: lastProducerType,
        producerComplete: lastProducerComplete,
      });
      return () => selectionCbs.delete(cb);
    },
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
