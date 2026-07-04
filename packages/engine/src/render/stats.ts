export interface GameStats {
  fps: number;
  frameMsAvg: number;
  frameMsP99: number;
  gpuMs: number;
  heapMB: number;
  drawCalls: number;
  instances: number;
  chunksVisible: number;
  chunksTotal: number;
}

export type StatsCallback = (stats: GameStats) => void;

const EMIT_INTERVAL_MS = 250;
const WINDOW_SIZE = 240;

interface PerformanceWithMemory extends Performance {
  readonly memory?: {
    readonly usedJSHeapSize: number;
  };
}

export function createStatsCollector(): {
  frameGauges: {
    gpuMs: number;
    drawCalls: number;
    instances: number;
    chunksVisible: number;
    chunksTotal: number;
  };
  sample(frameStart: number, cpuMs: number): void;
  subscribe(cb: StatsCallback): () => void;
} {
  const samples = new Float32Array(WINDOW_SIZE);
  const scratch = new Float32Array(WINDOW_SIZE);
  const stats: GameStats = {
    fps: 0,
    frameMsAvg: 0,
    frameMsP99: 0,
    gpuMs: 0,
    heapMB: 0,
    drawCalls: 0,
    instances: 0,
    chunksVisible: 0,
    chunksTotal: 0,
  };
  // Per-frame gauges written by the render path, latched into GameStats at emit time.
  const frameGauges = { gpuMs: 0, drawCalls: 0, instances: 0, chunksVisible: 0, chunksTotal: 0 };
  const callbacks = new Set<StatsCallback>();

  let sampleIndex = 0;
  let sampleCount = 0;
  let framesSinceEmit = 0;
  let lastEmit = 0;

  function sample(frameStart: number, cpuMs: number): void {
    samples[sampleIndex] = cpuMs;
    sampleIndex = (sampleIndex + 1) % WINDOW_SIZE;
    sampleCount = Math.min(sampleCount + 1, WINDOW_SIZE);
    framesSinceEmit += 1;

    if (sampleCount === 1) {
      lastEmit = frameStart;
    }

    const elapsed = frameStart - lastEmit;

    if (elapsed < EMIT_INTERVAL_MS) {
      return;
    }

    let total = 0;

    for (let index = 0; index < sampleCount; index += 1) {
      total += samples[index] ?? 0;
    }

    scratch.set(samples.subarray(0, sampleCount));
    scratch.subarray(0, sampleCount).sort();

    stats.fps = (framesSinceEmit * 1000) / elapsed;
    stats.frameMsAvg = total / sampleCount;
    stats.frameMsP99 = scratch[Math.min(sampleCount - 1, Math.floor(sampleCount * 0.99))] ?? 0;
    stats.gpuMs = frameGauges.gpuMs;
    stats.drawCalls = frameGauges.drawCalls;
    stats.instances = frameGauges.instances;
    stats.chunksVisible = frameGauges.chunksVisible;
    stats.chunksTotal = frameGauges.chunksTotal;

    const memory = (performance as PerformanceWithMemory).memory;
    stats.heapMB = memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;

    framesSinceEmit = 0;
    lastEmit = frameStart;

    // The same stats object is reused for every emit; subscribers should copy values they retain.
    for (const callback of callbacks) {
      callback(stats);
    }
  }

  function subscribe(cb: StatsCallback): () => void {
    callbacks.add(cb);

    return () => {
      callbacks.delete(cb);
    };
  }

  return { frameGauges, sample, subscribe };
}
