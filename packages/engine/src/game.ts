import {
  BUILD_OPTIONS_BY_WORKER,
  canPlaceBuilding,
  CHEAT_ADD_FOOD,
  CHEAT_ADD_GOLD,
  CHEAT_ADD_WOOD,
  CHEAT_FULL_FAVOR,
  CHEAT_REVEAL_MAP,
  cultureForMajorGod,
  createSnapshot,
  createWorld,
  FAVOR,
  FOOD,
  GOLD,
  GOD_RA,
  GOD_ZEUS,
  hashWorld,
  MAP_TILES,
  MAX_TRAIN_QUEUE,
  MAX_UNITS,
  MODE_PRAYING,
  RESOURCE_COUNT,
  registerPlayer,
  resolveId,
  spawnResourceNodes,
  spawnUnits,
  tickWorld,
  townCenterTypeForCulture,
  TRAIN_OPTIONS_BY_PRODUCER,
  unitIdAt,
  UNIT_TYPES,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_WORKER,
  updateVisibility,
  VIS_VISIBLE,
  WOOD,
  workerTypeForCulture,
  writeSnapshot,
  type CheatId,
  type TypeCommandRelationship,
} from "@aom/sim";
import { createGameAudio } from "./audio/audio";
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
import { createTerrainRenderer } from "./render/terrain";
import { createUnitsRenderer } from "./render/units";
import { createFrameLoop } from "./render/loop";
import { createStatsCollector, type StatsCallback } from "./render/stats";
import { raycastHeightfield } from "./terrain/raycast";
import { createPlayerStateStore, type PlayerStateCallback } from "./player-state";

const placementRayOrigin = vec3.create();
const placementRayDir = vec3.create();
const placementHit = vec3.create();

function cheatFromChat(code: string): CheatId | null {
  switch (code) {
    case "JUNK FOOD NIGHT":
      return CHEAT_ADD_FOOD;
    case "TROJAN HORSE FOR SALE":
      return CHEAT_ADD_WOOD;
    case "ATM OF EREBUS":
      return CHEAT_ADD_GOLD;
    case "MOUNT OLYMPUS":
      return CHEAT_FULL_FAVOR;
    case "LAY OF THE LAND":
      return CHEAT_REVEAL_MAP;
    default:
      return null;
  }
}

export interface SelectionSummary {
  // Selected OWN villagers - the build menu gate.
  villagers: number;
  prayingVillagers: number;
  builderType: number;
  buildOptions: readonly TypeCommandRelationship[];
  // FIRST selected own production building, null when none.
  producer: {
    id: number;
    type: number;
    complete: boolean;
    trainOptions: readonly TypeCommandRelationship[];
    queueTypes: readonly number[];
    progress: number;
  } | null;
}

export interface GameHandle {
  start(): void;
  stop(): void;
  dispose(): void;
  startPlacement(buildingType: number): void;
  cancelPlacement(): void;
  trainSelected(unitType: number): void;
  cancelTraining(buildingId: number, queueIndex: number): void;
  advanceAge(buildingId: number, minorGod: number): void;
  submitCheat(code: string): boolean;
  onPlayerState(cb: PlayerStateCallback): () => void;
  onSelection(cb: (sel: SelectionSummary) => void): () => void;
  onMatchEnd(cb: (winner: number) => void): () => void;
  onStats(cb: StatsCallback): () => void;
}

export interface GameOptions {
  session?: NetSession;
  culture?: GameCulture;
}

export type GameCulture = "egyptian" | "greek";

const NO_OPTIONS: readonly TypeCommandRelationship[] = Object.freeze([]);
const NO_TYPES: readonly number[] = Object.freeze([]);

function typeListsEqual(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function optionListsEqual(
  left: readonly TypeCommandRelationship[],
  right: readonly TypeCommandRelationship[],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (
      left[index]!.type !== right[index]!.type ||
      left[index]!.commandSlot !== right[index]!.commandSlot
    ) {
      return false;
    }
  }
  return true;
}

export async function createGame(
  canvas: HTMLCanvasElement,
  options: GameOptions = {},
): Promise<GameHandle> {
  let disposed = false;
  let running = false;
  let loop: ReturnType<typeof createFrameLoop>;
  const session = options.session ?? null;
  const soloMajorGod = options.culture === "egyptian" ? GOD_RA : GOD_ZEUS;
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

        // Decoded images are cached across device loss; only GPU resources are rebuilt.
        const [nextTerrain, nextUnits] = await Promise.all([
          createTerrainRenderer(
            nextGpu.device,
            nextGpu.format,
            heights,
            world.terrainMaterials,
            world.walkable,
          ),
          createUnitsRenderer(nextGpu.device, nextGpu.format, MAX_UNITS, heights),
        ]);

        if (disposed) {
          nextGpu.device.destroy();
          return;
        }

        gpu = nextGpu;
        // GPU resources die with their device, so recreate renderer-owned state.
        terrain = nextTerrain;
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
  const selfPlayerId = beginInfo ? beginInfo.selfId : 0;
  // Init handoff: createWorld(seed) derives terrain from the same seed the sim owns,
  // so rendering receives identical heights without a per-tick channel.
  const ownerIds = beginInfo ? beginInfo.players.map((player) => player.id) : [0];
  const world = createWorld(beginInfo ? beginInfo.seed : 1337);
  const sink = session ? session.sink : createLoopbackSink(world);
  const heights = world.heights;

  for (let ownerIndex = 0; ownerIndex < ownerIds.length; ownerIndex += 1) {
    registerPlayer(world, ownerIds[ownerIndex]!, session ? GOD_ZEUS : soloMajorGod);
  }

  spawnUnits(world, 3 * ownerIds.length, ownerIds);
  const selfCulture = cultureForMajorGod(world.playerMajorGod[selfPlayerId]!);
  const selfTownCenterType = townCenterTypeForCulture(selfCulture);
  const selfWorkerType = workerTypeForCulture(selfCulture);

  for (let i = 0; i < world.count; i += 1) {
    if (world.owner[i] !== selfPlayerId || world.unitType[i] !== selfTownCenterType) continue;

    vec3.set(camera.goalTarget, world.posX[i]!, camera.goalTarget[1]!, world.posZ[i]!);
    vec3.copy(camera.target, camera.goalTarget);
    break;
  }

  spawnResourceNodes(world); // Fixed call order after armies - rng stream and handle ids must match on every client.
  updateVisibility(world);
  let prevSnap = createSnapshot(MAX_UNITS);
  let currSnap = createSnapshot(MAX_UNITS);

  const markerPos = new Float32Array(2);
  let markerAgeMs = Number.POSITIVE_INFINITY;
  let markerKind = 1;
  let placementType = -1;
  const placementTile = new Int32Array(2);
  let placementValid = false;
  let lastSelection: SelectionSummary = {
    villagers: 0,
    prayingVillagers: 0,
    builderType: -1,
    buildOptions: NO_OPTIONS,
    producer: null,
  };
  writeSnapshot(world, prevSnap, selfPlayerId);
  writeSnapshot(world, currSnap, selfPlayerId);
  const playerState = createPlayerStateStore(selfPlayerId);

  playerState.update(currSnap);

  function isViewerTypeAvailable(unitType: number, producerType?: number): boolean {
    return playerState.availability(unitType, producerType).available;
  }

  let [terrain, units] = await Promise.all([
    createTerrainRenderer(gpu.device, gpu.format, heights, world.terrainMaterials, world.walkable),
    createUnitsRenderer(gpu.device, gpu.format, MAX_UNITS, heights),
  ]);
  let minimap = createMinimapRenderer(gpu.device, gpu.format, heights);
  let marker = createMarkerRenderer(gpu.device, gpu.format, heights);
  let fog = createFogRenderer(gpu.device);
  let gpuTimer = createGpuTimer(gpu.device);
  let depthTexture: GPUTexture | null = null;
  const audio = createGameAudio(world.playerMajorGod[selfPlayerId]!);

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
    playerState.update(currSnap);
    audio.sync(
      currSnap,
      selfPlayerId,
      camera.target[0]!,
      camera.target[2]!,
      camera.viewDir[0]!,
      camera.viewDir[2]!,
    );
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

        if (placementStats && isViewerTypeAvailable(placementType)) {
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
            (currSnap.stockpiles[stockpileBase + WOOD] ?? 0) >= placementStats.costWood &&
            (currSnap.stockpiles[stockpileBase + GOLD] ?? 0) >= placementStats.costGold &&
            (currSnap.stockpiles[stockpileBase + FAVOR] ?? 0) >= placementStats.costFavor;
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

          let selectedUnit = -1;

          for (let i = 0; i < world.count; i += 1) {
            const type = world.unitType[i]!;

            if (
              world.selected[i] === 1 &&
              world.owner[i] === selfPlayerId &&
              (UNIT_TYPES[type]!.classes & UNIT_CLASS_HUMAN) !== 0
            ) {
              selectedUnit = i;
              break;
            }
          }

          if (selectedUnit !== -1) {
            let resourceType: number | undefined;

            if (issued === 3) {
              let nearestDistanceSq = Number.POSITIVE_INFINITY;

              for (let i = 0; i < currSnap.count; i += 1) {
                const type = currSnap.unitType[i]!;

                if (UNIT_TYPES[type]!.resource < 0) {
                  continue;
                }

                const dx = currSnap.posX[i]! - markerPos[0]!;
                const dz = currSnap.posZ[i]! - markerPos[1]!;
                const distanceSq = dx * dx + dz * dz;

                if (distanceSq < nearestDistanceSq) {
                  nearestDistanceSq = distanceSq;
                  resourceType = type;
                }
              }
            }

            audio.acknowledge(
              issued,
              world.unitType[selectedUnit]!,
              world.posX[selectedUnit]!,
              world.posZ[selectedUnit]!,
              resourceType,
            );
          }
        }

        // No placement to cancel: drop the intent so a stray Esc can't linger and
        // instantly cancel the NEXT placement the player starts.
        input.state.escapePending = false;
      }
    }
    let villagers = 0;
    let prayingVillagers = 0;
    let builderType = -1;
    let buildOptions = NO_OPTIONS;
    let producer: SelectionSummary["producer"] = null;

    for (let i = 0; i < world.count; i += 1) {
      if (world.selected[i] !== 1 || world.owner[i] !== selfPlayerId) {
        continue;
      }

      const unitType = world.unitType[i]!;
      const unitStats = UNIT_TYPES[unitType]!;

      if ((unitStats.classes & UNIT_CLASS_WORKER) !== 0) {
        villagers += 1;

        if (builderType === -1) {
          builderType = unitType;
          buildOptions = BUILD_OPTIONS_BY_WORKER[unitType] ?? NO_OPTIONS;
        }

        if (world.mode[i] === MODE_PRAYING && world.moving[i] === 0) {
          prayingVillagers += 1;
        }
      }

      if (producer === null && TRAIN_OPTIONS_BY_PRODUCER[unitType] !== undefined) {
        const remaining = world.trainRemaining[i]!;
        const queueStart = i * MAX_TRAIN_QUEUE;
        const queueTypes = Array.from(
          world.trainQueueTypes.subarray(queueStart, queueStart + world.trainQueueLength[i]!),
        );

        producer = {
          id: unitIdAt(world, i),
          type: unitType,
          complete: world.buildProgress[i]! >= unitStats.buildTicks,
          trainOptions: TRAIN_OPTIONS_BY_PRODUCER[unitType]!,
          queueTypes,
          progress:
            remaining > 0 && queueTypes.length > 0
              ? 1 - remaining / UNIT_TYPES[queueTypes[0]!]!.buildTicks
              : 0,
        };
      }
    }

    const lastProducer = lastSelection.producer;
    if (
      villagers !== lastSelection.villagers ||
      prayingVillagers !== lastSelection.prayingVillagers ||
      builderType !== lastSelection.builderType ||
      !optionListsEqual(buildOptions, lastSelection.buildOptions) ||
      producer?.id !== lastProducer?.id ||
      producer?.type !== lastProducer?.type ||
      producer?.complete !== lastProducer?.complete ||
      !optionListsEqual(
        producer?.trainOptions ?? NO_OPTIONS,
        lastProducer?.trainOptions ?? NO_OPTIONS,
      ) ||
      !typeListsEqual(producer?.queueTypes ?? NO_TYPES, lastProducer?.queueTypes ?? NO_TYPES) ||
      producer?.progress !== lastProducer?.progress
    ) {
      lastSelection = { villagers, prayingVillagers, builderType, buildOptions, producer };

      for (const cb of selectionCbs) {
        cb(lastSelection);
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
    const unitStatistics = units.draw(
      pass,
      gpu.device.queue,
      camera.viewProj,
      camera.viewDir,
      prevSnap,
      currSnap,
      alpha,
      heights,
      ghostType,
      ghostX,
      ghostZ,
      placementValid,
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
    // +4 = minimap frame + base + footprint + dots.
    statsCollector.frameGauges.drawCalls =
      visibleChunks + unitStatistics.drawCalls + 4 + (markerAgeMs < 600 ? 1 : 0);
    statsCollector.frameGauges.instances = unitStatistics.instances;
    statsCollector.frameGauges.chunksVisible = visibleChunks;
    statsCollector.frameGauges.chunksTotal = terrain.chunkBounds.length;
    statsCollector.frameGauges.pingMs = session ? session.pingMs() : 0;
    pass.end();
    gpuTimer.afterPass(encoder);
    gpu.device.queue.submit([encoder.finish()]);
    gpuTimer.afterSubmit(onGpuSample);

    // the sim decided the outcome ticks ago and hashed it; the engine only announces. Fires once.
    if (!matchEnded && currSnap.winner !== -1) {
      matchEnded = true;
      audio.matchEnd(currSnap.winner === selfPlayerId);
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
    audio.dispose();
    unobserveResize();
    input.detach();
    selectionCbs.clear();
    playerState.clear();
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
    onPlayerState: playerState.subscribe,
    startPlacement(buildingType: number): void {
      // UI-driven modal — the React build bar calls this.
      if (!isViewerTypeAvailable(buildingType, selfWorkerType)) {
        return;
      }

      audio.uiClick();
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

        if (
          !isViewerTypeAvailable(unitType, world.unitType[i]!) ||
          !TRAIN_OPTIONS_BY_PRODUCER[world.unitType[i]!]?.some(
            (option) => option.type === unitType,
          ) ||
          world.buildProgress[i]! < unitStats.buildTicks
        ) {
          continue;
        }

        // Preview-validation only — the sim revalidates authoritatively at application.
        sink.submitTrain(unitIdAt(world, i), unitType);
        audio.uiClick();
        return;
      }
    },
    cancelTraining(buildingId: number, queueIndex: number): void {
      const building = resolveId(world, buildingId);

      if (
        building < 0 ||
        world.owner[building] !== selfPlayerId ||
        queueIndex < 0 ||
        queueIndex >= world.trainQueueLength[building]!
      ) {
        return;
      }

      sink.submitCancelTrain(buildingId, queueIndex);
      audio.uiClick();
    },
    advanceAge(buildingId: number, minorGod: number): void {
      const building = resolveId(world, buildingId);

      if (
        building < 0 ||
        world.selected[building] !== 1 ||
        world.owner[building] !== selfPlayerId ||
        world.unitType[building] !== selfTownCenterType ||
        world.buildProgress[building]! < UNIT_TYPES[selfTownCenterType]!.buildTicks
      ) {
        return;
      }

      // Preview-validation only. Food, Temple, age, and god choice are all
      // revalidated by the deterministic sim when the command lands.
      sink.submitAdvanceAge(buildingId, minorGod);
      audio.uiClick();
    },
    submitCheat(code: string): boolean {
      const cheat = cheatFromChat(code);

      if (cheat === null) {
        return false;
      }

      sink.submitCheat(cheat);
      return true;
    },
    onSelection(cb: (sel: SelectionSummary) => void): () => void {
      selectionCbs.add(cb);
      cb(lastSelection);
      return () => selectionCbs.delete(cb);
    },
    start(): void {
      if (disposed) {
        return;
      }

      running = true;
      audio.setActive(true);
      loop.start();
    },
    stop(): void {
      running = false;
      audio.setActive(false);
      loop.stop();
    },
  };
}
